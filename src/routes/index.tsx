ATIS V2 será um motor centralizado de automações e mensagens, no qual cada envio lógico é identificado por configuração + destinatário final + ocorrência canônica. Os runners mantêm apenas suas regras específicas de negócio e delegam resolução de destinatários, idempotência, claim/lease, anti-ban, quiet hours, retry, logs e envio Evolution ao motor compartilhado.

O sistema deve suportar múltiplas automações do mesmo tipo, grupos @g.us, indivíduos, contatos, perfis, tags, múltiplos horários, dias, timezone, automações manuais, automáticas e reativas.

Cada ocorrência gera um único registro em atis_automation_logs; cada tentativa real de envio é registrada separadamente em atis_automation_attempts. Antes do envio, o worker precisa obter claim atômico via atis_claim_automation_occurrence.

Planos, séries, broadcasts e outros módulos especializados preservam suas tabelas e regras próprias; o ATIS V2 centraliza apenas a infraestrutura comum de entrega.

O painel administrativo deve controlar automações, destinatários, horários, templates, IA, retry, anti-ban, quiet hours, status e histórico, sem necessidade de redeploy ou alteração de cron.

Nenhum fluxo migrado pode manter simultaneamente o caminho legado e o V2 realizando o mesmo envio.