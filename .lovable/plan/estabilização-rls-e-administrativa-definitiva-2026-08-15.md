# Estabilização RLS e Administrativa Definitiva

Corrigindo bloqueios de escrita e falhas nas políticas RLS que impedem operações de Admin/Super Admin em Cultos, Cânticos, ATIS e Painel Geral.

## Problemas Identificados
1. **RLS Rejeitando INSERTs:** Tabelas como `culto_selections` e `canticos` possuem políticas que dependem de `has_role`, mas falham ao validar o novo registro ou a sessão do admin.
2. **Hierarquia Incompleta:** `super_admin` não herda privilégios em todas as policies se a verificação for literal `role = 'admin'`.
3. **ATIS V2 Motor Parado:** `global_enabled` em `false` e RLS possivelmente travando a criação de logs de automação durante o envio.
4. **Falta de Políticas de Escrita:** Algumas tabelas administrativas têm `SELECT` para todos, mas não têm políticas explícitas de `INSERT/UPDATE` para admins.

## Plano de Ação

### 1. Migration de Segurança Sistêmica
Criar uma migration única que:
- Garante a função `public.has_role` como `SECURITY DEFINER` e hierárquica (`super_admin` > `admin`).
- Corrige/Adiciona políticas `FOR ALL` (Select, Insert, Update, Delete) para as roles administrativas em todas as tabelas listadas.
- Prioriza o uso de `WITH CHECK` para garantir que o Admin possa ler o que acabou de inserir (evitando erro de RLS no RETURNING).
- Ativa o motor ATIS V2 (`global_enabled = true`).

### 2. Tabelas Afetadas
- **Cultos/Manejo:** `culto_reminders`, `culto_schedules`, `culto_selections`.
- **Cânticos/Ministros:** `canticos`, `canticos_ministros`, `canticos_ministros_link`.
- **ATIS:** `atis_notification_configs`, `atis_notification_targets`, `atis_config`, `atis_automation_settings`, `atis_automation_logs`, `atis_automation_attempts`.
- **Admin Geral:** `admin_posts`, `admin_plans`, `admin_plan_readings`, `admin_settings`, `profiles`.

### 3. Validação
- Testar criação de Seleção de Culto.
- Testar criação de Cântico e vínculo de Ministro.
- Testar alteração de Configuração ATIS.
- Testar "Enviar Agora" no ATIS para verificar o fluxo de Log/Attempt.

### 4. Notificações
- Verificar se `atis-tick` ou `atis-send` estão falhando ao gravar logs por causa de RLS (embora usem `service_role`, políticas mal escritas ou falta de bypass podem afetar).
