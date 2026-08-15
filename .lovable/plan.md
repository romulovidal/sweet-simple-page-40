# Estabilização Final ATIS e Painel Admin

## Status Atual
- **Causa Raiz**: Falha de privilégios (`GRANT`) no PostgreSQL para o papel `authenticated` em tabelas administrativas no projeto `karyuuhxeismshhxuokg`.
- **Sintoma**: Erro `42501 permission denied` em operações de escrita (Insert/Update/Delete).

## Ações Realizadas
1. **Migration de Privilégios**: Criada migration `20260816000000_fix_admin_grants.sql` que:
   - Concede `USAGE` no schema `public`.
   - Concede privilégios de CRUD nas tabelas do ATIS e Admin.
   - Concede `EXECUTE` nas funções de validação de permissão.
   - Define `DEFAULT PRIVILEGES` para evitar regressões em futuras tabelas.

## Verificação Necessária
1. **Executar Migration**: A migration deve ser aplicada ao banco `karyuuhxeismshhxuokg`.
2. **Teste de Fluxo**:
   - **ATIS**: Editar uma automação em `AtisAutomations.tsx`.
   - **Admin**: Editar um post em `AdminPosts.tsx`.
   - **Profiles**: Editar nome de usuário em `AdminUsers.tsx`.

## Próximos Passos
- Se erros persistirem após a aplicação da migration, verificar se o enum `app_role` contém o valor `super_admin` e se a RPC `has_role` está operando corretamente como `SECURITY DEFINER`.
