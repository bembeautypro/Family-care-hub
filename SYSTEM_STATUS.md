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

## Nota de Prontidão: **9.0/10**

(P0-L1 + P1-L1 + P1-L2 + P2-L1 + P2-L2 + P2-L3 fechados.)

## Riscos Abertos

### CRÍTICO / ALTO
Nenhum.

### MÉDIO
Nenhum.

### BAIXO
Nenhum.

### Dívida residual
- `useEffect` redundante de `supabase.auth.getUser()` em rotas filhas.
- `search_vector` aparece como `unknown` em `types.ts` (arquivo auto-gerado pelo Lovable Cloud — não editável). Sem impacto em runtime: `textSearch("search_vector", ...)` recebe o nome da coluna como string literal e funciona normalmente.

### Fechados neste lote (P2-L2)
- ✅ **M6** — `PatientDashboard` refatorado para React Query: cada entidade (appointments, medications, events, documents, allergies, contacts, doses) virou `useQuery` com `queryKey: ['dashboard', kind, patientId]` e `.abortSignal(signal)`. Trocar paciente cancela queries em voo automaticamente. `MedicationRow` recebe `invalidateDoses` no lugar do `loadDoses` manual.
- ✅ **B1** — já fechado em lote anterior (tokens semânticos em `agenda.ts`).
- ✅ **B2** — já fechado em lote anterior (sem `og:image` global no root).

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Deploy real em Cloudflare Workers.

## Última Atualização

2026-06-24 — Etapa: **P2-L2 concluído** (M6). Próximo lote: **P3-L1** (cron LGPD) ou **P4-L1** (visualizador react-pdf, PWA, Realtime).

