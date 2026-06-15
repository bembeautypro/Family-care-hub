# AUDIT — Amparo (Family Health Hub)

Data: 2026-06-15 · Auditor: engenheiro sênior · Modo: somente leitura.

## Resumo Executivo

Projeto **builda** (`bun run build` ✓, ~11s, sem erros) e tem fundação sólida: 14 tabelas com RLS habilitada e GRANTs corretos (`supabase--read_query`), bucket privado `medical-documents` com policies por `family_id/patient_id/{file}` (migration `…170407_…sql:497-555`), `createServerFn` + `supabaseAdmin` para fluxos privilegiados (`src/lib/familia.functions.ts`, `src/functions/emergency.functions.ts`, `src/lib/onboarding.functions.ts`, `src/lib/perfil.functions.ts`), soft delete consistentemente aplicado em todas as leituras clínicas (37 ocorrências de `.is("deleted_at", null)`), FTS server-side com `search_vector` + `textSearch` em português (`src/routes/documentos.index.tsx:120`), schedule de medicamentos no shape obrigatório `{ times: string[] }` (`src/lib/medicamentos.ts:35`, `src/routes/medicamentos.index.tsx:45`), bottom sheet via Sheet em `documentos.index`, `agenda.index` e Fab (sem swipe), upload rejeita HEIC (`documentos.novo.tsx:121-125`, accept apenas JPEG/PNG/PDF).

Risco dominante: **divergência de deploy** — código está com preset Vercel (`vite.config.ts:12` `nitro({ preset: "vercel" })`, `vercel.json`) enquanto a stack obrigatória manda Cloudflare Workers; e **dependência declarada faltando** (`react-pdf` não instalado). Há também ausência da camada `_authenticated/` da TanStack (todas as rotas privadas re-implementam manualmente o gate via `supabase.auth.getUser()` em `useEffect` — 20+ ocorrências), o que é estável mas frágil e fora da convenção.

Sem nenhum CRÍTICO de segurança/dados de banco encontrado por leitura.

## Inventário de Funcionalidades

| Funcionalidade | Status | Evidência |
|---|---|---|
| Landing pública | FUNCIONANDO | `src/routes/index.tsx` |
| Cadastro (e-mail/senha) | FUNCIONANDO | `src/routes/auth/registro.tsx` (275 linhas) |
| Login + aceitação de convite no mesmo fluxo | FUNCIONANDO | `src/routes/auth/login.tsx:38-69` |
| Onboarding multi-etapa (familia → familiar → emergencia → primeira-acao) | FUNCIONANDO | `src/routes/onboarding/*.tsx`, `src/lib/onboarding/redirect.ts`, `profiles.onboarding_step` (migration `…170407:21`) |
| Dashboard com seletor de paciente | FUNCIONANDO | `src/routes/dashboard.tsx`, `useActivePatient` |
| Cadastro/edição/listagem de medicamentos | FUNCIONANDO | `medicamentos.{index,novo,$id.editar}.tsx`, `MedicationForm` |
| Schedule conforme schema `{ times: [] }` | FUNCIONANDO | `src/lib/medicamentos.ts:35` (`buildSchedule`), `src/components/medicamentos/MedicationForm.tsx:180` |
| Agenda (consultas) CRUD | FUNCIONANDO | `agenda.{index,nova,$id.editar}.tsx`, `AppointmentForm` |
| Histórico clínico (timeline) | FUNCIONANDO | `historico.tsx`, `eventos.{novo,$id.editar}.tsx`, `ClinicalEventForm`, migration M4 |
| Documentos: upload + listagem + busca FTS server-side | FUNCIONANDO | `documentos.novo.tsx`, `documentos.index.tsx:120` (`textSearch("search_vector", q, { config: "portuguese" })`) |
| Soft delete em documentos/medicamentos/agenda/eventos/paciente | FUNCIONANDO | 37 ocorrências de `.is("deleted_at", null)` e 6 updates `{ deleted_at, deleted_by }` |
| Família: convidar / aceitar / mudar papel / remover | FUNCIONANDO | `src/lib/familia.functions.ts` (4 server fns, todas com `requireSupabaseAuth` + checagem de admin + proteção contra remover único admin: linhas 192-209, 238-252) |
| Cartão de emergência público + log de acesso | PARCIAL | `src/routes/e.$token.tsx` (520 linhas), `src/functions/emergency.functions.ts`. Funcional, mas ver Riscos M1 (sem rate-limit), A1 (FK `patient_id` nullable nos logs) |
| Página de Emergência interna + geração de QR | FUNCIONANDO | `src/routes/emergencia.tsx`, dep `qrcode.react` instalada |
| Perfil + exclusão de conta com proteção solo-admin | FUNCIONANDO | `src/routes/perfil.tsx`, `src/lib/perfil.functions.ts:38-79`, RPC `get_solo_admin_families` |
| Visualizador de PDF in-app | NÃO IMPLEMENTADO | `react-pdf` não está em `package.json` apesar de exigido pelo project-knowledge; nenhum import encontrado. Fluxo atual abre via URL assinada (`src/lib/supabase/storage.ts`) |
| PWA / Service Worker | NÃO IMPLEMENTADO | Nenhum `manifest.json`, `vite-plugin-pwa` ou registro de SW |
| Realtime (Supabase channels) | NÃO IMPLEMENTADO | Zero ocorrências de `.channel(` / `subscribe(` em `src/` |
| Purga LGPD de `access_logs` (90d) | NÃO IMPLEMENTADO | Comentário na migration (`…170407:577`) anuncia "schedule pg_cron purge"; não há job declarado — NÃO VERIFICÁVEL em runtime |

## Arquitetura e Banco (visão compacta)

**Frontend.** TanStack Start 1.167 + React 19 + Vite 7 + Tailwind v4 + shadcn/Radix. Router file-based em `src/routes/` (26 rotas .tsx, sem `src/pages/`). Provider único: `QueryClientProvider` em `__root.tsx:122-129`. Boundaries de erro e 404 definidos no root (`__root.tsx:14-72`). `defaultPreloadStaleTime: 0` em `src/router.tsx:11`. **Não há subtree `_authenticated/`** — toda rota privada faz `supabase.auth.getUser()` em `useEffect` + `navigate({ to: "/auth/login" })` (e.g. `dashboard.tsx:69-83`, `paciente.$id.tsx:178`, `perfil.tsx:81`, `medicamentos.index.tsx:63`, `agenda.index.tsx`, etc.). Hooks customizados: apenas `useActivePatient` e `use-mobile`.

**Server.** `createServerFn` com `attachSupabaseAuth` global em `src/start.ts`. Três clients: browser (`integrations/supabase/client.ts`), middleware autenticado (`auth-middleware.ts`), admin/service-role (`client.server.ts`). Server fns: `familia.functions.ts` (generateInviteLink, acceptInvitation, changeMemberRole, removeMember), `onboarding.functions.ts` (createFamilyWithAdmin), `perfil.functions.ts` (updateProfile, deleteAccount), `emergency.functions.ts` (logEmergencyAccess). **Nenhuma Edge Function Supabase** (alinhado à diretriz).

**Banco — 14 tabelas, RLS=true em todas, GRANTs corretos:**

| Tabela | Cols | Pols | Soft-delete | FK→family/patient | Observações |
|---|---:|---:|:-:|:-:|---|
| profiles | 7 | 3 | — | → auth.users | trigger `handle_new_user` cria perfil |
| families | 5 | 3 | — | — | |
| family_members | 8 | 2 | — | family,user | UNIQUE(family_id,user_id) |
| invitations | 9 | 1 | — | family | token = `gen_random_bytes(32)`, 7d expires |
| patients | 17 | 3 | ✓ | family | `on delete restrict` em family_id |
| patient_conditions | 10 | 3 | ✓ | patient | |
| patient_allergies | 8 | 3 | ✓ | patient | severity check |
| emergency_contacts | 10 | 3 | ✓ | patient | |
| medications | 17 | 3 | ✓ | patient | `schedule jsonb` shape ok |
| appointments | 18 | 3 | ✓ | patient | `parent_appointment_id` self-FK |
| clinical_events | 15 | 3 | ✓ | patient | M4 adiciona `tags[]`, `doctor_name`, índice composto `(patient_id, event_date DESC) WHERE deleted_at IS NULL` |
| documents | 21 | 3 | ✓ | patient | `search_vector tsvector` gerado + GIN; `file_path` (não `file_url`) |
| emergency_links | 8 | 1 | — | patient | token 32 bytes, `access_count`, `is_active` |
| access_logs | 11 | 1 | — | family,patient,user,link | SELECT only para `authenticated` (escrita só service_role) |

**Helpers SECURITY DEFINER, search_path=public, STABLE:** `is_family_member(fid)`, `has_family_role(fid, roles[])`, `get_solo_admin_families(p_user_id)`. Execute revogado de `anon` (migrations M2/M3); mantido em `authenticated` (necessário porque são chamados de dentro das policies). Linter Supabase emite WARN 0029 nas três — comportamento esperado e documentado em `@security-memory`.

**Storage.** Bucket `medical-documents` privado (verificado em `<storage-buckets>`). 4 policies em `storage.objects` baseadas em `(storage.foldername(name))[2] = patient_id` + membership ativo. Convenção `family_id/patient_id/filename` documentada na migration.

**Triggers de aplicação:** zero (apenas `set_updated_at` de schema). `<db-triggers>` reporta vazio — `handle_new_user` é trigger em `auth.users`, não listado.

**Integrações externas:** nenhuma além de Supabase (Auth, Postgres, Storage). Sem Stripe, sem AI Gateway, sem email transacional configurado.

**Env vars referenciadas:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (browser), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server). Todos presentes em `<secrets>`.

## Riscos por Severidade

### CRÍTICO — 0
Nenhum risco que impeça produção foi encontrado por leitura estática.

### ALTO

**A1. FK `access_logs.patient_id` é `ON DELETE SET NULL` — auditoria de acesso de emergência fica órfã.**
- Evidência: migration `…170407_…sql:583` (`patient_id uuid references public.patients(id) on delete set null`) e policy de leitura exige `family_id is not null` (`…170407:601`).
- Impacto: ao deletar um paciente (hard delete; o app usa soft mas é teoricamente possível via service_role/admin), todos os logs de acesso anteriores ficam com `patient_id=NULL` e **também `family_id=NULL`** (mesma estratégia, `…170407:580`), tornando-os invisíveis para qualquer admin via RLS — sem trilha forense.
- Esforço: P (mudar para `on delete cascade` *ou* manter o vínculo via `family_id` snapshot + alterar a policy).

**A2. Re-implementação manual do gate de autenticação em ~20 rotas privadas; nenhuma subtree `_authenticated/`.**
- Evidência: 20 ocorrências de `supabase.auth.getUser().then(...)` em `useEffect` (e.g. `dashboard.tsx:69`, `paciente.$id.tsx:178`, `perfil.tsx:81`, `medicamentos.index.tsx:63`, `agenda.index.tsx`, `documentos.index.tsx:100`, `historico.tsx:73`, `familia.tsx:152`, `emergencia.tsx:90`, todos os 4 onboarding/*).
- Impacto: cada rota é responsável por seu próprio redirect — qualquer rota nova esquecida não tem gate; SSR já tenta renderizar HTML autenticado antes do redirect (flash de UI vazia + chamadas RLS-bloqueadas). Frágil para adicionar features.
- Esforço: M (mover árvore para `src/routes/_authenticated/` com `route.tsx` `ssr:false` conforme convenção TanStack).

**A3. Deploy target divergente da stack obrigatória.**
- Evidência: `vite.config.ts:12` `nitro({ preset: "vercel" })`, raiz contém `vercel.json` com `"buildCommand": "bun run build", "outputDirectory": ".vercel/output"`. Stack obrigatória (project-knowledge): "Deploy: Cloudflare Workers (gerenciado pelo Lovable Cloud)". `src/server.ts` exporta um handler `fetch(request, env, ctx)` no formato Worker — coexistindo com preset Vercel.
- Impacto: build de produção emite artefatos Vercel; se o operador esperar runtime Worker (limites de CPU, env binding por request, sem Node host) o comportamento em prod difere de dev.
- Esforço: P (trocar preset) — mas é decisão de produto.

**A4. Race condition no `dashboard.tsx`: 6 `setState` após `await Promise.all` sem guarda de paciente vigente.**
- Evidência: `dashboard.tsx:150-200` — ao mudar `patient.id` enquanto a request anterior ainda está em voo, os `setAppointments/setMedications/...` do efeito antigo podem sobrescrever os do novo paciente. Não há `abort` nem flag `cancelled`.
- Impacto: dashboard exibe brevemente dados do paciente errado ao alternar no `PatientSelector`. Em UX de saúde isso é grave.
- Esforço: P (introduzir flag `cancelled` ou migrar para `useQuery`).

### MÉDIO

**M1. Endpoint público de emergência `/e/$token` sem rate-limit nem CAPTCHA.**
- Evidência: `src/routes/e.$token.tsx` chama `logEmergencyAccess` sem cooldown; `emergency.functions.ts:21` apenas valida o token e incrementa `access_count`. Token = 32 bytes hex (alta entropia, OK), mas `is_active`/`expires_at` são opcionais e podem ser nulos (migration `…170407:561-565` — `expires_at timestamptz` é nullable, `is_active boolean default true`).
- Impacto: quem souber/adivinhar a URL pode enumerar dados do paciente (alergias, medicamentos, contatos) e gerar signed URLs ilimitadas. Adversário pode rodar varredura de tokens (improvável dado o espaço, mas sem limite por IP).
- Esforço: M (adicionar rate-limit por IP em KV/Postgres e/ou cap em `access_count`).

**M2. Signed URLs do bucket `medical-documents` retornadas no payload público de emergência.**
- Evidência: `emergency.functions.ts:105-123` gera signed URLs (TTL 3600s) para os últimos 5 documentos e devolve no JSON. `e.$token.tsx` (PublicEmergencyPage) consome.
- Impacto: documentos clínicos sensíveis ficam acessíveis por 1h via URL não autenticada, encadeada a um token compartilhável (QR Code). Vazamento do QR = vazamento dos PDFs.
- Esforço: M (reduzir TTL, exigir step de "confirmar emergência" antes de gerar URLs, ou servir documentos proxyados com nova validação do token).

**M3. `medications.frequency` e `appointments.type` desalinhados entre frontend e DB.**
- Evidência: `agenda.ts:5-12` define `APPOINTMENT_TYPES` com valores `physiotherapy` e `vaccination`, mas o CHECK no banco (`…170407:431`) só aceita `('consultation','exam','return','procedure','therapy','vaccine','other')`. Tentar gravar `physiotherapy` ou `vaccination` causa erro 23514.
- Impacto: criar consulta com esses dois tipos quebra silenciosamente; vazado para o usuário como toast genérico.
- Esforço: P (alinhar enums — preferir alterar `agenda.ts` para `therapy`/`vaccine`).

**M4. `documentos.index.tsx:161` faz `update({ deleted_at })` sem `deleted_by` (todas as outras telas setam ambos).**
- Evidência: comparar `paciente.$id.tsx:712`, `medicamentos.index.tsx:108`, `agenda.index.tsx:170`, `historico.tsx:123` (todos com `deleted_by: userId`) vs `documentos.index.tsx:159-163` (apenas `deleted_at`).
- Impacto: trilha de auditoria perdida em deletes de documento — quem apagou?
- Esforço: P.

**M5. `useActivePatient` e dashboard fazem 6 queries em paralelo no client por troca de paciente; nenhum índice em `(patient_id, deleted_at)` para tabelas além de `clinical_events`.**
- Evidência: M4 cria índice composto só para `clinical_events`. Outras tabelas têm índice em `patient_id` e índice separado em `deleted_at`, mas Postgres não combina eficientemente — toda query vai usar `idx_*_patient_id` e filtrar `deleted_at` em memória.
- Impacto: hoje OK (poucas linhas por paciente). Não é problema medível agora; vira problema quando paciente tem centenas de medicamentos/eventos históricos.
- Esforço: P (CREATE INDEX com WHERE deleted_at IS NULL).

**M6. Risco de re-render no `dashboard.tsx` por `useState` de 6 entidades + 1 efeito enorme.**
- Evidência: 6 estados independentes em `PatientDashboard` (`dashboard.tsx:140-145`); cada `setState` causa rerender de toda a subtree. Não há `useReducer`/`useQuery`.
- Impacto: BAIXO hoje (sem listas grandes); MÉDIO se virar tela com realtime.
- Esforço: M (refatorar para React Query).

### BAIXO

**B1.** `src/lib/agenda.ts` exporta `APPOINTMENT_STATUSES` com classes Tailwind hard-coded (`bg-blue-100`, `bg-emerald-100`) em vez de tokens semânticos do design system (`styles.css`). Inconsistente com o restante.
**B2.** `__root.tsx:90-91` expõe `og:image` apontando para domínio de preview (`pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...id-preview...lovable.app...`) — em produção isso fica preso ao preview.
**B3.** Várias `as string` em `familia.functions.ts:56,73,89,...` que poderiam ser tipadas via generics do Database.
**B4.** `src/integrations/supabase/types.ts:245,268,291` tipa `search_vector` como `unknown` — esperado (não há tsvector no TS), mas força o `textSearch` a depender de string mágica.
**B5.** Apenas 3 `console.error/log` em todo `src/routes|lib|functions` — bom isolamento, sem ruído.

## Itens NÃO VERIFICÁVEIS

| Item | Como verificar (operador) |
|---|---|
| Cron de purga LGPD de `access_logs` (>90d) está rodando? | `SELECT * FROM cron.job WHERE command ILIKE '%access_logs%';` e `SELECT min(created_at), max(created_at), count(*) FROM public.access_logs;` (esperado: min > now()-90d se cron rodou) |
| Bundle real em produção / runtime Worker funcional | Publicar e fazer `curl -I https://<projeto>.lovable.app/` + `curl https://<projeto>.lovable.app/api/...`; medir cold start |
| Tokens de `emergency_links` em uso (entropia, reuso) | `SELECT count(*), count(distinct token), max(access_count), avg(access_count) FROM public.emergency_links;` |
| Volume de logs e crescimento de `documents` | `SELECT pg_size_pretty(pg_total_relation_size('public.documents'));` e `SELECT date_trunc('day', created_at), count(*) FROM access_logs GROUP BY 1 ORDER BY 1 DESC LIMIT 30;` |
| Há documentos com `file_path` quebrado (objeto inexistente no bucket)? | Comparar `SELECT file_path FROM public.documents WHERE deleted_at IS NULL` contra listagem do bucket `medical-documents` |
| Existe alguma policy que vaze dados entre famílias na prática | `SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;` revisado manualmente; rodar query como dois usuários distintos no SQL editor com `SET LOCAL ROLE authenticated; SET request.jwt.claim.sub TO '<uuid>';` |
| Lint frontend / typecheck em pipeline | `bun run lint && bun x tsc --noEmit` (não executado nesta auditoria) |
| Métricas de performance, memória, cold start, bundle size real | Lighthouse + Cloudflare/Vercel analytics na URL publicada |

## Nota de Prontidão: **6/10**

Builda, fluxos principais funcionam, sem CRÍTICOS de segurança ou integridade encontrados. Penalidades: A1 (FK `set null` em logs forenses), A2 (gate de auth duplicado em 20 rotas), A3 (deploy target divergente), A4 (race no dashboard), M1/M2 (superfície pública de emergência sem rate-limit e signed URLs longas). Nenhum bloqueia lançamento de beta fechado; A1 e M1 devem ser fechados antes de público geral.
