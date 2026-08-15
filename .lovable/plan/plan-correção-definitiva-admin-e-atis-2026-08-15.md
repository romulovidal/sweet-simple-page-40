# Plan: Correção Definitiva Admin e ATIS

## Problema
O sistema administrativo e o motor de notificações ATIS estão bloqueados por:
1.  **Bloqueio de Escrita no Banco:** O papel `authenticated` não possui privilégios `GRANT` básicos nas tabelas administrativas, resultando em erro `42501`.
2.  **Motor ATIS V2 Paralisado:** A configuração `global_enabled` está como `false` e a hierarquia de `super_admin` não está totalmente reconhecida no enum `app_role`.
3.  **Falha de Notificações:** O runner central aborta devido ao desligamento global e a ausência de privilégios para processar claims de tarefas.

## Ações

### 1. Backend (Supabase Migrations)
Criar e aplicar uma migração definitiva para:
-   Adicionar `super_admin` ao enum `app_role`.
-   Conceder privilégios `SELECT, INSERT, UPDATE, DELETE` para o papel `authenticated` em: `atis_notification_configs`, `atis_notification_targets`, `atis_automation_settings`, `atis_config`, `profiles`, `admin_posts`, `admin_settings`, `admin_plans`, `culto_schedules`, `culto_reminders`.
-   Recriar `public.has_role` como `SECURITY DEFINER` com suporte a hierarquia.
-   Ativar o motor global: `UPDATE atis_automation_settings SET global_enabled = true WHERE id = 1;`.
-   Garantir privilégios em funções e sequências.

### 2. Frontend (Resiliência)
-   Refatorar `useIsAdmin.ts` para não depender apenas da RPC se ela falhar por permissão, usando a consulta direta à tabela `user_roles`.
-   Atualizar `AtisAutomations.tsx` e `AdminCultoSchedule.tsx` para garantir que o payload de salvamento esteja alinhado com o esquema real e que erros de permissão sejam tratados visualmente.
-   Forçar um "Refresh Status" na Evolution API para validar conectividade.

### 3. Validação
-   Executar disparo manual de uma notificação e verificar `atis_automation_logs`.
-   Salvar um novo Culto e verificar persistência.
-   Alterar uma configuração global do ATIS e verificar atualização.

## Detalhes Técnicos
-   O gateway de banco de dados do sandbox é read-only, portanto, as alterações de `GRANT` e `ALTER` serão entregues via arquivo de migração na pasta `supabase/migrations/` para que o sistema as processe no deploy/build.
-   A hierarquia de roles será: `super_admin` > `admin` > `user`.
