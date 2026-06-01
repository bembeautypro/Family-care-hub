# Módulo de Histórico Clínico

## 1. Migração de schema (clinical_events)

A tabela hoje tem `type`, `title`, `description`, `severity`, `event_date`, `created_by`, `appointment_id` e soft delete — mas faltam campos do prompt e os valores atuais (`consultation`, `exam`, `low`/`medium`/`high`) não cobrem as 12 categorias nem a gravidade "Crítica".

Mudanças:
- `ALTER TABLE clinical_events ADD COLUMN tags text[]`
- `ALTER TABLE clinical_events ADD COLUMN doctor_name text`
- CHECK constraint em `type` com os 12 valores: `consultation`, `exam`, `hospitalization`, `surgery`, `symptom`, `fall_accident`, `medication_change`, `diagnosis`, `followup`, `crisis`, `vaccine`, `family_note`
- CHECK constraint em `severity` com `low | medium | high | critical`
- Índice em `(patient_id, event_date DESC) WHERE deleted_at IS NULL` para ordenar a timeline rápido
- Índice GIN em `tags`

CHECK é seguro aqui (lista imutável de enums) — não viola a regra "use trigger em vez de CHECK" que vale para validações temporais.

## 2. Helper compartilhado — `src/lib/historico.ts`

- Tipo `EventType` + array `EVENT_TYPES` com `{ value, label pt-BR, icon emoji }` (12 itens)
- Tipo `Severity` + array `SEVERITIES` com `{ value, label, dotColor, borderColor }` mapeando para tokens semânticos do design system (cinza/azul/laranja/vermelho — adicionar tokens em `src/styles.css` se faltarem)
- Helper `formatEventDate(date)` em pt-BR (dia + mês abreviado + ano)

## 3. Timeline — `src/routes/historico.tsx` (reescrita)

Layout:
- `AppHeader` + `PatientSelector` + `BottomNav` + `Fab` (padrão dashboard)
- Título "Histórico clínico"
- **Filtro 1** (tipo): chips horizontais com `overflow-x-auto`, primeiro chip "Todos", depois os 12 tipos
- **Filtro 2** (gravidade): chips "Todos | Baixa | Média | Alta | Crítica"
- Lista de cards ordenada por `event_date DESC`
- Estado vazio com CTA "Adicionar primeiro evento"
- Skeleton durante load (3 cards fake)

Card:
- `border-l-4` com cor da gravidade
- Data formatada em pt-BR no topo
- Ícone (emoji) + título em negrito
- Descrição truncada em 2 linhas (`line-clamp-2`); clique no card alterna `line-clamp-none`
- Badge de gravidade
- Nome do registrador (lookup em `profiles` via `created_by`)
- Botão ⋮ → `Sheet` (bottom sheet) com Editar / Arquivar

Filtragem **server-side**: a query é refeita a cada mudança de filtro com `.eq('type', ...)` e `.eq('severity', ...)`, mais `.eq('patient_id', active.id)` e `.is('deleted_at', null)`.

Arquivar = `UPDATE clinical_events SET deleted_at = now(), deleted_by = auth.uid()` (soft delete) com confirmação via `AlertDialog`.

## 4. Form — `src/routes/eventos.novo.tsx` (expansão) + `src/routes/eventos.$id.editar.tsx` (novo)

Extrair a lógica para `src/components/eventos/ClinicalEventForm.tsx` (compartilhado novo/editar):
- Select de **tipo** com os 12 valores (emoji + label)
- Date picker (shadcn `Calendar` em `Popover`, `pointer-events-auto`)
- Input título (obrigatório)
- Textarea descrição
- Radio group de gravidade com 4 opções (incluindo Crítica)
- Input de tags (string separada por vírgula → `text[]`); chips removíveis embaixo
- Input médico relacionado (`doctor_name`)
- Mantém compatibilidade com `?appointment=<id>` (carrega evento já existente para editar orientações)

Rota `/eventos/$id/editar` carrega por `id`, popula o form, faz UPDATE.

## 5. Bottom nav + dashboard

- O `BottomNav` continua com 5 itens; "Histórico" não entra na nav (é acessado via dashboard "Ver histórico completo →" que já aponta para `/historico`)
- Sem mudanças no dashboard

## Aspectos técnicos

- Todas queries: `WHERE deleted_at IS NULL`, `WHERE patient_id = active.id`, ordenadas por `event_date DESC, created_at DESC`
- Filtros aplicados no servidor (refetch ao mudar chip), nada filtrado no client
- Soft delete via UPDATE (RLS já cobre via `editors can update clinical_events`)
- Sem swipe — ações sempre via botão ⋮ + bottom sheet
- Tokens de cor (severity) definidos em `src/styles.css` para não usar classes hex inline
- FAB em `bottom: 72px` (já garantido pelo `Fab` compartilhado)
- Auth gate via `supabase.auth.getUser()` no componente, redireciona para `/auth/login` se sem sessão

## Arquivos

**Criar:**
- `src/lib/historico.ts`
- `src/components/eventos/ClinicalEventForm.tsx`
- `src/routes/eventos.$id.editar.tsx`

**Editar:**
- `src/routes/historico.tsx` (reescrita completa)
- `src/routes/eventos.novo.tsx` (passa a usar `ClinicalEventForm`)
- `src/styles.css` (tokens de severidade, se faltarem)
- `src/routeTree.gen.ts` (registro da rota de editar)

**Migration:** `add tags + doctor_name + CHECK constraints + índices em clinical_events`
