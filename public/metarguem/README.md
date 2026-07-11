# Modo Metarguem — arquivos offline

Cada arquivo `{livro}/{capítulo}.json` contém os versículos com:
- `original` — texto hebraico (BHS/WLC) ou grego (Nestle base) pontuado, na ordem original
- `transliteration` — transliteração acadêmica alinhada palavra a palavra
- `literal` — tradução literal em **inglês** (Berean Standard Bible, domínio público)

O app tenta carregar daqui primeiro; se um arquivo não existir, cai para IA online.

**Fonte:** Berean Standard Bible Translation Tables — https://bereanbible.com/bsb_tables.tsv
Uso livre (incluindo comercial), sem restrições de copyright.

Para regenerar: `node scripts/build-metarguem-from-bsb.mjs`