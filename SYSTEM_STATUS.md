# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` passa em ~11s sem erros nem warnings.
- Banco: 14 tabelas, RLS habilitada em todas, GRANTs corretos, bucket privado configurado.
- Server functions: 8 server fns implementadas com `requireSupabaseAuth` e/ou `supabaseAdmin`. Nenhuma Edge Function Supabase.
- Cobertura funcional: cadastro, login, onboarding 3-etapas, dashboard, medicamentos CRUD, agenda CRUD, histórico clínico, documentos com FTS server-side, família com convites/papéis, cartão de emergência público com log.
- Não implementado: PWA/SW, Realtime, visualizador `react-pdf`, cron de purga LGPD.

## Nota de Prontidão: **6/10**

(Rubrica: sem CRÍTICOS; existem ALTOS em estabilidade e integridade forense.)

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
- **A1** — `access_logs.patient_id` e `family_id` `ON DELETE SET NULL` apagam a trilha forense em deleção hard de paciente (migration `…170407_…sql:580,583`).
- **A2** — 20+ rotas privadas re-implementam gate de auth via `useEffect + supabase.auth.getUser()`; não há subtree `_authenticated/` da TanStack.
- **A3** — Deploy preset Vercel (`vite.config.ts:12`, `vercel.json`) divergente da stack obrigatória "Cloudflare Workers / Lovable Cloud".
- **A4** — Race condition em `dashboard.tsx:150-200`: troca de paciente sem cancelar requisição em voo pode pintar dados do paciente anterior.

### MÉDIO
- **M1** — `/e/$token` sem rate-limit nem CAPTCHA; enumeração de tokens viável sem custo (`emergency.functions.ts`).
- **M2** — Cartão público devolve signed URLs de PDFs com TTL 1h embutidas no JSON (`emergency.functions.ts:105-123`).
- **M3** — Enums `APPOINTMENT_TYPES` no front (`physiotherapy`, `vaccination`) divergem do CHECK do banco (`therapy`, `vaccine`) — `agenda.ts:5-12` vs migration `…170407:431`.
- **M4** — `documentos.index.tsx:159-163` faz soft-delete sem registrar `deleted_by`; restante do app sempre registra.
- **M5** — Índices compostos `(patient_id, deleted_at)` só existem para `clinical_events`; demais tabelas dependem de filtro em memória conforme volume cresce.
- **M6** — `PatientDashboard` em `dashboard.tsx` usa 6 `useState` independentes + efeito gigante; refator para React Query traria cancelamento automático e dedupe.

### BAIXO
- **B1** — Classes Tailwind hard-coded em `agenda.ts` (não usam tokens semânticos).
- **B2** — `og:image` em `__root.tsx:90-91` aponta para URL de preview Lovable.
- **B3** — Diversos `as string` em `familia.functions.ts`.
- **B4** — `search_vector` tipado como `unknown` força string mágica no `textSearch`.

### Itens não verificáveis sem operador
- Cron pg_cron de purga de `access_logs` (>90d).
- Métricas de runtime (cold start, bundle real, memória).
- Reuso/entropia real de tokens em produção.
- Lint frontend e typecheck em pipeline.

## Última Atualização

2026-06-15 — Etapa: **auditoria inicial somente leitura**. Nenhum código, migração ou config alterado.
