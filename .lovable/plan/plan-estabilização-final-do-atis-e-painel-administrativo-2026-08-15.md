# Plan: Estabilização Final do ATIS e Painel Administrativo

Este plano visa resolver definitivamente os erros `42501 (Permission Denied)` ao salvar configurações, automações e posts no banco de dados, garantindo que o papel `authenticated` tenha os privilégios necessários.

## Ações de Correção

### 1. Backend: Migração de Privilégios (GRANTs)
Criar uma migração abrangente para conceder privilégios de escrita ao papel `authenticated` em todas as tabelas administrativas e garantir o funcionamento da hierarquia `super_admin`.

- **Tabelas Alvo**: `atis_config`, `atis_notification_configs`, `atis_notification_targets`, `admin_posts`, `profiles`, `user_roles`, `admin_settings`.
- **Hierarquia**: Garantir que `has_role` suporte `super_admin` e que o usuário proprietário tenha este papel.

### 2. Frontend: Resiliência e Feedback
Ajustar os componentes administrativos para lidar melhor com falhas e fornecer logs úteis se ocorrerem erros inesperados.

- **Componentes**: `AtisAutomations.tsx`, `AdminUsers.tsx`, `AtisConfig.tsx`, `AdminPosts.tsx`.

## Detalhes Técnicos

### SQL de Migração (Exemplo do que será aplicado)
```sql
-- Garantir acesso ao schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grants em tabelas críticas do ATIS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atis_notification_targets TO authenticated;

-- Grants em tabelas Administrativas
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;

-- Sequências
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

## Próximos Passos
1. Gerar e aplicar a migração de `GRANT`s.
2. Validar a escrita em `atis_config` via console do desenvolvedor.
3. Testar o salvamento de uma nova automação no painel ATIS.
