# REAUDIT — Amparo (TanStack Start + Supabase)

Data: 2026-06-26 · Modo: somente leitura · Base: AUDIT.md + SYSTEM_STATUS.md + RECOVERY_ROADMAP.md

---

## 1. Verificação Item-a-Item P0 e P1

### P0 — Bloqueadores

#### A1 · Snapshots forenses em `access_logs` — **CONFIRMADO**

- `supabase/migrations/20260616162446_22623fda…sql:6-7` — colunas `family_id_snapshot uuid` e `patient_id_snapshot uuid` adicionadas via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- Mesma migration, linhas seguintes — backfill executado: `UPDATE public.access_logs SET family_id_snapshot = COALESCE(…)`.
- Trigger `public.access_logs_set_snapshots()` criada (SECURITY DEFINER, search_path=public); trigger `access_logs_set_snapshots_trg BEFORE INSERT` registrada.
- Policy `"members can read own family access_logs"` substituída: `USING (family_id_snapshot IS NOT NULL AND public.is_family_member(family_id_snapshot))` — lê via snapshot, sobrevive a `SET NULL` na FK original.
- ✅ Todos os três sub-requisitos (colunas, trigger, policy via snapshot) estão presentes.

#### M1 · Rate-limit endpoint `/e/$token` — **CONFIRMADO**

- `src/functions/emergency.functions.ts:13-15` — constantes `RATE_LIMIT_WINDOW_SECONDS = 60`, `RATE_LIMIT_MAX_HITS = 10`, `ACCESS_COUNT_HARD_CAP = 1000`.
- Linhas 24-50 — lógica completa: busca `hits` em `emergency_rate_limits` para `(ip_address, window_start)`, retorna `RATE_LIMITED` se `hits >= 10`, faz `upsert` incrementando o contador.
- Tabela `emergency_rate_limits` declarada em `20260616162446_22623fda…sql:50-63`.
- Cap de 1000 acessos verificado em `emergency.functions.ts:62-65`.
- ✅ 10 hits/60 s, tabela, cap 1000 — todos presentes.

#### M2 · TTL signed URL = 300 s — **CONFIRMADO**

- `src/functions/emergency.functions.ts:16` — `const SIGNED_URL_TTL_SECONDS = 300; // P0-03 (M2): was 3600`.
- Constante usada diretamente em `createSignedUrl(doc.file_path, SIGNED_URL_TTL_SECONDS)` na linha de geração.
- ✅ TTL reduzido de 3600 → 300 s.

---

### P1 — Estabilidade e Integridade

#### A2 · Layout `_authenticated/` com gate único — **INCOMPLETO (parcial)**

- `src/routes/_authenticated/route.tsx:8-20` — `ssr: false`, `beforeLoad` com `supabase.auth.getUser()`, `throw redirect({ to: "/auth/login" })` centralizado. Estrutura correta.
- `src/routes/_authenticated/` contém 19 arquivos de rota privada (dashboard, paciente, medicamentos, agenda, documentos, historico, familia, emergencia, perfil, onboarding/*, etc.) — todas sob o layout.
- **Porém:** `src/routes/_authenticated/dashboard.tsx:93-97` ainda possui `useEffect` com `getUser()` + `navigate({ to: "/auth/login" })` redundante. O critério de P1-01 ("rotas filhas perdem `useEffect` de auth") não foi cumprido integralmente nesta rota.
- O `useEffect` faz dupla função (carrega perfil + redireciona onboarding), mas o ramo `navigate("/auth/login")` é redundante e gera double-redirect teórico. SYSTEM_STATUS.md registra como "dívida residual aceita".
- ⚠️ Gate centralizado funcional; redirect duplicado residual em `dashboard.tsx`.

#### A3 · Deploy preset Cloudflare — **CONFIRMADO**

- `vite.config.ts:11` — `nitro({ preset: "cloudflare_module", output: { dir: "./dist" } })`.
- `vercel.json` — **não existe** na raiz do projeto.
- ✅ Preset Cloudflare, sem artefato Vercel.

#### A4 · Race condition no dashboard — **CONFIRMADO**

- `src/routes/_authenticated/dashboard.tsx:3` — `import { useQuery, useQueryClient } from "@tanstack/react-query"`.
- Linhas 173-277 — 7 chamadas `useQuery` com `queryKey: ["appointments"|"medications"|…, activeId]`, cada uma passando `abortSignal: signal` ao Supabase client (ex.: linha 185 `.abortSignal(signal)`).
- TanStack Query cancela queries em voo automaticamente ao mudar o `queryKey` (troca de paciente).
- ✅ Race condition eliminada via React Query + `abortSignal`.

#### M3 · Enums `appointments.type` alinhados — **CONFIRMADO**

- `src/lib/agenda.ts:5-12` — valores: `consultation`, `exam`, `return`, `procedure`, `therapy`, `vaccine`, `other`. Sem `physiotherapy` ou `vaccination`.
- CHECK constraint do banco (migration `…170407:431`) aceita exatamente esses 7 valores.
- ✅ Front ↔ DB alinhados.

#### M4 · `deleted_by` em soft delete de documentos — **CONFIRMADO**

- `src/routes/_authenticated/documentos.index.tsx:157-158`:
  ```ts
  deleted_at: new Date().toISOString(),
  deleted_by: u.user?.id ?? null,
  ```
- Ambos os campos presentes no update.
- ✅ Trilha de auditoria preservada.

---

## 2. Regressões Introduzidas

### R1 · `supabaseAdmin` em module scope em todos os `*.functions.ts` — **PRÉ-EXISTENTE, não nova regressão**

- `src/functions/emergency.functions.ts:4`, `src/lib/familia.functions.ts:5`, `src/lib/onboarding.functions.ts:5`, `src/lib/perfil.functions.ts:5` — todos importam `supabaseAdmin` no topo do módulo, fora do `handler`.
- Era assim antes das correções (citado em AUDIT.md §Arquitetura). As correções P0–P1 não introduziram nem removeram esse padrão.
- Risco real: se o bundler incluir esse módulo no bundle cliente, `SUPABASE_SERVICE_ROLE_KEY` vaza. Mitigação: `createServerFn` marca o arquivo como server-only; TanStack Start faz tree-shake correto em `cloudflare_module`. Não é regressão nova — é dívida arquitetural preexistente.

### R2 · Redirect duplicado em `dashboard.tsx` — **REGRESSÃO LEVE (dívida declarada)**

- `src/routes/_authenticated/dashboard.tsx:93-97` — useEffect com `navigate("/auth/login")` é redundante após a criação do gate `_authenticated/route.tsx`. Qualquer usuário não autenticado que chegue a este componente já teria sido redirecionado pelo `beforeLoad`.
- Não causa falha funcional (o redirect do `beforeLoad` ocorre primeiro em SSR-off), mas viola o princípio de "single source of truth" para auth que P1-01 pretendia estabelecer.
- Reconhecido em SYSTEM_STATUS.md como dívida residual aceita.

### R3 · Sem imports quebrados, sem `any` adicionado

- Verificado em `emergency.functions.ts`, `route.tsx`, `dashboard.tsx`, `agenda.ts`, `documentos.index.tsx` — zero ocorrências de `: any` ou `as any` nesses arquivos.
- Nenhuma server function sem `requireSupabaseAuth` encontrada onde seria obrigatório (as server fns usam `supabaseAdmin` com validações internas, não o padrão `requireSupabaseAuth`).

---

## 3. Itens Não Verificáveis Estaticamente

| Item | SQL / Passos para verificar |
|---|---|
| Cron LGPD ativo? | `SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'purge%';` — espera-se `purge-access-logs-90d` (03:15 UTC) e `purge-emergency-rate-limits-1d` (03:20 UTC) |
| Realtime publication | `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` — espera-se `medications`, `appointments`, `medication_doses` |
| Bucket `medical-documents` privado | Supabase Dashboard → Storage → `medical-documents` → Public: false; ou `SELECT id, public FROM storage.buckets WHERE id = 'medical-documents';` |
| Deploy real Cloudflare | Publicar, checar `curl -I https://<dominio>/` retorna 200; testar cold start < 50 ms |
| Lighthouse PWA | App publicado → DevTools Lighthouse → PWA category; manifest declarado mas sem service worker → score PWA limitado |

---

## 4. Nota de Prontidão Recalculada

SYSTEM_STATUS.md declara **9.6/10**. Esta re-auditoria confirma:

**Positivos:** todos os 8 itens P0/P1 verificados são funcionalmente resolvidos (A1, M1, M2, A3, A4, M3, M4 — CONFIRMADOS; A2 estruturalmente correto). Enums alinhados, TTL reduzido, snapshots forenses, gate centralizado, React Query com abortSignal.

**Descontos:** A2 parcialmente incompleto (redirect redundante em `dashboard.tsx`); `supabaseAdmin` em module scope (risco arquitetural preexistente); sem service worker (PWA manifest-only); cron e realtime não verificáveis estaticamente.

**Nota recalibrada: 8.8/10.** O gap de 0.8 reflete: (−0.3) dívida residual A2 não totalmente fechada, (−0.3) `supabaseAdmin` em module scope em todos os handlers, (−0.2) itens não verificáveis críticos (cron LGPD, deploy real). Nenhum bloqueia beta fechado.

---

## Veredito Final

**RETORNAR À EXECUÇÃO** — com escopo mínimo:

1. **`dashboard.tsx:93-97`** — remover o ramo `navigate("/auth/login")` do useEffect (manter apenas a carga de perfil e redirect de onboarding). Fecha A2 completamente.
2. *(Opcional/Recomendado)* Mover import de `supabaseAdmin` para dentro do `handler` em `emergency.functions.ts` — elimina risco teórico de bundle leak.

Após esses dois ajustes, todos os itens P0/P1 estarão **CONFIRMADOS sem ressalvas** e o projeto estará **APTO PARA DOCUMENTAÇÃO E DEPLOY**.
