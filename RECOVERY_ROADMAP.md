# RECOVERY_ROADMAP — Amparo

Fontes: `AUDIT.md` (riscos A1–A4, M1–M6, B1–B5) e `CRITICAL_FLOWS.md` (fluxos F1–F15). Nenhum item fora do AUDIT.md foi adicionado. Esforço: **P** (pontual, 1 arquivo/poucas linhas), **M** (médio, várias telas ou migration + código), **G** (grande, refator estrutural).

## Resumo Executivo

O projeto **não tem CRÍTICO de produção**. P0 reúne apenas os dois itens que vazam/corrompem dado clínico sensível em superfície pública ou perdem trilha forense: **A1** (FK `SET NULL` apaga auditoria) e **M1+M2** (endpoint `/e/$token` sem rate-limit devolvendo signed URLs de PDFs por 1h). P1 fecha estabilidade real do app autenticado (race no dashboard, gate de auth duplicado, enums divergentes, `deleted_by` faltando, deploy preset). P2 cuida de índices, refactor para React Query e tokens semânticos. P3 cobre o cron LGPD prometido na migration mas não declarado. P4 entrega as funcionalidades anunciadas e não implementadas (visualizador PDF, PWA, Realtime).

**Linha crítica:** P1-L1/A2 (mover para `_authenticated/`) habilita ergonomia para todo o resto; P0-L1/A1 exige migration que precisa preceder qualquer hard delete administrativo; M2 depende de M1 (rate-limit antes de mexer em TTL).

---

## P0 — BLOQUEADORES

Itens que vazam dado clínico em superfície pública ou destroem trilha forense. Bloqueiam GA público (não bloqueiam beta fechado).

### P0-L1 · Superfície pública de emergência e auditoria forense

- **P0-01 · A1 — `access_logs.patient_id`/`family_id` `ON DELETE SET NULL`**
  - Evidência: AUDIT.md §ALTO/A1; migration `…170407_…sql:580,583`; policy `…170407:601`.
  - Impacto: hard delete de paciente apaga `family_id` dos logs anteriores → invisíveis via RLS → sem rastro forense de acessos de emergência prévios.
  - Esforço: **P**.
  - Dependências: nenhuma.
  - Critério: migration trocando FK para `ON DELETE CASCADE` **ou** snapshot `family_id_snapshot text not null` + policy ajustada. Verificar com `\d+ public.access_logs` mostrando `ON DELETE CASCADE` (ou coluna snapshot populada) e executar fluxo **F10 (Exclusão de Paciente)** + **F11 (Auditoria de Acesso)** do CRITICAL_FLOWS.md: após delete, admin ainda enxerga logs históricos daquela família.

- **P0-02 · M1 — `/e/$token` sem rate-limit nem cap de uso**
  - Evidência: AUDIT.md §MÉDIO/M1; `src/routes/e.$token.tsx`; `src/functions/emergency.functions.ts:21`.
  - Impacto: enumeração/abuso de tokens válidos sem custo; cada hit gera signed URLs novas.
  - Esforço: **M**.
  - Dependências: nenhuma.
  - Critério: server fn `logEmergencyAccess` rejeita >N hits por IP/janela (KV ou tabela `emergency_rate_limits`) e respeita `expires_at`/`is_active`/cap de `access_count`. Verificar com fluxo **F08 (Cartão de Emergência Público)**: 11ª request do mesmo IP em 60s retorna 429; token expirado retorna 410.

- **P0-03 · M2 — Signed URLs de PDFs com TTL 1h no payload público**
  - Evidência: AUDIT.md §MÉDIO/M2; `emergency.functions.ts:105-123`.
  - Impacto: vazamento do QR = vazamento dos PDFs por 1h.
  - Esforço: **M**.
  - Dependências: P0-02 (rate-limit deve existir antes de reduzir TTL para evitar quebra de UX legítima).
  - Critério: TTL ≤ 5 min **ou** documentos servidos por rota proxy `/api/public/emergency/$token/document/$id` que revalida token a cada request. Verificar com **F08**: copiar URL do PDF, esperar 6 min, request retorna 403.

---

## P1 — ESTABILIDADE E INTEGRIDADE

### P1-L1 · Arquitetura de autenticação e deploy

- **P1-01 · A2 — Gate de auth duplicado em 20+ rotas**
  - Evidência: AUDIT.md §ALTO/A2; 20 ocorrências de `supabase.auth.getUser().then(...)` em `useEffect` (dashboard:69, paciente.$id:178, perfil:81, etc.).
  - Esforço: **G**.
  - Dependências: nenhuma.
  - Critério: árvore movida para `src/routes/_authenticated/` com `route.tsx` gate único; rotas filhas perdem `useEffect` de auth. Verificar fluxos **F01 (Login)**, **F02 (Logout)**, **F12 (Acesso não autenticado)**: deslogado em `/dashboard` → redirect 1x para `/auth/login` sem flash de UI vazia.

- **P1-02 · A3 — Deploy preset Vercel divergente**
  - Evidência: AUDIT.md §ALTO/A3; `vite.config.ts:12`, `vercel.json`.
  - Esforço: **P** (já mitigado em turn anterior — `cloudflare_module` + `dist/`; **verificar** que `vercel.json` foi removido e `bun run build` produz `dist/_worker.js`).
  - Dependências: nenhuma.
  - Critério: `ls dist/` mostra bundle Worker; `dist-check` passa; deploy preview responde 200 em `/`.

### P1-L2 · Dashboard e dados clínicos

- **P1-03 · A4 — Race condition no dashboard ao trocar paciente**
  - Evidência: AUDIT.md §ALTO/A4; `dashboard.tsx:150-200`.
  - Esforço: **P**.
  - Dependências: nenhuma (precede P2-04 — refactor pleno para React Query).
  - Critério: flag `cancelled` ou `AbortController` no efeito. Verificar **F03 (Dashboard / Trocar Paciente)**: alternar rapidamente A→B→A não pinta dados de B em A (instrumentar console.log temporário ou verificar visualmente com latência simulada via DevTools throttling 3G).

- **P1-04 · M3 — Enums `APPOINTMENT_TYPES` divergem do CHECK do banco**
  - Evidência: AUDIT.md §MÉDIO/M3; `agenda.ts:5-12` vs migration `…170407:431`.
  - Esforço: **P**.
  - Dependências: nenhuma.
  - Critério: `agenda.ts` usa apenas `consultation|exam|return|procedure|therapy|vaccine|other`. Verificar **F05 (Criar Consulta)**: criar appointment de cada tipo sem erro 23514.

- **P1-05 · M4 — `documentos.index.tsx` faz soft delete sem `deleted_by`**
  - Evidência: AUDIT.md §MÉDIO/M4; `documentos.index.tsx:159-163`.
  - Esforço: **P**.
  - Dependências: nenhuma.
  - Critério: update inclui `deleted_by: userId`. Verificar **F07 (Excluir Documento)**: `SELECT deleted_by FROM documents WHERE id=...` retorna UUID do usuário, não NULL.

---

## P2 — PERFORMANCE E UX

### P2-L1 · Banco e queries

- **P2-01 · M5 — Falta índice composto `(patient_id, deleted_at)`**
  - Evidência: AUDIT.md §MÉDIO/M5.
  - Esforço: **P**.
  - Dependências: nenhuma.
  - Critério: migration `CREATE INDEX … (patient_id) WHERE deleted_at IS NULL` em `medications`, `appointments`, `documents`, `patient_conditions`, `patient_allergies`, `emergency_contacts`. `EXPLAIN` em `F03` mostra Index Scan, não Seq Scan + Filter.

### P2-L2 · Frontend e design system

- **P2-02 · B1 — Classes Tailwind hard-coded em `agenda.ts`**
  - Evidência: AUDIT.md §BAIXO/B1.
  - Esforço: **P**. Critério: substituir `bg-blue-100`/`bg-emerald-100` por tokens semânticos do `styles.css`; verificar visualmente em **F05**.

- **P2-03 · B2 — `og:image` apontando para domínio de preview**
  - Evidência: AUDIT.md §BAIXO/B2; `__root.tsx:90-91`.
  - Esforço: **P**. Critério: og:image apenas em rotas-folha com imagem real; remover do root. Validar com `curl https://<domain>/ | grep og:image`.

- **P2-04 · M6 — `PatientDashboard` com 6 `useState` independentes**
  - Evidência: AUDIT.md §MÉDIO/M6.
  - Esforço: **M**.
  - Dependências: P1-03 (race resolvida antes de refactor mais agressivo).
  - Critério: dashboard migrado para `useQuery` por entidade com `queryKey: ['dashboard', patientId, …]`. Verificar **F03**: trocar paciente cancela queries em voo (DevTools Network → cancelled).

### P2-L3 · Tipagem

- **P2-05 · B3 — `as string` em `familia.functions.ts`**
  - Evidência: AUDIT.md §BAIXO/B3. Esforço: **P**. Critério: tipos derivados de `Database['public']['Tables']`; `tsc --noEmit` limpo.

- **P2-06 · B4 — `search_vector` como `unknown`**
  - Evidência: AUDIT.md §BAIXO/B4. Esforço: **P**. Critério: helper tipado `searchDocuments(query: string)` encapsula a string mágica `"search_vector"` em um único ponto.

---

## P3 — OBSERVABILIDADE

### P3-L1 · LGPD e cron

- **P3-01 · Cron de purga `access_logs` >90d (item NÃO VERIFICÁVEL do AUDIT.md)**
  - Evidência: AUDIT.md §"Itens NÃO VERIFICÁVEIS"; comentário em `…170407:577`.
  - Esforço: **P**.
  - Dependências: P0-01 (FK ajustada antes do delete em massa).
  - Critério: `SELECT * FROM cron.job WHERE command ILIKE '%access_logs%'` retorna 1 linha; após 24h, `SELECT min(created_at) FROM access_logs` ≥ now()-90d.

---

## P4 — FUNCIONALIDADES (somente após P0–P1)

### P4-L1 · Visualização e offline

- **P4-01 · Visualizador `react-pdf` in-app**
  - Evidência: AUDIT.md "NÃO IMPLEMENTADO — `react-pdf` não está em `package.json`".
  - Esforço: **M**. Dependências: P0-03 (modelo de URL pública resolvido). Critério: rota `documentos.$id` renderiza PDF inline; fluxo **F06 (Visualizar Documento)** abre sem `window.open`.

- **P4-02 · PWA / Service Worker**
  - Evidência: AUDIT.md "NÃO IMPLEMENTADO".
  - Esforço: **M**. Dependências: P1-02 (preset Worker estável). Critério: `manifest.json` + `vite-plugin-pwa`; Lighthouse PWA ≥ 90; instalável em Chrome mobile.

- **P4-03 · Realtime de medicamentos/agenda**
  - Evidência: AUDIT.md "NÃO IMPLEMENTADO".
  - Esforço: **M**. Dependências: P2-04 (React Query implantado para invalidação). Critério: alterar registro em uma aba reflete em outra em <2s.

---

## Quick Wins (alto impacto, esforço P)

- **P0-01** — migration FK `cascade`/snapshot fecha trilha forense.
- **P1-02** — verificação do preset Cloudflare (já parcialmente feito).
- **P1-04** — alinhar enums elimina classe inteira de falhas silenciosas em criar consulta.
- **P1-05** — adicionar `deleted_by` em `documentos.index.tsx` (1 linha).
- **P2-01** — índices parciais entregam ganho de query mensurável.
- **P3-01** — declarar o cron promised na migration.

## Linha Crítica

```
P0-02 ──► P0-03            (rate-limit antes de cortar TTL)
P1-01 ──► P2-04 ──► P4-03  (gate único → React Query → realtime)
P0-01 ──► P3-01            (FK ajustada antes do cron de purga)
P1-02 ──► P4-02            (preset Worker antes de PWA)
P1-03 ──► P2-04            (race fix antes de refactor profundo)
P0-03 ──► P4-01            (modelo de URL resolvido antes do viewer)
```

## Totais

- Fases ativas: **5** (P0, P1, P2, P3, P4).
- Itens: **17** (P0:3 · P1:5 · P2:6 · P3:1 · P4:3).
- Lotes: **8** (P0-L1 · P1-L1 · P1-L2 · P2-L1 · P2-L2 · P2-L3 · P3-L1 · P4-L1).
- Cobertura do AUDIT.md: A1, A2, A3, A4, M1, M2, M3, M4, M5, M6, B1, B2, B3, B4 + 3 NÃO IMPLEMENTADOS + 1 NÃO VERIFICÁVEL. B5 (3 `console.error` isolados) e itens NÃO VERIFICÁVEIS de natureza puramente operacional (métricas runtime, lint em pipeline) não geraram item — não são problemas, são checagens.
