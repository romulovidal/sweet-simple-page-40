# Plano de Estabilização das Notificações ATIS V2

Este plano visa restaurar completamente o pipeline de notificações (automáticas e manuais) do sistema ATIS, garantindo que o motor global esteja ativo, os agendamentos configurados e as permissões de banco devidamente ajustadas para o projeto `karyuuhxeismshhxuokg`.

## Diagnóstico Atual
- **Motor Global:** Desativado (`global_enabled = false` no banco).
- **Agendador (Cron):** Ausência do job unificado `atis-send`. Múltiplos runners especializados ativos, o que pode causar fragmentação.
- **Permissões:** Edge Functions (que usam `service_role`) podem estar enfrentando bloqueios de RLS ou falta de `GRANT` em tabelas de logs/attempts.
- **Targets:** Configurações críticas (como Versículo do Dia) estão sem alvos (targets) definidos na tabela `atis_notification_targets`.

## Ações Planejadas

### 1. Banco de Dados e Infraestrutura (Supabase)
- **Ativação:** Habilitar `global_enabled` na tabela `atis_automation_settings`.
- **Segurança:** Aplicar `GRANT ALL` para `service_role` nas tabelas `atis_automation_logs` e `atis_automation_attempts`.
- **Agendamento:** Criar o job `atis-global-tick` no `pg_cron` para disparar o runner unificado a cada minuto.
- **Idempotência:** Garantir permissões de execução na RPC `atis_claim_automation_occurrence`.

### 2. Ajustes de Código (Edge Functions)
- **Runner Unificado:** Revisar `atis-v2-runner.ts` para garantir que ele processe corretamente todas as automações que não possuem runners específicos.
- **Anti-ban:** Validar que o `atis-antiban.ts` não bloqueie envios manuais solicitados pelo administrador (botão "Enviar agora").
- **Logs:** Garantir rastreabilidade total (logs e attempts vinculados corretamente).

### 3. Frontend Administrativo
- **Correção de Permissões:** Ajustar `AtisAdvancedSettings.tsx` para evitar erros de permissão ao salvar configurações globais.
- **Feedback Visual:** Garantir que o botão "Enviar agora" forneça detalhes claros sobre o sucesso ou falha da operação (resolvendo o problema de toasts genéricos).

### 4. Validação Técnica
- **Teste Manual:** Acionar "Enviar agora" para uma configuração de teste e rastrear o fluxo completo até a Evolution API.
- **Teste Automático:** Monitorar a execução do `atis-global-tick` e verificar se as automações elegíveis são processadas.

## Detalhes Técnicos
- **Hierarquia:** Manter suporte a `super_admin` para o proprietário (`5850679f-697b-4ec2-a47c-47b88a96bffa`).
- **Timezone:** Todas as operações baseadas em `America/Fortaleza`.
- **Evolution API:** O envio final deve ser validado contra o endpoint real configurado, capturando respostas HTTP e estados da instância.
