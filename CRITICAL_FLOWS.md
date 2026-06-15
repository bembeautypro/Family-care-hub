# CRITICAL_FLOWS — Amparo

Teste de regressão manual. Cada fluxo: passos numerados + resultado esperado. Execute em ordem; pré-requisito de um fluxo é o resultado do anterior.

## F1. Cadastro de novo usuário

1. Abrir `/`.
2. Tocar **Começar organização**.
3. Em `/auth/registro`, preencher nome, e-mail, senha (≥8 chars), aceitar termos, submeter.
4. **Esperado:** redirect para `/onboarding/familia`. Em `public.profiles` existe linha com `id = auth.uid()`, `full_name` preenchido, `onboarding_step = 0`. Trigger `handle_new_user` criou o perfil.

## F2. Onboarding completo (sem convite)

1. Logado pós-F1, em `/onboarding/familia` informar nome da família e papel (filho/cônjuge/cuidador).
2. Submeter → server fn `createFamilyWithAdmin` cria `families` + `family_members` (admin/active) atomicamente.
3. Em `/onboarding/familiar`, cadastrar paciente (nome obrigatório, data de nascimento, tipo sanguíneo opcional).
4. Em `/onboarding/emergencia`, cadastrar pelo menos 1 contato de emergência.
5. Em `/onboarding/primeira-acao`, escolher próxima ação (adicionar medicamento/agendar/upload).
6. **Esperado:** `profiles.onboarding_step = 3`. Redirect para `/dashboard`. Dashboard mostra paciente cadastrado com seções vazias.

## F3. Login + aceitação de convite

1. Em outra sessão (anônima), abrir link `/convite/{token}` recebido.
2. Se não logado: redirect para `/auth/login?invite={token}`.
3. Entrar com credenciais existentes.
4. **Esperado:** toast "Convite aceito! Bem-vindo à família." e redirect para `/dashboard`. Em `family_members` há nova linha (status='active', role conforme o convite). `invitations.status = 'accepted'`. Se já era membro: toast "Você já é membro desta família."

## F4. Cadastrar medicamento com horários

1. No `/dashboard`, tocar FAB (+) → "Adicionar medicamento".
2. Em `/medicamentos/novo`: nome, dosagem, frequência "2x ao dia", horários `08:00` e `20:00`, status "ativo", salvar.
3. **Esperado:** redirect para `/medicamentos`. Card aparece com badge "Ativo" e "Próximo: 08:00" (ou 20:00). No banco: `schedule = {"times":["08:00","20:00"]}`. `deleted_at IS NULL`.

## F5. Editar e excluir medicamento

1. Em `/medicamentos`, tocar ⋮ no card → bottom sheet abre.
2. "Editar" → muda dosagem → salvar → volta para lista atualizada.
3. ⋮ novamente → "Excluir" → confirmar.
4. **Esperado:** card some da lista. Query `SELECT deleted_at, deleted_by FROM medications WHERE id=...` retorna timestamp e user_id atual. Soft delete, não hard delete.

## F6. Agendar consulta

1. FAB → "Registrar consulta".
2. Em `/agenda/nova`: tipo "Consulta", título, data/hora futura, médico opcional, salvar.
3. **Esperado:** aparece em `/agenda` ordenada por `scheduled_at`. Status="scheduled". Dashboard mostra o agendamento na seção "Próximos compromissos" se ≤7 dias.

## F7. Upload de documento (PDF) + busca FTS

1. FAB → "Subir documento".
2. Em `/documentos/novo`: escolher arquivo PDF (<10MB), título, tipo "Exame", data, paciente, enviar.
3. **Esperado:** redirect `/documentos`. Card aparece. Em `storage.objects` há objeto em `{family_id}/{patient_id}/{uuid}.pdf`. `documents.file_path` armazenado (NÃO `file_url`).
4. Em `/documentos`, digitar termo do título → debounce → lista filtra server-side via `search_vector` (não filtra client).
5. **Tentar upload de HEIC:** selecionar `.heic` → bloqueado antes do upload com mensagem (validação em `documentos.novo.tsx:121-125`).

## F8. Adicionar evento clínico ao histórico

1. FAB → "Adicionar evento clínico".
2. Em `/eventos/novo`: data, tipo "Internação", título, gravidade "Alta", tags livres, médico opcional, salvar.
3. **Esperado:** aparece em `/historico` ordenado `event_date DESC`. Card tem borda esquerda colorida por gravidade. CHECK constraint aceita o tipo (migration M4).

## F9. Visualizar cartão de emergência interno + gerar QR

1. No card do familiar no `/dashboard`, tocar "Emergência" (ou ⚡ no header das outras telas).
2. Em `/emergencia`: gerar link com expiração (ou indefinido), QR Code aparece (`qrcode.react`).
3. Copiar link `/e/{token}`.
4. **Esperado:** linha em `emergency_links` (token 32 bytes hex, `is_active=true`).

## F10. Acessar cartão público de emergência (terceiro)

1. Em janela anônima, abrir o link `/e/{token}`.
2. **Esperado:** página renderiza nome do paciente, alergias com badge de severidade, medicamentos ativos, condições, contatos ordenados por `priority`, últimos 5 documentos como links de URL assinada. `access_logs` ganha linha com `action='emergency_view'`, `ip_address`, `user_agent`. `emergency_links.access_count` incrementa.
3. Token inválido/expirado/inativo → mensagem "Link inválido".

## F11. Convidar membro à família + mudar papel + remover

1. Em `/familia` (como admin), tocar "Convidar" → escolher papel → e-mail opcional → gerar.
2. Copiar URL. Em outra sessão executar F3.
3. Voltar como admin → na lista, ⋮ do novo membro → "Mudar papel" para "Editor".
4. ⋮ → "Remover membro" → confirmar.
5. **Esperado (negativos):** se tentar remover o único admin, server fn rejeita com mensagem PT-BR (`familia.functions.ts:241-251`). Se tentar rebaixar a si mesmo sendo único admin, mesma rejeição.

## F12. Excluir a própria conta com proteção solo-admin

1. Em `/perfil`, "Excluir conta".
2. **Esperado:** se usuário é único admin de alguma família, server fn lança `SOLO_ADMIN` e a UI orienta a transferir admin antes. Caso contrário, `supabaseAdmin.auth.admin.deleteUser` remove a conta; cascade em `family_members` e `profiles` (FK `on delete cascade`).

## F13. Multi-paciente: trocar paciente ativo

1. Cadastrar 2º paciente em `/familia` ou via fluxo dedicado.
2. No `/dashboard`, abrir `PatientSelector` no topo, alternar entre pacientes.
3. **Esperado:** todas as 6 seções (consultas, medicamentos, eventos, documentos, alergias, contatos) recarregam para o novo paciente. ⚠️ Observar se em troca rápida não há flash de dados do paciente anterior (Risco A4 em AUDIT.md).

## F14. Isolamento por família (segurança)

1. Como usuário A (família 1), anotar `patient_id` X.
2. Logar como usuário B (família 2, sem vínculo). Tentar `GET /paciente/X` direto pela URL.
3. **Esperado:** RLS bloqueia. `select` retorna vazio; UI mostra estado de erro/não encontrado. Tentar atualizar `medications`/`appointments`/`documents` desse paciente via DevTools → erro 401/403.

## F15. Fluxo offline / erro de rede

1. Abrir `/dashboard` autenticado.
2. DevTools → throttle "Offline".
3. Tentar trocar paciente, abrir formulário, salvar.
4. **Esperado:** erros tratados via toast (`sonner`); nenhuma tela quebrada. Hoje **não há fila offline** (PWA não implementado).
