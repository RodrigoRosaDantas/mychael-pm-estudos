# Lotes editoriais publicados

Esta pasta contém exportações editoriais públicas provenientes do Notion privado.

- `lot-0003.json`: U003, M003, Q000012 a Q000017 e QS003.
- `lot-0004-core.json`: taxonomia, fontes, U004 e M004.
- `lot-0004-questions.json`: Q000018 a Q000023 e QS004.

O script `scripts/assemble-published-catalog.mjs` monta o catálogo cumulativo de forma idempotente, preservando U001 e U002, removendo versões anteriores dos mesmos IDs antes de incorporar os lotes e recalculando o manifesto público.

Os arquivos não contêm respostas pessoais, resultados, credenciais ou dados de progresso do estudante.
