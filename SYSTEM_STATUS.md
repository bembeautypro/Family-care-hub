# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa (Cloudflare Worker preset).
- Banco: 15 tabelas, RLS habilitada, GRANTs corretos.
- Rotas privadas centralizadas em `src/routes/_authenticated/`.
- Server functions: `logEmergencyAccess` com rate-limit, cap 1000, signed URLs TTL 300s.
- `access_logs` com snapshots forenses.
- Dashboard sem race condition ao trocar paciente.
- Enums `appointments.type` alinhados front↔DB.
- Soft delete em documentos com `deleted_by`.
- Índices parciais `(patient_id) WHERE deleted_at IS NULL` em 6 tabelas clínicas.
- Status de agendamento usando tokens semânticos.
- Root sem `og:image` global.
- `familia.functions.ts` sem `as string` — tipagem inferida + null-guards explícitos.
- `PatientDashboard` migrado para React Query (7 `useQuery` keyed por `patientId`) com cancelamento via `abortSignal`.
- Visualizador PDF inline em `documentos/$id` via `react-pdf` (worker pdfjs via CDN), com fallback `window.open`.
- Manifest PWA + ícones 192/512 + apple-touch-icon: app instalável em Chrome mobile.
- Realtime habilitado em `medications`, `appointments`, `medication_doses`; dashboard assina por `patient_id` e invalida queries.

## Nota de Prontidão: **9.4/10**

(P0-L1 + P1-L1 + P1-L2 + P2-L1 + P2-L2 + P2-L3 + P4-L1 fechados.)

## Riscos Abertos

### CRÍTICO / ALTO
Nenhum.

### MÉDIO
Nenhum.

### BAIXO
Nenhum.

### Dívida residual
- `useEffect` redundante de `supabase.auth.getUser()` em rotas filhas.
- `search_vector` aparece como `unknown` em `types.ts` (auto-gerado).
- PWA é manifest-only (sem service worker / offline) — conforme orientação do skill PWA da plataforma: SW só quando offline for explicitamente solicitado.

### Fechados neste lote (P4-L1)
- ✅ **P4-01** — `react-pdf@10` instalado. Nova rota `src/routes/_authenticated/documentos.$id.tsx` renderiza PDFs inline com paginação, imagens inline para mimes `image/*`, e fallback "Abrir externamente" para outros tipos ou falha de renderização. Lista de documentos navega para a rota em vez de `window.open`.
- ✅ **P4-02** — `public/manifest.webmanifest` + `icon-192.png` / `icon-512.png` (maskable) / `apple-touch-icon.png`. Tags em `__root.tsx`: `manifest`, `theme-color`, `apple-mobile-web-app-*`. Sem service worker (skill PWA: SW só com pedido explícito de offline).
- ✅ **P4-03** — Migration adiciona `medications`, `appointments`, `medication_doses` à publicação `supabase_realtime` com `REPLICA IDENTITY FULL`. Dashboard abre canal `dashboard:${pid}` em `useEffect` com cleanup via `supabase.removeChannel`, filtrando por `patient_id` e invalidando as queryKeys correspondentes.

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Deploy real em Cloudflare Workers.
- Lighthouse PWA score (precisa do app publicado).

## Última Atualização

2026-06-24 — Etapa: **P4-L1 concluído** (react-pdf, PWA manifest, Realtime). Pendente: **P3-L1** (cron LGPD).


