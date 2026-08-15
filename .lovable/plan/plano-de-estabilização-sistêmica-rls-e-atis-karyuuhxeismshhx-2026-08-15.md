# Plano de Estabilização Sistêmica RLS e ATIS (karyuuhxeismshhxuokg)

Este plano visa resolver definitivamente as falhas de escrita (RLS) e a interrupção de notificações no projeto Supabase externo `karyuuhxeismshhxuokg`, restaurando as políticas administrativas e ativando o motor global do ATIS.

## Problemas Identificados
- **Políticas RLS Ausentes**: Tabelas como `culto_selections`, `canticos` e `canticos_ministros` não possuem políticas permitindo `INSERT`/`UPDATE`/`DELETE` para administradores no banco de dados alvo.
- **Inconsistência de Tipos**: Algumas políticas usam `::app_role` e outras `::text`, causando falhas na chamada da função `has_role`.
- **Motor ATIS Desativado**: A flag `global_enabled` na tabela `atis_automation_settings` está configurada como `false`.
- **Hierarquia Incompleta**: O usuário proprietário (`5850679f-697b-4ec2-a47c-47b88a96bffa`) possui o papel `admin`, mas o sistema deve utilizar `super_admin` para privilégios totais.

## Ações Propostas

### 1. Correção de Banco de Dados (via psql e TARGET_SUPABASE_DB_URL)
- **Unificar `has_role`**: Garantir que as duas versões da função (uma recebendo `text` e outra `app_role`) sejam hierárquicas e utilizem `SECURITY DEFINER`.
- **Promover Proprietário**: Alterar o papel do UUID `5850679f-697b-4ec2-a47c-47b88a96bffa` para `super_admin`.
- **Restaurar Políticas RLS**:
    - Aplicar `GRANT ALL` e políticas de `ALL` para os papéis `admin` e `super_admin` em todas as tabelas administrativas:
        - `culto_selections`, `culto_schedules`, `culto_reminders`
        - `canticos`, `canticos_ministros`, `canticos_ministros_link`
        - `admin_posts`, `admin_plans`, `admin_plan_readings`, `admin_settings`
        - `atis_config`, `atis_notification_configs`, `atis_notification_targets`, `atis_automation_settings`
        - `user_roles`, `profiles`
- **Ativar Motor ATIS**: Definir `global_enabled = true` em `atis_automation_settings`.

### 2. Sincronização de Frontend
- **Auditoria de `useIsAdmin`**: Garantir que o hook reconheça corretamente a hierarquia `super_admin -> admin` baseada nos dados reais retornados pelo banco.
- **Limpeza de Fallbacks**: Remover fallbacks manuais de UUID agora que o RLS estará funcional.

## Detalhes Técnicos
As mudanças no banco de dados serão aplicadas via `psql` utilizando o segredo `TARGET_SUPABASE_DB_URL`, contornando a desativação das ferramentas `supabase` no workspace atual que estão vinculadas ao projeto antigo.

```sql
-- Exemplo de correção de política
DROP POLICY IF EXISTS "Admins can manage culto selections" ON public.culto_selections;
CREATE POLICY "Admins can manage culto selections" 
ON public.culto_selections FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
```
