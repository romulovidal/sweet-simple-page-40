# ATIS V2 — ETAPA 8: INVENTÁRIO FINAL + EXECUÇÃO CONTROLADA DO CUTOVER

Continue a Etapa 8 do ATIS V2.

O estado atual é:

- "global_enabled = false";
- "pg_cron" identificado;
- 11 jobs legados ativos;
- 4 jobs principais mapeados individualmente;
- 7 jobs restantes ainda precisam ser identificados individualmente;
- "atis-send" identificado como entrypoint consolidado V2;
- scheduler V2 proposto: "* * * * *";
- ambiente anterior: READ-ONLY;
- Canary runtime ainda não executada.

REGRA CRÍTICA

NÃO execute o cutover enquanto os 11 jobs não estiverem individualmente identificados e classificados.

A descrição:

"Outros 7 jobs menores — MIGRATED"

não é evidência suficiente.

---

1. VERIFICAR PERMISSÃO ATUAL

Determine novamente a role efetiva.

Se continuar READ-ONLY:

não tente contornar.

Complete apenas a auditoria e finalize:

"CUTOVER BLOCKED — ADMIN WRITE ACCESS REQUIRED"

Se houver escrita administrativa legítima, continue.

---

2. INVENTARIAR OS 11 JOBS INDIVIDUALMENTE

Produza obrigatoriamente:

#| Job Name| Schedule| Edge Function| Finalidade| Config V2| Classificação

Não agrupar nenhum job.

Cada um deve ser classificado:

- MIGRATED
- PARTIALLY_MIGRATED
- LEGACY_REQUIRED
- OBSOLETE
- UNKNOWN

---

3. PROVAR A COBERTURA V2

Para cada job marcado MIGRATED, localizar no código o caminho V2 que substitui seu comportamento.

Não classificar MIGRATED apenas porque existe uma config com nome parecido.

Comprovar:

"Job legado → comportamento legado → config/source_key V2 → runner V2 responsável"

---

4. VERIFICAR EFEITOS COLATERAIS DOS RUNNERS LEGADOS

Para cada Edge Function antiga, identificar se ela faz algo além do envio.

Exemplos:

- atualizar progresso;
- registrar aniversário processado;
- criar dados;
- atualizar subscriber;
- calcular conteúdo;
- alterar status;
- gerar mensagem;
- limpar fila;
- executar manutenção.

Se "atis-send" apenas enviar a mensagem, mas a função antiga também executar efeitos necessários:

classificar:

"PARTIALLY_MIGRATED"

e NÃO desativar esse job.

---

5. CONFIRMAR MODELO A

Revalidar se realmente deve existir:

"1 cron → atis-send → todas as configs"

Se confirmado:

Schedule:

"* * * * *"

Documentar por que execução a cada minuto não cria:

- sobreposição perigosa;
- duplicidade;
- problemas com lease;
- processamento concorrente excessivo.

---

6. PREPARAR SQL, MAS NÃO EXECUTAR IMEDIATAMENTE

Produzir primeiro três blocos separados:

A — Snapshot/Rollback

SQL necessário para reconstruir os 11 jobs exatamente.

B — Scheduler V2

SQL mínimo necessário para criar:

"atis-send-every-minute"

C — Desativação Legacy

SQL necessário para desativar/remover SOMENTE jobs comprovadamente substituídos.

Não executar até validar os três blocos.

Não expor tokens/secrets no relatório.

---

7. CUTOVER COM KILL SWITCH

Somente com acesso administrativo e cobertura comprovada:

confirmar:

"global_enabled = false"

Então:

1. registrar snapshot;
2. criar scheduler V2;
3. manter legacy temporariamente enquanto motor V2 está OFF;
4. confirmar que scheduler V2 executa;
5. confirmar chamada real a "atis-send";
6. confirmar que "global_enabled=false" interrompe processamento;
7. somente então desativar os jobs legados efetivamente substituídos.

Nenhuma mensagem deve sair nessa fase.

---

8. NÃO APAGAR JOBS LEGADOS INICIALMENTE

Se tecnicamente possível, preferir:

"DISABLED"

em vez de remoção definitiva.

Objetivo:

permitir rollback rápido.

Só remover definitivamente após estabilização posterior.

---

9. TESTE DO SCHEDULER V2

Com motor OFF, comprovar dinamicamente:

"pg_cron"
→ "pg_net"
→ "atis-send"
→ runner
→ "global_enabled=false"
→ encerramento seguro.

Registrar timestamps e resultado HTTP quando disponíveis.

Isso transforma Kill Switch de evidência estática para:

"PASS DINÂMICO"

---

10. CANARY

Somente depois do scheduler V2 estar comprovadamente funcionando.

Antes de:

"global_enabled=true"

listar TODAS as configs V2:

"enabled=true"

que poderiam ficar elegíveis.

Se houver risco de outras mensagens:

não ativar globalmente.

CANARY = BLOCKED.

Se estiver isolado:

criar:

"CANARY — ATIS V2"

somente para target controlado.

---

11. EXECUTAR CANARY

Temporariamente:

"global_enabled: false → true"

Aguardar scheduler real.

Observar:

"pg_cron"
→ "atis-send"
→ runner
→ occurrence
→ claim
→ resolver
→ provider
→ log/attempt.

Depois da evidência necessária:

IMEDIATAMENTE:

"global_enabled: true → false"

Reler e confirmar.

---

12. IDEMPOTÊNCIA RUNTIME

Não classificar como PASS dinâmico apenas pela UNIQUE/RPC.

Depois da Canary, observar nova passagem do scheduler para a mesma ocorrência.

Comprovar:

- uma ocorrência canônica;
- claim único;
- ausência de segundo envio físico;
- ausência de duplicação no provider.

Então classificar:

"PASS DINÂMICO".

---

13. ESTADO FINAL OBRIGATÓRIO

Ao terminar:

"global_enabled = false"

Scheduler V2:

documentar ACTIVE/INACTIVE.

Cada um dos 11 schedulers antigos:

documentar individualmente:

- ACTIVE
- DISABLED
- REQUIRED

Não deixar estado ambíguo.

---

14. RELATÓRIO

Apresente:

Inventário completo

Todos os 11 jobs, sem agrupamento.

Cobertura

Mapeamento Legacy → V2 de cada um.

Side effects

Quais funções legadas executavam ações além do envio.

Permissões

READ-ONLY ou ADMIN WRITE.

Scheduler V2

Configuração efetivamente encontrada/criada.

Cutover

Executado ou BLOCKED.

Canary

PASS / FAIL / BLOCKED.

Idempotência

Separar:

- Estrutural
- Runtime

Rollback

Confirmar que o estado anterior pode ser reconstruído.

Estado final

Confirmar:

"global_enabled = false"

GATE FINAL

Escolha exatamente um:

CUTOVER + CANARY CONCLUÍDOS

CUTOVER CONCLUÍDO — CANARY PENDENTE

CUTOVER BLOCKED — ADMIN WRITE ACCESS REQUIRED

NÃO APROVADO PARA CUTOVER

Não implemente funcionalidades novas.

Não contorne permissões.

Não deixe "global_enabled=true".

