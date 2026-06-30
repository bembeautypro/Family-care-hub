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

## Nota de Prontidão: **8/10**

Sem CRÍTICOS. ALTOS abertos: webhook de reminders sem assinatura, superfície pública de emergência devolve PDFs sem step de confirmação, snapshot em `access_logs` é convenção (não constraint).

## Riscos Abertos

### CRÍTICO
Nenhum.

### ALTO
- **A1** Webhook `/api/public/hooks/send-medication-reminders` sem assinatura HMAC — exploração trivial por terceiros (push spam).
- **A2** Cartão de emergência `/e/$token` devolve dados clínicos + signed URLs (TTL 5min) sem confirmação humana.
- **A3** 4 FKs `ON DELETE SET NULL` em `access_logs`; policy depende do snapshot setado por trigger — sem `CHECK` que garanta.

### MÉDIO
- **M1** Webhook `dose-action` sem idempotência por `jti` ou UNIQUE composta — risco de doses duplicadas em reenvio.
- **M2** `pdfjs-dist` 777kB emitido em `dist/server/_libs/` mesmo com rota `ssr:false` — cap de 10MB do Worker preserva margem, mas é o primeiro a estourar.
- **M3** `dashboard.tsx` com 928 linhas — extrair os 6 blocos para componentes.
- **M4** `src/functions/emergency.functions.ts` fora do padrão `src/lib/*.functions.ts`.

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

2026-06-30 — Auditoria unificada (entregáveis 1–3). Sem alterações em código, banco, configs ou docs além destes três arquivos. **Nota: 8/10**.
