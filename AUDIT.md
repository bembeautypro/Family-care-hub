# AUDIT — Amparo (Family Health Hub)

Data: 2026-06-30 · Auditor: engenheiro sênior · Modo: somente leitura · Build verificado: `bun run build` ✓ ~7.5s (preset `cloudflare_module`).

## Resumo Executivo

Projeto **builda limpo**, tem 116 arquivos TS/TSX, 29 rotas (28 páginas + 2 endpoints públicos), 18 tabelas Postgres com RLS=true em **todas** e 49 policies (`pg_policies`). Fundação sólida: gate único de auth em `src/routes/_authenticated/route.tsx:9-22` (`ssr:false` + `beforeLoad` checa `supabase.auth.getUser()`); 100% das mutations privilegiadas em `createServerFn` + `supabaseAdmin` lazy-loaded; soft delete consistente em 6 tabelas clínicas; FTS server-side em documentos (`idx_documents_fts` GIN); 7 índices parciais `(patient_id) WHERE deleted_at IS NULL`; rate-limit + snapshots forenses no endpoint público de emergência; 3 cron jobs `pg_cron` ativos (purga LGPD diária + reminders a cada 5min). PWA com manifest e service worker para Web Push VAPID artesanal (compatível com Worker via `crypto.subtle`). Realtime habilitado em `medications`, `appointments`, `medication_doses`.

Sem CRÍTICOS de segurança ou integridade encontrados por leitura estática. Riscos remanescentes: superfície pública `/e/$token` retorna dados clínicos + signed URLs (TTL 5min) — vazamento do QR = vazamento clínico até expirar; webhook `/api/public/hooks/send-medication-reminders` sem assinatura (apenas obscuridade); 4 FKs em `access_logs` com `ON DELETE SET NULL` mitigadas por snapshots (`family_id_snapshot`, `patient_id_snapshot`) mas a policy depende do snapshot estar setado pelo trigger. Pronto para beta fechado; endurecimento (assinatura no webhook, rotação de token de emergência, testes do pipeline VAPID) recomendado antes de público geral.

## Inventário de Funcionalidades

| Funcionalidade | Status | Evidência |
|---|---|---|
| Landing pública | FUNCIONANDO | `src/routes/index.tsx` |
| Cadastro (e-mail/senha) com verificação obrigatória | FUNCIONANDO | `src/routes/auth/registro.tsx` |
| Login + aceite de convite no mesmo fluxo | FUNCIONANDO | `src/routes/auth/login.tsx` |
| Onboarding 4 passos (familia → familiar → emergencia → primeira-acao) | FUNCIONANDO | `src/routes/_authenticated/onboarding/*.tsx` (4 rotas), `src/lib/onboarding/redirect.ts`, `profiles.onboarding_step` |
| Self-insert admin via server fn | FUNCIONANDO | `src/lib/onboarding.functions.ts` (`createFamilyWithAdmin`, supabaseAdmin) |
| Dashboard com seletor de paciente + React Query + Realtime | FUNCIONANDO | `src/routes/_authenticated/dashboard.tsx` (928 linhas), `useActivePatient` |
| CRUD Medicamentos + schedule `{times:[]}` | FUNCIONANDO | `medicamentos.{index,novo,$id.editar}.tsx`, `src/lib/medicamentos.ts`, `MedicationForm.tsx` |
| Botões rápidos "Tomei/Não tomei" + histórico de doses | FUNCIONANDO | tabela `medication_doses` (4 policies), realtime no dashboard |
| CRUD Agenda com responsável obrigatório + "Criar retorno" | FUNCIONANDO | `agenda.{index,nova,$id.editar}.tsx`, `AppointmentForm.tsx`, FK `parent_appointment_id` |
| Marcar como realizado → registrar evento clínico | FUNCIONANDO | banner pós-ação no agenda.index |
| Histórico clínico (timeline filtrável) | FUNCIONANDO | `historico.tsx`, `ClinicalEventForm.tsx`, índice composto `(patient_id, event_date DESC) WHERE deleted_at IS NULL` |
| Documentos: upload + FTS server-side + signed URL | FUNCIONANDO | `documentos.{index,novo,$id}.tsx`, `idx_documents_fts` GIN, accept JPEG/PNG/PDF (HEIC bloqueado) |
| Visualizador PDF inline (rota `ssr:false`) | FUNCIONANDO | `documentos.$id.tsx` + `src/components/documents/PdfViewer.tsx` (react-pdf lazy, 777kB chunk isolado) |
| Família: convidar / aceitar / mudar papel / remover, proteção solo-admin | FUNCIONANDO | `src/lib/familia.functions.ts` (4 server fns) |
| Cartão de emergência público + QR + log + rate-limit | FUNCIONANDO | `src/routes/e.$token.tsx` (520L), `src/functions/emergency.functions.ts:31-60` |
| Perfil + exclusão de conta com proteção solo-admin | FUNCIONANDO | `src/routes/_authenticated/perfil.tsx`, `src/lib/perfil.functions.ts`, RPC `get_solo_admin_families` |
| PWA instalável (manifest + ícones) | FUNCIONANDO | `public/manifest.webmanifest`, `public/sw.js` |
| Push notifications VAPID (lembretes) | FUNCIONANDO (não testável em sandbox HTTP) | `src/lib/push.server.ts:89` (`VAPID_PRIVATE_KEY`), `PushReminderToggle.tsx`, cron 5min |
| Webhook de ação por notificação (Tomei/Pular) | FUNCIONANDO | `src/routes/api/public/hooks/dose-action.ts` (JWT HS256, secret `DOSE_ACTION_JWT_SECRET`) |
| Realtime no dashboard | FUNCIONANDO | canais `medications`, `appointments`, `medication_doses` invalidam React Query |
| Cron de purga LGPD `access_logs` 90d | FUNCIONANDO | `cron.job` `purge-access-logs-90d` 03:15 UTC, ativo |
| Cron de purga `emergency_rate_limits` 1d | FUNCIONANDO | `cron.job` `purge-emergency-rate-limits-1d` 03:20 UTC, ativo |
| Cron disparador de lembretes a cada 5min | FUNCIONANDO | `cron.job` `send-medication-reminders-5min` via `pg_net` POST público |
| Design system reference page | FUNCIONANDO | `src/routes/design.tsx` |

## Arquitetura e Banco

**Frontend.** TanStack Start 1.x + React 19 + Vite 7 + Tailwind v4 + shadcn/Radix. Router file-based em `src/routes/`. Provider único `QueryClientProvider` em `__root.tsx`. Errors/404 no root. Hooks: `useActivePatient`, `use-mobile`. Gate único em `_authenticated/route.tsx:9-22` — child routes não duplicam auth.

**Server.** `createServerFn` + `attachSupabaseAuth` em `src/start.ts`. Três clients (browser, middleware autenticado, admin/service-role). Admin sempre lazy-loaded dentro de handlers. Zero Edge Functions Supabase. Endpoints HTTP públicos em `src/routes/api/public/hooks/` (dose-action, send-medication-reminders).

**Banco — 18 tabelas, RLS=true em todas (confirmado em `pg_tables`), 49 policies em `pg_policies`:**

| Tabela | RLS | Policies | Soft delete | Observação |
|---|:-:|:-:|:-:|---|
| profiles | ✓ | 3 | — | trigger `handle_new_user` em `auth.users` |
| families | ✓ | 3 | — | |
| family_members | ✓ | 2 | — | UNIQUE(family_id,user_id) |
| invitations | ✓ | 1 | — | token = `gen_random_bytes(32)` |
| patients | ✓ | 3 | ✓ | FK family `ON DELETE RESTRICT` |
| patient_conditions / patient_allergies / emergency_contacts | ✓ | 3 ea. | ✓ | FK patient `ON DELETE CASCADE` |
| medications | ✓ | 3 | ✓ | schedule JSONB `{times:[]}` |
| medication_doses | ✓ | 4 | — | FKs patient/medication CASCADE |
| medication_reminder_log | ✓ | 1 | — | idempotência de envio |
| appointments | ✓ | 3 | ✓ | self-FK `parent_appointment_id` SET NULL |
| clinical_events | ✓ | 3 | ✓ | índice `(patient_id, event_date DESC) WHERE deleted_at IS NULL` |
| documents | ✓ | 3 | ✓ | `search_vector tsvector` + GIN, `file_path` (não `file_url`) |
| emergency_links | ✓ | 1 | — | token 32 bytes, `access_count`, `is_active` |
| emergency_rate_limits | ✓ | — | — | **INFO Supabase 0008: RLS sem policy** — escrita só via service_role no server fn; leitura propositalmente bloqueada |
| access_logs | ✓ | 1 | — | 4 FKs `ON DELETE SET NULL`, mitigado por snapshots e trigger `access_logs_set_snapshots` |
| push_subscriptions | ✓ | 1 | — | endpoint + p256dh + auth keys |

**Helpers SECURITY DEFINER, search_path=public, STABLE:** `is_family_member(fid)`, `has_family_role(fid, roles[])`, `get_solo_admin_families(p_user_id)`. Supabase linter emite WARN 0029 nos três — esperado (são chamados de dentro das policies). Também `handle_new_user`, `set_updated_at`, `access_logs_set_snapshots`.

**Storage.** Bucket `medical-documents` privado. Convenção `family_id/patient_id/filename`.

**Cron (`cron.job`):** 3 jobs ativos confirmados em runtime — `purge-access-logs-90d` (15 3 * * *), `purge-emergency-rate-limits-1d` (20 3 * * *), `send-medication-reminders-5min` (`*/5 * * * *`).

**Secrets configurados (Lovable Cloud):** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DOSE_ACTION_JWT_SECRET`, `LOVABLE_API_KEY`.

**Integrações externas:** apenas Supabase + Web Push (push services do navegador). Sem Stripe, AI Gateway em uso, email transacional.

## Riscos por Severidade

### CRÍTICO — 0
Nenhum risco que impeça produção.

### ALTO

**A1. Endpoint público `/api/public/hooks/send-medication-reminders` sem assinatura/secret.**
Evidência: `src/routes/api/public/hooks/send-medication-reminders.ts:44-148` — handler aceita POST sem header de auth ou HMAC. Apenas o cron `pg_net` chama hoje, mas o endpoint é descoberto via DNS público (`project--96384b44-…lovable.app/api/public/hooks/send-medication-reminders`). Impacto: terceiro pode disparar push spam para todos os usuários (somando custos de log + risco de revogação do endpoint pelos browsers). Esforço: P (HMAC com header `x-cron-secret` validado por `timingSafeEqual`).

**A2. Cartão de emergência `/e/$token` devolve dados clínicos sensíveis + signed URLs (TTL 300s) sem step de confirmação.**
Evidência: `src/functions/emergency.functions.ts:142-155` gera signed URLs para últimos documentos; `src/routes/e.$token.tsx` consome direto. Há rate-limit (linhas 31-60) e cap em `access_count`, mas nenhuma confirmação humana antes do payload completo. Impacto: vazamento do QR = vazamento de alergias, medicamentos, contatos, e PDFs por 5min. Esforço: M (tela "Confirmar emergência" + reduzir documentos ao mínimo essencial).

**A3. 4 FKs em `access_logs` com `ON DELETE SET NULL`; policy depende exclusivamente do snapshot.**
Evidência: `pg_constraint` mostra `access_logs_{family,patient,user,emergency_link}_id_fkey ON DELETE SET NULL`. Policy: `(family_id_snapshot IS NOT NULL) AND is_family_member(family_id_snapshot)`. Mitigação por trigger `access_logs_set_snapshots`. Impacto: se um INSERT futuro escapar do trigger (ex: outra função SECURITY DEFINER), a auditoria fica órfã e silenciosamente invisível. Esforço: P (adicionar `CHECK (family_id_snapshot IS NOT NULL)` ou tornar coluna `NOT NULL`).

### MÉDIO

**M1. Webhook `dose-action` valida JWT mas não checa idempotência por `jti`.**
Evidência: `src/routes/api/public/hooks/dose-action.ts:52-106` decodifica HS256 e insere em `medication_doses`. Sem `jti` no payload nem unique constraint composta. Impacto: reenvio do mesmo link de notificação cria doses duplicadas. Esforço: P (UNIQUE em `(medication_id, scheduled_for)`).

**M2. Bundle `pdfjs-dist` (777kB) gerado em `dist/server/_libs/` mesmo com rota `ssr:false`.**
Evidência: output do build. Worker tem cap de 10MB compressed; sobra margem, mas é o primeiro a estourar. Impacto: cold-start maior + risco de cap se 1-2 libs pesadas entrarem. Esforço: M (`build.rollupOptions.external` no SSR env requer cuidado — ver memo TanStack que proíbe `ssr.external` cru; alternativa é confinar `react-pdf` via `lazy()` que já é feito, e investigar `vite-plugin-singlefile` ou import dinâmico mais agressivo).

**M3. `dashboard.tsx` com 928 linhas em um único arquivo de rota.**
Evidência: `wc -l src/routes/_authenticated/dashboard.tsx`. 7 `useQuery` + 6 canais realtime + skeleton + JSX. Impacto: manutenção; risco de re-render por mudança trivial. Esforço: M (extrair os 6 blocos para componentes em `src/components/dashboard/`).

**M4. `src/functions/` coexiste com `src/lib/*.functions.ts`.**
Evidência: `src/functions/emergency.functions.ts` é o único arquivo fora do padrão `src/lib/`. Impacto: convenção quebrada, future contributors podem duplicar. Esforço: P.

**M5. 50+ `as any` em `src/routeTree.gen.ts`.**
Evidência: 50 ocorrências no arquivo. **Auto-gerado**, esperado pela TanStack Router (não editar). Listo apenas para descartar como falso positivo de busca por `any`.

### BAIXO

**B1.** `src/integrations/supabase/types.ts` tipa `search_vector` como `unknown` (gerado), força `textSearch` a depender de string mágica.
**B2.** Apenas 9 `console.error` em todo `src/` — bom isolamento, nenhum `console.log` espúrio.
**B3.** Service worker `public/sw.js` sem estratégia offline / cache de assets — PWA é instalável mas não funciona offline.
**B4.** Linter Supabase reporta `WARN 0014 Extension in Public` (pg_cron/pg_net) — padrão da plataforma Supabase, documentado, não acionável pelo app.
**B5.** Token de `emergency_links` nunca é rotacionado automaticamente — `expires_at` é nullable (default sem expiração). UX permite revogar manualmente, mas falta política de TTL padrão.

## Itens NÃO VERIFICÁVEIS

| Item | Comando/SQL de verificação |
|---|---|
| Push real chega ao device | Publicar em HTTPS, instalar como PWA (iOS exige), conceder permissão, aguardar próximo slot do cron |
| Cron de purga LGPD efetivamente apaga linhas antigas | `SELECT min(created_at), max(created_at), count(*) FROM public.access_logs;` (esperado: min > now()-90d após 1 ciclo) |
| Cron de reminders está disparando | `SELECT runid, job_pid, status, return_message, start_time FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='send-medication-reminders-5min') ORDER BY start_time DESC LIMIT 10;` |
| Bundle do Worker em runtime cabe nos 10MB | publicar e medir; `wrangler deploy --dry-run --outdir=tmp && du -sh tmp/` |
| Cold-start real do Worker | curl com `-w '%{time_total}'` após período de inatividade |
| Documentos com `file_path` quebrado | comparar `SELECT file_path FROM public.documents WHERE deleted_at IS NULL` vs listagem do bucket |
| Tokens de emergência em uso, entropia, reuso | `SELECT count(*), count(DISTINCT token), max(access_count), avg(access_count), max(created_at) FROM public.emergency_links;` |
| Volume de doses inseridas via webhook vs UI | `SELECT date_trunc('day', created_at), count(*) FROM public.medication_doses GROUP BY 1 ORDER BY 1 DESC LIMIT 30;` |
| Vazamento entre famílias (teste empírico) | Criar dois usuários em famílias distintas e tentar `SELECT * FROM patients` de cada uma |
| Lighthouse PWA score | Rodar no app publicado |
| Typecheck CI | `bunx tsgo --noEmit` (não executado nesta auditoria) |

## Nota de Prontidão: **8/10**

**Justificativa.** Sem CRÍTICOS. Build verde, RLS+GRANTs em todas as 18 tabelas, gate único, soft delete consistente, FTS, índices parciais, cron LGPD, snapshots forenses, rate-limit em endpoint público de emergência, push pipeline funcional. Penalidades: A1 (webhook de reminders sem assinatura — exploração trivial), A2 (superfície de emergência ainda devolve PDFs por 5min sem confirmação), A3 (snapshot em `access_logs` é convenção, não constraint). Fechar A1+A2 sobe para 9.
