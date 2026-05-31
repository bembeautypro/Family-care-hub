## Correções da auditoria dos Prompts 1 e 2

### 1. Server function para criar família + admin (BUG 1 — crítico)

**Problema:** A política `admins can manage family_members` exige que o usuário já seja admin para inserir — bloqueia o INSERT do próprio admin no Passo 3.

**Solução:** Criar `src/lib/onboarding.functions.ts` com `createFamilyWithAdmin` usando `requireSupabaseAuth` + `supabaseAdmin`:

- Validação Zod do nome da família e papel
- Em uma única chamada, usando `supabaseAdmin` (bypassa RLS):
  1. INSERT em `families` com `created_by = userId`
  2. INSERT em `family_members` com `role='admin'`, `status='active'`
  3. UPDATE `profiles.onboarding_step = 1`
- Retorna `{ familyId }`

**Atualizar `src/routes/onboarding/familia.tsx`:**
- Substituir os 3 `supabase.from(...)` por uma única chamada `useServerFn(createFamilyWithAdmin)`
- Manter o `sessionStorage` do `family_id` para o próximo passo

### 2. Mapear severidade de alergias (BUG 2 — crítico)

**Problema:** UI envia `'leve'|'moderada'|'grave'`, DB exige `'low'|'medium'|'high'|'critical'`.

**Solução:** Em `src/routes/onboarding/emergencia.tsx`, ao inserir em `patient_allergies` mapear:
- `leve → low`, `moderada → medium`, `grave → high`
- Manter os rótulos e cores na UI inalterados

### 3. Voltar para confirmação de e-mail obrigatória (divergência 3)

**Mudanças:**
- Chamar `configure_auth` com `auto_confirm_email: false`
- Em `src/routes/auth/registro.tsx`: após `signUp` bem-sucedido, **não** redirecionar para `/onboarding/familia`. Em vez disso, mostrar tela "Verifique seu e-mail" inline (mesmo arquivo, com estado `submitted`), com:
  - Ícone de envelope
  - "Enviamos um link para {email}"
  - Instrução para abrir o e-mail e clicar no link
  - Botão secundário "Reenviar e-mail" (chama `supabase.auth.resend`)
- O `emailRedirectTo: ${origin}/onboarding/familia` já estava configurado — após o usuário clicar no link, o Supabase autentica e redireciona para o Passo 3 com sessão ativa
- Em `src/routes/onboarding/familia.tsx`: se chegar sem sessão, redirecionar para `/auth/login` (já implementado)

Não vou criar templates customizados de e-mail (não foi pedido) — Supabase usa os defaults.

### 4. Hierarquia do "Preencher depois" (minor)

Em `src/routes/onboarding/emergencia.tsx`:
- Trocar `variant="ghost" size="sm"` por `variant="outline"` com `h-[44px]`, texto do mesmo peso visual do CTA principal
- Mover para uma linha separada abaixo do `OnboardingProgress`, alinhado à direita, sem reduzir tamanho

### 5. Não mexer

- Estrutura de pastas (`src/routes/` em vez de `src/pages/`) — adaptação já confirmada
- `relationship` armazenado em `patient.notes` — spec não inclui coluna; manter
- `blood_type = "Não sei"` descartado em vez de salvar `'unknown'` — comportamento aceitável
- `photo_url` em `patients` armazenando file_path — segue a regra "file_path no banco"
- Bucket privado + políticas de storage — já corretas

### Resultado esperado

- Passo 3 funciona end-to-end (família + admin criados atomicamente via service_role)
- Passo 5 aceita alergias sem violar check constraint
- Cadastro exige confirmação de e-mail antes de entrar no Passo 3
- "Preencher depois" tem peso visual equivalente ao CTA primário
