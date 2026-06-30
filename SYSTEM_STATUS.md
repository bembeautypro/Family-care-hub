# SYSTEM_STATUS

## Estado Atual

- Build: ✅ `bun run build` ~7.5s, preset `cloudflare_module`, sem erros.
- Código: 116 arquivos TS/TSX, 29 rotas (28 páginas + 2 endpoints `/api/public/*`).
- Banco: 18 tabelas, RLS=true em todas, 49 policies (`pg_policies`), 7 índices parciais clínicos.
- Cron jobs ativos (`cron.job`): `purge-access-logs-90d` (03:15 UTC), `purge-emergency-rate-limits-1d` (03:20 UTC), `send-medication-reminders-5min`.
- Gate único de auth: `src/routes/_authenticated/route.tsx` (`ssr:false`).
- Server fns: `createServerFn` + `supabaseAdmin` lazy-loaded; emergência com rate-limit, cap 1000, signed URLs TTL 300s.
- `access_logs` com snapshots forenses + trigger.
- Dashboard com React Query (7 `useQuery`) + Realtime em 3 canais + `AbortSignal`.
- Visualizador PDF inline em `documentos/$id` (`ssr:false`, `react-pdf` lazy 777kB chunk).
- PWA: manifest + ícones + `public/sw.js` para Web Push VAPID artesanal (compatível com Worker).
- Push pipeline: VAPID JWT ES256 + AES-128-GCM em `src/lib/push.server.ts`; webhook `dose-action` com JWT HS256.
- Tipagem limpa em código autoral; `as any` apenas em `routeTree.gen.ts` (auto-gerado).
- Tokens semânticos de cor; sem `og:image` global no root.

## Nota de Prontidão: **9/10**

P0 fechado: A1, A2, A3 resolvidos.

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
Nenhum (todos os ALTOS anteriores resolvidos).

### MÉDIO
- **M1** Webhook `dose-action` sem idempotência por `jti` — risco de doses duplicadas em reenvio.
- **M2** `pdfjs-dist` 777kB emitido em `dist/server/_libs/` mesmo com rota `ssr:false`.
- **M3** `dashboard.tsx` com 928 linhas — extrair os 6 blocos para componentes.
- **M4** `src/functions/emergency.functions.ts` fora do padrão `src/lib/*.functions.ts`.

### Resolvidos nesta rodada (P0)
- **A1 → fechado**: webhook `/api/public/hooks/send-medication-reminders` agora exige `apikey` (publishable key) com compare timing-safe; cron reagendado com header.
- **A2 → fechado**: `/e/$token` exibe tela de confirmação antes de carregar payload clínico; signed URLs só são geradas após clique humano.
- **A3 → fechado**: `access_logs.family_id_snapshot` agora é `NOT NULL` no schema (backfill aplicado); auditoria forense não pode mais ser silenciosamente quebrada por trigger contornado.


### BAIXO
- **B1** `search_vector` tipado como `unknown` em `types.ts` (auto-gerado).
- **B2** Service worker sem estratégia offline / cache de assets.
- **B3** `emergency_links.expires_at` nullable (default sem TTL); rotação só manual.
- **B4** Linter Supabase: WARN 0014 (pg_cron/pg_net em public), WARN 0029 (3 funções SECURITY DEFINER) — padrão da plataforma, documentado.

### Não verificável sem operador
- Push real chegando ao device (requer HTTPS público + PWA).
- Cron de purga efetivamente removendo linhas antigas (precisa ≥1 ciclo).
- Bundle real do Worker (`wrangler deploy --dry-run` + medir).
- Lighthouse PWA score.
- Typecheck CI (`bunx tsgo --noEmit` não rodado nesta auditoria).
- Vazamento entre famílias por teste empírico com 2 contas.

## Última Atualização

2026-06-30 — **P0 completo** (A1+A2+A3). Webhook autenticado por apikey, gate de confirmação no cartão público, snapshot forense agora NOT NULL. **Nota: 9/10**.

