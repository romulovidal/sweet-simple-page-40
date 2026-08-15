# Auditoria Corretiva: Estabilização de Operações de Escrita

Este plano visa diagnosticar e corrigir falhas sistêmicas de salvamento no Painel Admin e Painel ATIS, focando em RLS, permissões e integridade de schema.

## 1. Diagnóstico e Auditoria (Turno 1)
- **Identificação da Causa Raiz**:
  - Auditoria de `public.has_role`: A função existe mas parece ter problemas de permissão para o usuário `authenticated` quando chamada via SQL direto (Gateway error 42501).
  - Verificação de Enum: O enum `app_role` contém apenas `{admin, user}`, mas o código refere-se a `super_admin`.
  - Auditoria de RLS: A maioria das tabelas administrativas usa `has_role(auth.uid(), 'admin'::app_role)`.
- **Logs de Erro**: Adição de logs detalhados nas camadas de service/componentes para capturar o erro real do Supabase.

## 2. Correções Sistêmicas (Backend)
- **Ajuste de Roles**: Atualizar o enum `app_role` para incluir `super_admin`.
- **Reparo da Função `has_role`**: Garantir que a função seja `SECURITY DEFINER` e que o usuário `authenticated` tenha permissão de `EXECUTE`.
- **Hierarquia de Permissões**: Modificar `has_role` para que `super_admin` herde permissões de `admin`.
- **Políticas RLS**: Revisar e corrigir políticas que possam estar bloqueando `INSERT` ou `UPDATE` mesmo para administradores.

## 3. Correções no Frontend
- **Alinhamento de Payloads**: Garantir que `atisDb.from().insert/update()` envie apenas campos existentes no schema atual.
- **Tratamento de Loading/Feedback**: Implementar blocos `try/catch/finally` padronizados em todos os formulários.
- **Resiliência do hook `useIsAdmin`**: Garantir que o estado administrativo seja detectado corretamente sem hangs.

## 4. Validação
- Testes manuais de CRUD em:
  - `AdminUsers.tsx` (Profiles)
  - `AtisAutomations.tsx` (Automações)
  - `AtisConfig.tsx` (Configurações Globais)
- Verificação de persistência pós-refresh.
- Verificação de build e TypeScript.

## Detalhes Técnicos
- **Projeto Supabase**: `karyuuhxeismshhxuokg`
- **Tabelas Críticas**: `user_roles`, `profiles`, `atis_notification_configs`, `atis_config`.
- **Camada de Dados**: `atisDb.ts` e `integrations/supabase/client.ts`.
