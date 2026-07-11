# Modo Metarguem — arquivos offline

Cada arquivo `{livro}/{capítulo}.json` contém os versículos com original, transliteração e tradução literal, pré-gerados pela IA.

O app tenta carregar daqui primeiro; se o arquivo não existir, chama a IA online.

Para gerar: veja `scripts/generate-metarguem.mjs`.