# Mychael PM

Plataforma estática, responsiva e guiada para preparação de Mychael aos concursos de Soldado da PMGO e da PMDF.

## Arquitetura

`Notion privado → exportação validada → GitHub → GitHub Pages → Supabase`

- O repositório contém somente código, conteúdo publicável, testes e documentação técnica.
- Dados pessoais, respostas, resultados e histórico do estudante ficam fora do conteúdo público do GitHub.
- O progresso será armazenado no Supabase com autenticação e Row Level Security.
- Redação está modelada, mas permanece desativada no MVP.
- TAF integra a primeira versão, sempre distinguindo referência histórica de índice vigente.

## Comandos

```bash
npm run check
npm run manifest
npm run supabase:check
```

## Estado

A estrutura técnica vazia está integrada à `main`. A fundação do Supabase está em branch própria, com migração e validação estática, mas ainda não foi aplicada a um projeto remoto. Nenhum conteúdo editorial do Notion foi exportado.
