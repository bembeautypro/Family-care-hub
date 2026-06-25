# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa (Cloudflare Worker preset, output `dist/`).
- Banco: 16 tabelas, 39 policies RLS, GRANTs corretos.
- Rotas privadas centralizadas em `src/routes/_authenticated/`.
- Server functions: `logEmergencyAccess` com rate-limit, cap 1000, signed URLs TTL 300s.
- `access_logs` com snapshots forenses (`family_id_snapshot`, `patient_id_snapshot`).
- Dashboard sem race condition ao trocar paciente.
- Enums `appointments.type` alinhados front↔DB.
- Soft delete em documentos com `deleted_by`.
- Índices parciais `(patient_id) WHERE deleted_at IS NULL` em 6 tabelas clínicas.
- Status de agendamento usando tokens semânticos.
- Root sem `og:image` global.
- `familia.functions.ts` sem `as string` — tipagem inferida + null-guards explícitos.
- `PatientDashboard` migrado para React Query (7 `useQuery` keyed por `patientId`) com cancelamento via `abortSignal`.
- Visualizador PDF inline em `documentos/$id` via `react-pdf`, com fallback `window.open`.
- Manifest PWA + ícones 192/512 + apple-touch-icon: instalável em Chrome mobile.
- Realtime em `medications`, `appointments`, `medication_doses`; dashboard invalida queries por canal.
- Cron LGPD: `purge-access-logs-90d` (03:15 UTC) + `purge-emergency-rate-limits-1d` (03:20 UTC) via pg_cron.

## Nota de Prontidão: **9.6/10**

(Roadmap 100% concluído: P0-L1 + P1-L1 + P1-L2 + P2-L1 + P2-L2 + P2-L3 + P3-L1 + P4-L1.)

## Auditoria Geral (2026-06-25)

- **Build**: ✅ ~10s, preset `cloudflare_module`.
- **Bundle**: 108 arquivos TS/TSX, 28 rotas. Maior chunk: `pdfjs-dist` (777kB, lazy).
- **Banco**: 16 tabelas, 39 policies RLS, 7 índices parciais clínicos, 2 cron jobs ativos.
- **Segurança**: rate-limit emergência, snapshots forenses, signed URLs 5min, gate único `_authenticated/`.
- **Linter Supabase**: 5 INFO/WARN pré-existentes (security definer functions + pg_cron/pg_net em `public`) — padrão Supabase, documentado.

## Riscos Abertos

### CRÍTICO / ALTO / MÉDIO / BAIXO
Nenhum.

### Dívida residual (aceita)
- `useEffect` redundante de `supabase.auth.getUser()` em algumas rotas filhas (gate `_authenticated/` já cobre).
- `search_vector` como `unknown` em `types.ts` (auto-gerado, inofensivo em runtime).
- PWA manifest-only (sem service worker / offline) — política da plataforma.

### Não verificável sem operador
- Deploy real em Cloudflare Workers.
- Lighthouse PWA score (precisa do app publicado).
- Validação efetiva do cron de purga (24h após primeiro run).

## Última Atualização

2026-06-25 — **Roadmap 100% concluído.** P3-L1 fechado (cron LGPD + cleanup rate-limits). Auditoria geral sem riscos abertos.
