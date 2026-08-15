---
title: Consolidação de RLS e Hierarquia Admin/Super Admin
description: Plano para normalizar a hierarquia de permissões no Supabase e corrigir o pipeline de notificações push.
---

# Plano de Consolidação e Correção de Autorização

Investiguei a arquitetura atual e identifiquei que o problema principal reside na função `public.has_role`, que utiliza `SECURITY INVOKER` e impõe restrições de `auth.uid()`, além de políticas RLS que não contemplam a hierarquia `super_admin > admin`.

## Etapas de Execução

### 1. Banco de Dados (Supabase)
Criar uma migration de consolidação para:
- **Normalizar Roles**: Garantir que o enum `app_role` contenha `super_admin`, `admin` e `user`.
- **Refatorar has_role**: Criar uma versão definitiva em `public` com `SECURITY DEFINER` e hierarquia integrada.
- **Hierarquia**: `super_admin` deve herdar permissões de `admin`.
- **RLS Recursiva**: Corrigir a política da tabela `user_roles` para permitir que administradores leiam roles sem causar loops.
- **Grants**: Assegurar `GRANT ALL` para `authenticated` nas tabelas administrativas.

### 2. Edge Functions
Validar as funções de push (`send-push`, `daily-verse-push`, `culto-reminder`):
- Confirmar se o uso do `service_role` interno para verificação de permissões (já presente em parte do código) está operando corretamente após a normalização do banco.
- Garantir que falhas de RLS não interrompam o log de envios.

### 3. Frontend
Ajustar componentes administrativos para:
- Respeitar a hierarquia visual (super_admin vê ferramentas de gestão de roles).
- Exibir mensagens de erro detalhadas provenientes das Edge Functions.

## Detalhes Técnicos

### Hierarquia de Roles
A função `has_role` será alterada para:
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean AS $$
  -- Se pedir 'user', qualquer um autenticado tem.
  -- Se pedir 'admin', super_admin também passa.
  -- Se pedir 'super_admin', só super_admin passa.
$$ ...
```

### Tabelas Prioritárias para Auditoria de RLS
- `user_roles`
- `admin_posts`
- `admin_plans`
- `atis_config`
- `push_log`
- `profiles`
