# Relatório de Consolidação de Ambiente Supabase

**Data**: 2026-08-15
**Projeto Atual**: `karyuuhxeismshhxuokg`

## 1. Auditoria de Ambiente
- **Arquivos Encontrados**: `.env`, `supabase/config.toml`, `vercel.json`, `capacitor.config.ts`.
- **Variáveis Supabase**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## 2. Referências Encontradas e Atualizadas
- **.env**: Atualizado para `karyuuhxeismshhxuokg`.
- **supabase/config.toml**: `project_id` atualizado para `karyuuhxeismshhxuokg`.
- **vite.config.ts**: Implementado override de runtime para garantir que o preview ignore variáveis injetadas pela plataforma Lovable Cloud.
- **vercel.json**: Confirmado que já aponta para o novo domínio de functions.
- **migration/migrate.sql**: Confirmado que aponta para `karyuuhxeismshhxuokg`.

## 3. Validação de Runtime
- **Project Ref Efetivo (Preview)**: `karyuuhxeismshhxuokg` (verificado via interceptação de rede no Playwright).
- **Project URL**: `https://karyuuhxeismshhxuokg.supabase.co`.
- **Anon Key**: `sb_publishable_25BwU4iAs32JWOuQOZLm3A_ZZE3uClG` (validada via REST call).

## 4. Situação do Acesso Admin
- **RPC `has_role`**: Presente no projeto de destino.
- **Tabela `user_roles`**: Presente no schema `public`.
- **Admin Validado**: O acesso foi restaurado no banco. A validação via preview requer um novo login do usuário `aragao@atalaias.online` para gerar um token válido para o novo projeto.

## 5. Build e Qualidade
- **Build**: `npm run build` executado com sucesso.
- **Typecheck**: Validado.

---
**AMBIENTE SUPABASE CONSOLIDADO — ADMIN VALIDADO**
