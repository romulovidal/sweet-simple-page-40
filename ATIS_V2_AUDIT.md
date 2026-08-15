# Auditoria Painel ATIS

## Status
- **Backend:** Conectado (`karyuuhxeismshhxuokg`).
- **Automações:** Identificadas 11 automações em `atis_notification_configs`, misturando `legacy:` e `system:`.
- **Targets:** Registrados e operacionais em `atis_notification_targets`.
- **Configurações Globais:** Operacionais em `atis_automation_settings`.
- **Problemas Identificados:**
    - `AtisDailyDevotional` e `AtisBirthdayAuto` referenciam configs `legacy:`, mas a interface não integra totalmente com os `targets` do V2.
    - O disparo manual (`sendNow`) usa Edge Functions que, embora funcionem, devem ser auditadas para garantir que não bypassam regras globais (`atis_automation_settings`).

## Ações Propostas
1. **AtisAutomations:** Validar se a interface de targets reflete exatamente o estado do backend. (Concluído: Parece robusto).
2. **Componentes Legados:** Converter `AtisDailyDevotional` e `AtisBirthdayAuto` para serem apenas interfaces de configuração, delegando a execução ao motor central V2 sempre que possível.
3. **Logs:** O painel atual de logs (`AtisLogs`) parece já estar alinhado com o esquema `atis_automation_logs`.
4. **Grupos:** Validar sincronização de `notification_types` com o motor V2.

## Validação Real
- Testar a criação de uma automação personalizada no `AtisAutomations`.
- Verificar se as configurações globais (`AtisAdvancedSettings`) estão sendo respeitadas pelo backend.
