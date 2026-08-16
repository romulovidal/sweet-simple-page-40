# Plano de Estabilização Definitiva do ATIS

Este plano visa corrigir os problemas de controle administrativo e status em tempo real do painel ATIS, garantindo que o frontend reflita fielmente o estado da Evolution API e as ações do administrador sejam processadas com segurança.

## Alterações Técnicas

### 1. Autenticação Segura e Hierárquica
- Padronizar todas as Edge Functions do ATIS para usar `requireAdmin` de `_shared/atis-auth.ts`.
- Garantir que a validação de JWT use decodificação manual (bypass de assinatura para projetos migrados) e verificação via RPC `check_user_role` com `service_role`.

### 2. Frontend: Correção do Status e Controle
- **`useAtisStatus.ts`**: Adicionar inscrição em tempo real (Realtime) na tabela `atis_config` para capturar mudanças de status enviadas pelo webhook.
- **`AtisEvolutionConfig.tsx`**: 
  - Melhorar o tratamento de erros nos cliques dos botões para exibir o "Body Real" do erro.
  - Corrigir a lógica de exibição para que, se a instância for detectada como `connected` pela Edge Function, o botão de "Desconectar" apareça imediatamente, permitindo controle da conexão existente.
- **`AtisLayout.tsx`**: Sincronizar o badge de status do header com o estado global do hook.

### 3. Backend: Sincronização de Status (Webhook)
- **`atis-webhook`**: Garantir que o evento `CONNECTION_UPDATE` atualize a coluna `last_connection_state` na tabela `atis_config`.
- **`atis-instance`**: Garantir que a ação `status` consulte a Evolution API em tempo real e retorne o estado normalizado (`open`, `connecting`, `close`).

### 4. Fluxo de "Gerar Nova Conexão"
- Ajustar `atis-instance` para que, se solicitado `create` mas a instância já existir e estiver conectada, retorne o estado atual com sucesso em vez de erro 409 ou duplicidade.

## Testes de Validação (Black-Box)
1. **Teste de Conexão**: Abrir o painel e verificar se o badge mostra "CONECTADO" sem intervenção (baseado na instância atual).
2. **Teste de Controle**: Clicar em "Desconectar" e validar se a instância é encerrada na Evolution API e o status muda no painel.
3. **Teste de Reativação**: Clicar em "Gerar Nova Conexão" e validar a geração de novo QR Code.
4. **Teste de Realtime**: Simular uma desconexão externa e validar se o painel muda para "DESCONECTADO" sem recarregar a página.

## Segurança
- Remoção de qualquer lógica de `auth.getUser()` que falhe em ambientes migrados.
- Manutenção do bypass de emergência apenas para o UUID do proprietário.
