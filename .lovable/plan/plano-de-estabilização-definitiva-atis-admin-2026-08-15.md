# Plano de Estabilização Definitiva - ATIS & Admin

Este plano corrige as falhas funcionais no Painel Administrativo e no motor de automação ATIS, garantindo que o sistema real persista dados e envie notificações conforme esperado.

## Diagnóstico Técnico

1.  **ATIS V2 Inativo:** O motor global está desligado (`global_enabled = false`), bloqueando todas as automações, apesar dos cron jobs estarem ativos.
2.  **Permissões (GRANTs):** O papel `authenticated` carece de privilégios de escrita em tabelas essenciais (Cultos, Planos, Posts, Configurações), resultando em erros `42501` mesmo com RLS configurado.
3.  **Hierarquia Admin:** A função `has_role` não processa corretamente a superioridade de `super_admin` e `admin`, impedindo o acesso ou a mutação em fluxos protegidos.
4.  **Feedback Visual:** Erros de permissão no frontend são genéricos, dificultando a identificação de falhas de escrita pelo usuário.

## Ações de Correção

### 1. Backend (Infraestrutura e Dados)
*   **Ativar Motor ATIS:** Forçar `global_enabled = true` na tabela `atis_automation_settings`.
*   **Privilégios PostgreSQL:** Aplicar `GRANT` massivo para o papel `authenticated` em todas as tabelas administrativas e de cultos.
*   **Hierarquia de Papéis:** Atualizar a RPC `has_role` para ser `SECURITY DEFINER` e considerar que um `super_admin` possui todos os privilégios de `admin` e `user`.
*   **Provisionamento Admin:** Garantir que o UUID do proprietário (`5850679f-697b-4ec2-a47c-47b88a96bffa`) possua o papel `super_admin`.

### 2. Frontend (Resiliência e Persistência)
*   **Cultos:** Corrigir o tratamento de erro em `AdminCultoSchedule.tsx` para expor falhas de permissão e garantir que o payload de salvamento corresponda ao schema (removendo campos virtuais se necessário).
*   **Planos e Leituras:** Atualizar `AdminPlans.tsx` com logs detalhados e alertas específicos para erros `42501`.
*   **Posts:** Refatorar `AdminPosts.tsx` para garantir que exclusões e atualizações de visibilidade não falhem silenciosamente.
*   **ATIS Config:** Ajustar `AtisConfig.tsx` e `AtisAdvancedSettings.tsx` para lidar com a ausência de privilégios de escrita de forma elegante, sugerindo a correção via console quando detectada.

### 3. Notificações e Scheduler
*   **Validação de Cron:** Auditar os jobs `pg_cron` para garantir que chamam as Edge Functions corretas com o `anon key` atualizado.
*   **Fluxo de Envio:** Testar o disparo manual em `AtisAutomations.tsx` para validar a comunicação com a Evolution API.

## Critérios de Sucesso
*   Alterações em "Cultos" persistem após refresh da página.
*   O motor global do ATIS aparece como "Ativo" no painel.
*   Notificações de teste chegam ao WhatsApp de destino.
*   Nenhum erro `42501` é retornado para o Super Admin ao salvar configurações.
