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
- Status de agendamento usando tokens semânticos (sem hard-coded Tailwind).
- Root sem `og:image` global (leaf routes podem definir o próprio).

## Nota de Prontidão: **8.5/10**

(P0-L1 + P1-L1 + P1-L2 + P2-L1 fechados.)

## Riscos Abertos

### CRÍTICO / ALTO
Nenhum.

### MÉDIO
- **M6** — `PatientDashboard` com 6 `useState`; refator React Query pendente (P2-L2).

### BAIXO
- **B3** — `as string` em `familia.functions.ts`.
- **B4** — `search_vector` tipado como `unknown`.

### Dívida residual
- `useEffect` redundante de `supabase.auth.getUser()` em rotas filhas.

### Fechados neste lote (P2-L1)
- ✅ **M5** — 6 índices parciais criados (medications, appointments, documents, patient_conditions, patient_allergies, emergency_contacts).
- ✅ **B1** — `src/lib/agenda.ts` agora usa `bg-accent-soft|success-soft|alert-soft|warn-soft` (tokens do design system Cuida).
- ✅ **B2** — `og:image` e `twitter:image` removidos do `__root.tsx` (apontavam para domínio de preview).

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Deploy real em Cloudflare Workers.

## Última Atualização

2026-06-18 — Etapa: **P2-L1 concluído** (M5, B1, B2). Próximo lote: **P2-L2** (M6 React Query refactor) ou **P2-L3** (B3, B4 tipagem).
