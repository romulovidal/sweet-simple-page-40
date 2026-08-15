# Auditoria Corretiva: Estabilização de Operações de Escrita (Foco: karyuuhxeismshhxuokg)

Este plano visa diagnosticar e corrigir falhas sistêmicas de salvamento no Painel Admin e Painel ATIS, focando em RLS, permissões e integridade de schema no projeto oficial `karyuuhxeismshhxuokg`.

## 1. Diagnóstico Real via Frontend (Turno 1)
- **Captura de Erros**: Adicionar logging detalhado em todos os fluxos de mutação (insert/update/delete) no Admin e ATIS para identificar o código de erro, mensagem e contexto (tabela/coluna) retornados pelo Supabase.
- **Auditoria de Autorização**:
  - Validar se o token JWT do usuário `authenticated` está sendo passado corretamente.
  - Verificar se a falha `42501` ocorre por falta de `EXECUTE` na função `has_role` ou falta de privilégios (`GRANT`) nas tabelas.
- **Investigação de Hierarquia**: Confirmar via logs se o `super_admin` está sendo reconhecido tanto no frontend (`useIsAdmin`) quanto nas políticas RLS do backend.

## 2. Correções de Infraestrutura (se necessário)
- **Permissões Globais**: Garantir que o papel `authenticated` tenha `USAGE` no schema `public` e as permissões necessárias (`SELECT, INSERT, UPDATE, DELETE`) em todas as tabelas administrativas.
- **Sincronização de Schema**: Corrigir discrepâncias entre o payload enviado pelo frontend e as colunas reais no banco (ex: campos obrigatórios ausentes ou colunas renomeadas).
- **Reparo de Políticas RLS**: Ajustar políticas que possam estar bloqueando mutações legítimas, garantindo que a hierarquia `super_admin -> admin` seja respeitada no backend.

## 3. Estabilização dos Painéis
- **Admin**: Validar fluxos de Usuários, Posts, Planos e Configurações.
- **ATIS**: Validar Automações, Configurações Globais, Evolution API e Targets.
- **UX de Erro**: Implementar feedback claro para o usuário em caso de falha, evitando "loading infinito".

## 4. Validação e Testes
- Testes de CRUD reais contra o projeto `karyuuhxeismshhxuokg`.
- Verificação de persistência e refetch.
- Auditoria final de console e build.
