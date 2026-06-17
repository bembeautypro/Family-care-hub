# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa em ~8s. `dist/server/index.mjs` (Worker entry) + `dist/public/` gerados pelo preset `cloudflare_module`. `wrangler.json` emitido.
- Banco: 15 tabelas (+`emergency_rate_limits`), RLS habilitada em todas, GRANTs corretos.
- Rotas: 17 rotas protegidas movidas para `src/routes/_authenticated/` (folder convention) com gate único `route.tsx` (`ssr: false`, `beforeLoad` → `supabase.auth.getUser()` → `redirect /auth/login`). Públicas mantidas no topo: `/`, `/auth/login`, `/auth/registro`, `/e/$token`, `/convite/$token`.
- Server functions: `logEmergencyAccess` com rate-limit (10 hits/IP/60s), cap (1000), signed URLs TTL 300s.
- `access_logs`: snapshots `family_id_snapshot`/`patient_id_snapshot`; trilha forense preservada após delete.
- Não implementado: PWA/SW, Realtime, visualizador `react-pdf`, cron de purga LGPD.

## Nota de Prontidão: **7.5/10**

(P0-L1 + P1-L1 fechados. Gate de auth centralizado, deploy preset Cloudflare validado em build local. Falta validar em deploy real.)

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
- **A4** — Race condition em `_authenticated/dashboard.tsx:150-200` ao trocar paciente.

### MÉDIO
- **M3** — Enums `APPOINTMENT_TYPES` no front divergem do CHECK do banco.
- **M4** — `_authenticated/documentos.index.tsx:159-163` faz soft-delete sem `deleted_by`.
- **M5** — Índices compostos `(patient_id, deleted_at)` faltam fora de `clinical_events`.
- **M6** — `PatientDashboard` com 6 `useState` independentes; refator para React Query pendente.

### BAIXO
- **B1** — Classes Tailwind hard-coded em `agenda.ts`.
- **B2** — `og:image` em `__root.tsx` aponta para URL de preview.
- **B3** — `as string` em `familia.functions.ts`.
- **B4** — `search_vector` tipado como `unknown`.

### Dívida residual (não bloqueia, mas merece limpeza)
- Rotas filhas ainda contêm `supabase.auth.getUser()` em `useEffect` para carregar perfil/checar onboarding. O redirect-para-login virou redundante (gate do `_authenticated` já barrou). Não removido neste lote porque o mesmo `useEffect` também faz fetch de profile/onboarding-step — exigiria refactor para `useQuery` (escopo P2-L2/M6).

### Fechados neste lote (P1-L1)
- ✅ **A2** — 17 rotas privadas centralizadas em `src/routes/_authenticated/`; gate único em `_authenticated/route.tsx`. Verificar visualmente fluxos **F01/F02/F12**: deslogado em `/dashboard` → redirect para `/auth/login?redirect=...`.
- ✅ **A3** — Preset Cloudflare validado: `bun run build` produz `dist/server/index.mjs` + `dist/public/` + `wrangler.json`. `vercel.json` removido. Aguarda validação em deploy real (publish).

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Métricas runtime, deploy real em Cloudflare Workers.

## Última Atualização

2026-06-17 — Etapa: **P1-L1 concluído** (A2, A3). Próximo lote recomendado: **P1-L2** (A4 race condition no dashboard; M3 enums; M4 `deleted_by`).

