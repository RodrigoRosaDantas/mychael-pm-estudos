# Exportação controlada do Notion

O exportador recebe um snapshot estruturado produzido a partir do Notion privado e nunca acessa o workspace com credenciais armazenadas no repositório.

## Fluxo

```text
Notion privado
→ snapshot temporário
→ validações editoriais e técnicas
→ manifesto com fingerprints e SHA-256
→ catálogo público somente quando autorizado
→ branch
→ testes
→ pull request
→ merge autorizado
→ GitHub Pages
```

## Comando

```bash
node scripts/export-lot.mjs --input /caminho/snapshot.json --out /caminho/saida
```

Para gerar somente o manifesto de um lote ainda bloqueado:

```bash
node scripts/export-lot.mjs --input /caminho/snapshot.json --out /caminho/saida --allow-blocked
```

O manifesto é criado mesmo quando o lote não está apto. O arquivo `catalog.json` só é escrito quando todas as barreiras são superadas.

## Barreiras obrigatórias

- autorização expressa de Rodrigo;
- lote e registros publicáveis em `Fila de exportação`;
- registros editoriais aprovados;
- IDs permanentes e únicos;
- relações por ID sem referências quebradas;
- questões completas, com gabarito e fonte verificados;
- bloqueio de anuladas, duplicadas e imagens obrigatórias ausentes;
- ausência de dados pessoais, credenciais e segredos;
- catálogo compatível com o contrato público;
- Redação desativada e TAF preservado no MVP.

## Fingerprints

Cada registro recebe um fingerprint SHA-256 calculado sobre:

- ID permanente;
- tipo do registro;
- ID técnico da página do Notion;
- versão;
- data da última alteração;
- estado editorial;
- estado de publicação.

O hash do lote é calculado sobre a lista ordenada dos fingerprints e os bloqueios encontrados. Isso permite detectar alterações no Notion sem colocar o conteúdo privado ou tokens no GitHub.

## Privacidade

O snapshot é temporário e não deve ser commitado. O repositório público não pode receber e-mail, senha, UUID de autenticação, respostas, notas, progresso, resultados de TAF, tokens do Notion ou chaves elevadas do Supabase.
