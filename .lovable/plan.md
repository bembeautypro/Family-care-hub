## Lembretes de medicamento — push notifications

Notificação no celular nos horários do `medications.schedule.times`. Toque na notificação ou no botão "Tomei" registra a dose automaticamente.

### Como vai funcionar (para o usuário)

1. No card do medicamento (ou em Perfil), botão **"Ativar lembretes"**.
2. Navegador pede permissão de notificação → app registra subscription.
3. A cada horário do schedule, chega uma notificação:
   - Título: "Hora do remédio · Maria"
   - Corpo: "Losartana 50 mg — 08:00"
   - Ações: **Tomei** · **Não tomei** · **Adiar 15 min**
4. Tocar uma ação registra em `medication_doses` sem abrir o app. Tocar a notificação abre o dashboard.

### Componentes técnicos

**1. Banco (1 migration)**
- `push_subscriptions(id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at, last_seen_at, disabled_at)` — RLS por `user_id`.
- `medication_reminder_log(medication_id, scheduled_for timestamptz, sent_at, status)` — evita disparo duplicado se o cron rodar 2x na mesma janela.
- GRANTs + RLS padrão.

**2. Service worker (`public/sw.js`)**
- Apenas push + notificationclick. **Sem cache de app shell** (preview-safe, conforme regra PWA).
- `notificationclick` com `action === "taken"|"skipped"` chama `/api/public/hooks/dose-action` com token assinado embutido no payload da notificação.
- `notificationclick` sem action: `clients.openWindow("/dashboard")`.

**3. Server functions (autenticadas)**
- `subscribeToPush({ endpoint, p256dh, auth })` — upsert em `push_subscriptions`.
- `unsubscribeFromPush({ endpoint })` — marca `disabled_at`.
- `getVapidPublicKey()` — retorna `VAPID_PUBLIC_KEY` (público, pode ser env exposto).

**4. Endpoint público de ação rápida (`/api/public/hooks/dose-action`)**
- Recebe `{ token }` (JWT HS256 assinado server-side com `medication_id`, `user_id`, `scheduled_for`, exp 30 min).
- Verifica assinatura → insere em `medication_doses` com status `taken|skipped` → retorna 200.
- Sem necessidade de sessão do usuário (o token JWT já autoriza essa ação específica).

**5. Endpoint de cron (`/api/public/hooks/send-medication-reminders`)**
- Roda a cada 5 min via pg_cron (granularidade aceitável; horários do schedule são em `HH:00`/`HH:30` na prática).
- Calcula janela `[now - 2min, now + 5min]` em UTC ajustado por timezone do paciente (`patients.timezone` — adicionar coluna se não existir; default `America/Sao_Paulo`).
- Para cada medication ativa cujo `schedule.times[]` cai na janela:
  - Cria registro em `medication_reminder_log` (UNIQUE em `(medication_id, scheduled_for)`).
  - Para cada `push_subscription` dos responsáveis (`family_members` com role admin/co-caregiver da família), envia push.
- Usa Web Push via fetch direto (Worker-compat). Helper inline com VAPID (assinatura ECDSA via WebCrypto `subtle.sign`).

**6. UI**
- Em `medicamentos/$id/editar`: toggle "Ativar lembretes neste dispositivo".
- Em `perfil`: lista de dispositivos com lembrete ativo + botão "Desativar neste dispositivo".

### Secrets a configurar

- `VAPID_PUBLIC_KEY` (exposto como `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY` (server-only)
- `VAPID_SUBJECT` = `mailto:admin@amparo.app`
- `DOSE_ACTION_JWT_SECRET` (server-only, HS256)

Eu gero os pares VAPID via `node` no sandbox antes de salvar.

### Decisões assumidas

- **Granularidade**: cron a cada 5 min (Supabase pg_cron mínimo confortável). Schedules típicos são em horas cheias/meias.
- **Quem recebe**: todos os usuários da família com role `admin` ou `co_caregiver` que tenham subscription ativa. O texto da notificação inclui o nome do paciente.
- **"Adiar 15 min"**: ação grava em `medication_reminder_log` com `scheduled_for + 15min` para reagendamento.
- **iOS**: Safari iOS 16.4+ suporta push em PWAs instalados via "Adicionar à tela de início". App já é instalável (manifest existe).
- **Sem cache do app shell** no service worker — Lovable preview-safe.

### Limites conhecidos (transparentes)

- Antes do app ser publicado, o service worker fica restrito ao domínio de preview. Push real só funciona em produção (HTTPS estável).
- Usuários precisam abrir o app uma vez por dispositivo para registrar a subscription.

### Não inclui (escopo deste lote)

- Edição de horário individual por dose (só usa o `schedule.times` existente).
- Notificações de compromissos ou pendências.
- Lembrete de "tomar antes da janela" (só dispara dentro da janela).

### Entrega

- 1 migration (3 tabelas/colunas + RLS + GRANTs).
- 1 service worker (`public/sw.js`).
- 1 helper de push (`src/lib/push.server.ts`) com VAPID via WebCrypto.
- 3 server functions + 2 server routes públicos.
- Toggle de inscrição em `medicamentos.$id.editar.tsx` + lista em `perfil.tsx`.
- Cron pg_cron a cada 5 min.

Posso seguir?