## Triagem — Amparo

### 1. Tamanho
- **116** arquivos TS/TSX em `src/` (~28 rotas de página + 2 endpoints `/api/public/*`).
- **29** arquivos de rota (incluindo gate `_authenticated/`, 4 onboarding, auth, landing, design system).
- **11** migrations SQL → **18** tabelas no Postgres (`access_logs`, `appointments`, `clinical_events`, `documents`, `emergency_contacts`, `emergency_links`, `emergency_rate_limits`, `families`, `family_members`, `invitations`, `medication_doses`, `medication_reminder_log`, `medications`, `patient_allergies`, `patient_conditions`, `patients`, `profiles`, `push_subscriptions`).

### 2. Stack real detectada
- **Frontend**: TanStack Start 1.x + React 19 + Vite 7 + Tailwind v4 + shadcn/Radix.
- **Roteamento**: file-based em `src/routes/` com gate único `_authenticated/route.tsx` (`ssr:false`, `beforeLoad` checa Supabase).
- **Backend**: Supabase (Postgres + Auth + Storage `medical-documents` privado). 100% via `createServerFn` + `supabaseAdmin` lazy-loaded; sem Edge Functions.
- **Deploy**: Nitro preset `cloudflare_module` (alinhado à stack obrigatória — divergência Vercel apontada no AUDIT.md já foi corrigida).
- **Extras**: PWA (manifest + `public/sw.js` para Web Push VAPID), `react-pdf` lazy, `pg_cron` para purga LGPD e disparo de lembretes a cada 5min, Realtime em `medications/appointments/medication_doses`.

### 3. O build passa?
**Sim.** `bun run build` ✓ em ~7.5s, preset `cloudflare_module`, sem erros nem warnings de typecheck. Maior chunk: `pdfjs-dist` 777kB (lazy, isolado).

### 4. Três maiores riscos visíveis
1. **Superfície pública de emergência (`/e/$token`)**: endpoint compartilhável por QR retorna alergias, medicamentos, contatos e signed URLs de documentos. Há rate-limit e TTL curto (5min), mas o vazamento do QR = vazamento clínico. Token nunca rotaciona automaticamente.
2. **Push notifications artesanais**: criptografia AES-128-GCM + VAPID JWT ES256 implementados à mão em `src/lib/push.server.ts` para rodar no Worker. Funciona, mas é superfície sensível sem testes — qualquer bug silencioso quebra lembretes (que é o core do produto para idosos).
3. **Bundle PDF no servidor**: `pdfjs-dist` (777 kB) aparece em `dist/server/_libs/` mesmo com rota `ssr:false`. Em runtime Worker o módulo nunca é executado, mas ocupa orçamento de bundle do Worker (limite 10 MB compressed). Margem ainda OK, mas é o primeiro a estourar se entrar mais 1-2 libs pesadas.

Riscos menores aceitos: `search_vector` tipado como `unknown` em `types.ts`; SW sem estratégia offline; deploy real em Workers **NÃO VERIFICÁVEL** sem publicar.

### 5. Veredito
**RECUPERÁVEL** — na prática, **já está recuperado**.

Justificativa: build verde, roadmap P0–P4 fechado (SYSTEM_STATUS 9.6/10), gate de auth centralizado, RLS + GRANTs em todas as 18 tabelas, soft delete consistente (37 ocorrências), snapshots forenses em `access_logs`, enums front↔DB alinhados. Reescrever custaria semanas para reproduzir feature parity (família multiusuário, convites, emergência pública, push, PWA, FTS) que aqui já passa nos checks automáticos. O esforço restante é **endurecimento** (rotação de token de emergência, testes do pipeline de push, observabilidade em produção), não reconstrução.
