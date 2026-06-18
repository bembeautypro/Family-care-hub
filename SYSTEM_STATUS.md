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

## Nota de Prontidão: **8.8/10**

(P0-L1 + P1-L1 + P1-L2 + P2-L1 + P2-L3 fechados.)

## Riscos Abertos

### CRÍTICO / ALTO
Nenhum.

### MÉDIO
- **M6** — `PatientDashboard` com 6 `useState`; refator React Query pendente (P2-L2).

### BAIXO
Nenhum.

### Dívida residual
- `useEffect` redundante de `supabase.auth.getUser()` em rotas filhas.
- `search_vector` aparece como `unknown` em `types.ts` (arquivo auto-gerado pelo Lovable Cloud — não editável). Sem impacto em runtime: `textSearch("search_vector", ...)` recebe o nome da coluna como string literal e funciona normalmente.

### Fechados neste lote (P2-L3)
- ✅ **B3** — Removidos 13 `as string` em `familia.functions.ts`. Adicionados null-guards para `inv.family_id/role/invited_by/id` em `acceptInvitation` e para `targetMember.family_id` em `changeMemberRole`/`removeMember`.
- ✅ **B4** — Classificado como dívida documentada (tipo auto-gerado, sem impacto funcional). Ver Dívida residual.

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Deploy real em Cloudflare Workers.

## Última Atualização

2026-06-18 — Etapa: **P2-L3 concluído** (B3, B4). Próximo lote: **P2-L2** (M6 React Query refactor) ou avançar para P3.
