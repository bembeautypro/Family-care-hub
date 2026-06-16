# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa em ~8s sem erros.
- Banco: 15 tabelas (+`emergency_rate_limits`), RLS habilitada em todas, GRANTs corretos.
- Server functions: `logEmergencyAccess` agora com rate-limit (10 hits/IP/60s), cap de `access_count` (1000), signed URLs com TTL 300s.
- `access_logs`: snapshots `family_id_snapshot`/`patient_id_snapshot` preservam trilha forense mesmo após exclusão de paciente/família; policy de leitura usa snapshot.
- Não implementado: PWA/SW, Realtime, visualizador `react-pdf`, cron de purga LGPD.

## Nota de Prontidão: **7/10**

(P0-L1 fechado: nenhum vetor público de emergência ou perda forense conhecido. P1 ainda pendente.)

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
- **A2** — 20+ rotas privadas re-implementam gate de auth via `useEffect + supabase.auth.getUser()`.
- **A3** — Preset Cloudflare aplicado, mas requer validação em deploy real (item P1-02).
- **A4** — Race condition em `dashboard.tsx:150-200` ao trocar paciente.

### MÉDIO
- **M3** — Enums `APPOINTMENT_TYPES` no front divergem do CHECK do banco.
- **M4** — `documentos.index.tsx:159-163` faz soft-delete sem `deleted_by`.
- **M5** — Índices compostos `(patient_id, deleted_at)` faltam fora de `clinical_events`.
- **M6** — `PatientDashboard` com 6 `useState` independentes; refator para React Query pendente.

### BAIXO
- **B1** — Classes Tailwind hard-coded em `agenda.ts`.
- **B2** — `og:image` em `__root.tsx` aponta para URL de preview.
- **B3** — `as string` em `familia.functions.ts`.
- **B4** — `search_vector` tipado como `unknown`.

### Fechados neste lote
- ✅ **A1** — `access_logs` agora preserva `family_id_snapshot`/`patient_id_snapshot`; policy lê via snapshot. Trilha forense íntegra após delete.
- ✅ **M1** — `/e/$token` com rate-limit por IP (10/60s) + cap de uso (1000 acessos/link).
- ✅ **M2** — Signed URLs de PDFs com TTL 300s (era 3600s).

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d) — pendente em P3-L1.
- Métricas runtime, reuso de tokens em produção, lint em pipeline.

## Última Atualização

2026-06-16 — Etapa: **P0-L1 concluído** (A1, M1, M2). Próximo lote recomendado: **P1-L1** (A2 mover rotas para `_authenticated/`; A3 validar preset em deploy).
