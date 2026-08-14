# Auditoria e Restauração de Acesso Administrativo

Este plano visa corrigir a falha de acesso dos administradores após a migração para o novo projeto Supabase, restaurando as permissões de API (GRANTS) que não foram migradas.

## 1. Diagnóstico Identificado
- **Roles Presentes**: O usuário possui a role `admin` na tabela `public.user_roles`.
- **RLS Ativo**: As tabelas possuem RLS protegendo o acesso com base na função `has_role()`.
- **Causa Raiz**: As tabelas e a função `has_role()` não possuem permissões de execução/leitura (`GRANT`) para os papéis `authenticated` e `anon`. No Supabase, sem `GRANT`, a API REST (PostgREST) retorna erro de permissão antes mesmo de processar o RLS.

## 2. Ações Corretivas

### Fase 1: Permissões de Segurança Base
Restaurar acesso à infraestrutura de roles para que o hook `useIsAdmin` funcione.
- `GRANT SELECT ON public.user_roles TO authenticated, service_role;`
- `GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, service_role;`
- `GRANT EXECUTE ON FUNCTION private.has_role TO authenticated, service_role;`

### Fase 2: Restauração Global de Acesso às Tabelas
Garantir que todas as tabelas públicas sejam acessíveis pela API (conforme ditado pelo RLS).
- Aplicar `GRANT ALL` em todas as tabelas do esquema `public` para `authenticated` e `service_role`.
- Aplicar `GRANT SELECT` em tabelas públicas (posts, plans, badges) para o papel `anon`.

## 3. Detalhes Técnicos
A migração utilizará um bloco anônimo `DO $$` para iterar sobre todas as tabelas e aplicar os grants de forma segura e abrangente, evitando falhas manuais por esquecimento de tabelas novas.

## 4. Verificação
Após a aplicação, o comando `lovable auth-session` (ou o acesso real do usuário) deve permitir a visualização do painel ATIS e outras áreas restritas.
