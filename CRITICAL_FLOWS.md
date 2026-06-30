# CRITICAL_FLOWS — Amparo

Roteiro de regressão manual. Executar nesta ordem após cada lote de correções. Esperado = comportamento correto observável; qualquer divergência abre bug.

## 1. Cadastro com verificação de e-mail

1. Abrir `/auth/registro`.
2. Preencher nome, e-mail real, senha ≥ 8 caracteres, aceitar termos, submeter.
3. Esperar tela "Verifique seu e-mail".
4. Abrir caixa de entrada, clicar no link.
5. **Esperado**: redireciona para `/onboarding/familia` (primeiro passo).

## 2. Onboarding completo (4 passos)

1. Como usuário novo recém-verificado, preencher nome da família → "Continuar".
2. Preencher dados do familiar (nome, data nasc., gênero) → "Continuar".
3. Cadastrar pelo menos 1 contato de emergência (nome, telefone, parentesco) → "Continuar".
4. Escolher uma primeira ação (ex: "Cadastrar medicamento").
5. **Esperado**: chega ao dashboard com card do familiar visível; `profiles.onboarding_step` = 'completed'.

## 3. Login + aceite de convite

1. Como admin, abrir `/familia`, gerar link de convite com papel "editor".
2. Copiar URL `/convite/<token>`.
3. Em janela anônima, abrir a URL.
4. Não logado → redireciona para `/auth/login?invite=<token>`.
5. Logar com conta DIFERENTE da que gerou o convite.
6. **Esperado**: convite aceito automaticamente, usuário aparece em `family_members` como editor, redireciona para dashboard.

## 4. Cadastrar medicamento com horários

1. No dashboard, FAB → "Novo medicamento".
2. Preencher nome, dose, frequência "2x ao dia", horários `08:00` e `20:00`, médico, foto (PNG ou JPEG).
3. Tentar anexar `.HEIC` → **esperado**: bloqueado com mensagem.
4. Salvar.
5. **Esperado**: aparece em `/medicamentos` aba "Ativos"; `medications.schedule = {"times":["08:00","20:00"]}`.

## 5. Botões rápidos "Tomei" / "Não tomei" + histórico de doses

1. No card do medicamento do dashboard, clicar "Tomei".
2. **Esperado**: insere em `medication_doses` com `status='taken'`, `taken_by=auth.uid()`, badge de atraso some.
3. Abrir bottom sheet (⋮) → "Ver histórico de doses".
4. **Esperado**: lista as últimas 60 doses ordenadas por `scheduled_for DESC`.

## 6. Criar consulta + Marcar como realizada + Registrar evento clínico

1. FAB → "Nova consulta". Preencher tipo "consulta", data futura, médico, responsável (membro da família).
2. Salvar → aparece em `/agenda` aba "Próximos".
3. Avançar a data ou abrir consulta passada, clicar "Marcar como realizado".
4. Confirmar diálogo.
5. **Esperado**: status muda para `completed`, banner aparece por 8s perguntando "Registrar evento clínico?".
6. Clicar no banner.
7. **Esperado**: navega para `/eventos/novo` com `appointment_id` pré-preenchido.

## 7. Histórico clínico filtrado

1. Cadastrar 3 eventos clínicos de tipos e gravidades diferentes.
2. Abrir `/historico`.
3. Aplicar filtro tipo="consulta" + gravidade="alta".
4. **Esperado**: timeline mostra apenas eventos matching; query usa índice `idx_clinical_events_patient_date`.

## 8. Upload + busca FTS + visualização de PDF

1. Em `/documentos`, FAB → "Novo documento".
2. Anexar PDF, escolher tipo "exame", título "Hemograma completo".
3. Tentar `.HEIC` → **esperado**: bloqueado.
4. Salvar.
5. Na lista, buscar "hemograma" → **esperado**: resultado retornado via `textSearch("search_vector", q, { config: "portuguese" })`.
6. Abrir documento.
7. **Esperado**: PDF renderiza inline via react-pdf; fallback "Abrir em nova aba" disponível.

## 9. Cartão de emergência (criar, abrir, log, rate-limit)

1. No dashboard, abrir card do familiar → botão "Emergência".
2. Em `/emergencia`, gerar novo link → QR Code aparece.
3. Copiar URL `/e/<token>`.
4. Em janela anônima, abrir a URL.
5. **Esperado**: payload com alergias, medicamentos ativos, contatos, signed URLs de até 5 documentos (TTL 5min). `access_logs` recebe insert com `family_id_snapshot` e `patient_id_snapshot` populados.
6. Recarregar a página 11x em sequência → **esperado**: a partir da 11ª, rate-limit bloqueia com 429.

## 10. Família — promover, rebaixar, remover, proteção solo-admin

1. Em `/familia` como admin único, abrir membro "viewer", mudar papel para "admin".
2. Como o novo admin, tentar remover o primeiro admin.
3. **Esperado**: permitido (sobra 1 admin).
4. Tentar remover o último admin restante (auto-remoção sendo solo).
5. **Esperado**: bloqueado via `get_solo_admin_families`; toast "Você é o único administrador".

## 11. Exclusão de conta com proteção solo-admin

1. Em `/perfil`, abrir "Excluir conta".
2. Se for solo-admin em alguma família, **esperado**: bloqueado, lista famílias afetadas.
3. Promover outro membro a admin, voltar e tentar de novo.
4. **Esperado**: confirmação dupla, conta deletada, sign-out, redireciona para landing.

## 12. PWA / Push / Lembrete de medicamento

> Requer HTTPS de produção e (iOS) instalação como PWA.

1. Abrir o app publicado em Chrome Android ou Safari iOS (modo "Adicionar à tela inicial").
2. Em `/medicamentos/<id>/editar`, ativar toggle de lembretes.
3. Conceder permissão de notificação.
4. **Esperado**: insert em `push_subscriptions`.
5. Cadastrar medicamento com horário 5 min no futuro.
6. Aguardar próximo tick do cron (`*/5 * * * *`).
7. **Esperado**: notificação aparece com botões "Tomei" e "Pular".
8. Clicar "Tomei".
9. **Esperado**: webhook `/api/public/hooks/dose-action` valida JWT, insere `medication_doses` com `status='taken'`, notificação some.

## 13. Multi-paciente (seletor)

1. Em `/familia`, criar segundo paciente (ex: "Mãe").
2. No dashboard, abrir seletor de paciente sticky, escolher "Mãe".
3. **Esperado**: todos os 6 blocos do dashboard recarregam com dados do paciente correto; troca rápida não mostra dados do paciente anterior (race resolvido via `AbortSignal` no React Query).
4. Recarregar página.
5. **Esperado**: `useActivePatient` persiste a seleção.

## 14. Soft delete + invisibilidade nas listagens

1. Em `/medicamentos`, deletar um medicamento ativo (⋮ → Excluir).
2. **Esperado**: `medications.deleted_at` e `deleted_by` populados; some das abas Ativos/Pausados/Encerrados.
3. Repetir para 1 documento, 1 consulta, 1 evento clínico.
4. **Esperado**: cada item some de sua respectiva listagem; queries usam `.is("deleted_at", null)`.

## 15. Realtime entre dispositivos

1. Abrir dashboard em 2 dispositivos logados na mesma família.
2. No dispositivo A, marcar dose como "Tomei".
3. **Esperado**: dispositivo B atualiza o card sem refresh (canal `medication_doses` invalida React Query).
4. Repetir para criar/editar consulta e medicamento.
