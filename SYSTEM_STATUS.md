# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa em ~8s (Cloudflare Worker preset).
- Banco: 15 tabelas, RLS habilitada em todas, GRANTs corretos.
- Rotas privadas centralizadas em `src/routes/_authenticated/` (gate único `route.tsx`, `ssr: false`).
- Server functions: `logEmergencyAccess` com rate-limit (10/IP/60s), cap 1000, signed URLs TTL 300s.
- `access_logs` com snapshots forenses (`family_id_snapshot`, `patient_id_snapshot`).
- Dashboard: fetch protegido contra race condition ao trocar paciente.
- Enums `appointments.type` alinhados front↔DB (`therapy`, `vaccine`).
- Soft delete em documentos com `deleted_by` preenchido.

## Nota de Prontidão: **8/10**

(P0-L1 + P1-L1 + P1-L2 fechados. Falta validar deploy real e refinar Quick Wins de P2.)

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
Nenhum (A4 fechado).

### MÉDIO
- **M5** — Índices compostos `(patient_id, deleted_at)` faltam fora de `clinical_events`.
- **M6** — `PatientDashboard` com 6 `useState`; refator para React Query pendente (P2/P4).

### BAIXO
- **B1** — Classes Tailwind hard-coded em `agenda.ts`.
- **B2** — `og:image` em `__root.tsx` aponta para URL de preview.
- **B3** — `as string` em `familia.functions.ts`.
- **B4** — `search_vector` tipado como `unknown`.

### Dívida residual
- `useEffect` redundante de `supabase.auth.getUser()` em rotas filhas (cleanup em P2-L2/M6).

### Fechados neste lote (P1-L2)
- ✅ **A4** — `PatientDashboard` (`_authenticated/dashboard.tsx`) agora usa flag `cancelled` no efeito de fetch, com reset de estado ao trocar paciente. Sem sobrescrita de dados de paciente anterior.
- ✅ **M3** — `src/lib/agenda.ts` enums realinhados: `physiotherapy`→`therapy`, `vaccination`→`vaccine` (compatível com CHECK do banco).
- ✅ **M4** — Confirmado: `_authenticated/documentos.index.tsx:156-173` já grava `deleted_by` no soft delete (auditoria preservada).

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Deploy real em Cloudflare Workers.

## Última Atualização

2026-06-17 — Etapa: **P1-L2 concluído** (A4, M3, M4). Próximo lote recomendado: **P2-L1** (M5 índices, B1 tokens, B2 og:image).
