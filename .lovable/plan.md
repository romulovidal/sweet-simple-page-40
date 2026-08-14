# Etapa 6: Homologação ATIS V2

Implementação do roteiro de testes e homologação pré-produção para o motor ATIS V2.

## Plano de Testes

### 1. Auditoria Realtime (AtisLogs.tsx)
- Validar se a interface utiliza Supabase Realtime para logs.
- Verificar vazamentos de memória ou subscrições duplicadas.

### 2. Ambiente de Teste
- Utilizar targets seguros (JIDs de teste, perfis administrativos).
- Criar automação `custom:hml_test`.

### 3. Roteiro de Homologação (30 Itens)
1. **Automação Personalizada**: Criar e validar persistência.
2. **Ciclo de Sucesso**: Monitorar transição de status.
3. **Idempotência**: Validar bloqueio de envios duplicados.
4. **Target Profile**: Resolução de IDs de perfil.
5. **Target Contact**: Resolução de contatos manuais.
6. **Group JID**: Preservação literal de `@g.us`.
7. **JID Individual**: Preservação de `@s.whatsapp.net`.
8. **Tag**: Resolução de grupos de tags.
9. **All Authenticated**: Validação lógica (sem envio massivo).
10. **Quiet Hours**: Testar bloqueio em janelas de silêncio.
11. **Limite por Minuto**: Validar `max_messages_per_minute`.
12. **Caps Diários/Horários**: Validar limites de volume.
13. **Delay e Jitter**: Verificar intervalos entre mensagens.
14. **Retry Controlado**: Provocar falha e validar `next_retry_at`.
15. **Failed Definitivo**: Alcançar limite de retries.
16. **Skipped**: Validar motivos de pulo.
17. **System:Birthday**: Sincronia entre telas e ausência de split-brain.
18. **System:Devotional**: Validação do fluxo devocional.
19. **System:Welcome**: Proteção do horário sentinela `00:00`.
20. **System:Broadcasts**: Validação do motor de agendamentos.
21. **Logs e Attempts**: Auditoria de campos e timestamps.
22. **Sanitização**: Mascaramento de secrets nos logs.
23. **Status Desconhecido**: Fallback de UI.
24. **Mobile**: Responsividade das telas de gestão.
25. **Concorrência**: Updates parciais atômicos.
26. **Reinício**: Persistência de estado após reload.
27. **Desativar Motor**: Testar `global_enabled`.
28. **Desativar Automação**: Bloqueio individual.
29. **Falha Parcial**: Comportamento com múltiplos targets.
30. **Auditoria de Escrita**: Garantir que logs são read-only.

## Relatório Final
Ao concluir, apresentarei o status de cada teste (PASS/FAIL/BLOCKED) e a recomendação para produção.
