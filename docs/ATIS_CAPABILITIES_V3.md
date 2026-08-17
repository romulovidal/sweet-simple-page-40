# ATIS V3 — Capacidades de conversa e operação

Este documento registra o pacote operacional promovido para o ATIS V3.

## Conversa
- Memória e estado por conversa/destinatário.
- Modos Normal, Estudo e Conciso.
- Bíblia conversacional com continuidade de referência.
- Harpa contextual e consulta de Cânticos/programação de louvor.
- Consulta de Cultos a partir dos dados reais do app.
- Devocional sob demanda usando a fonte bíblica do app.
- Pedido de oração privado somente após confirmação explícita.
- Link contextual “Continue no app”.
- Áudio opcional; texto permanece como resposta principal.
- Botões interativos opcionais e desligados por padrão.

## Controle por destinatário
- Estilo de resposta e instrução administrativa de estilo.
- Horário silencioso.
- Cooldown e limite de respostas por janela.
- Em grupos, opção de responder somente quando o ATIS for chamado.

## Painel
- Enviar: validação, fila e agendamento usando `atis-send`.
- Automações: CRUD sobre o motor existente do ATIS.
- Histórico: conversas, métricas, grupos mais ativos, perguntas não respondidas e pedidos de oração.

## Segurança
- Administração continua autenticada por Supabase Auth + `user_roles`.
- Escritas privilegiadas ficam server-side.
- A RPC de orçamento de respostas é executável apenas por `service_role`/Postgres.
- O ATIS não usa a agenda pessoal/phonebook do WhatsApp como fonte de contatos.
