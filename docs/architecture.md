# Arquitetura técnica inicial

## Fluxo editorial

1. Conteúdo produzido e auditado no Notion privado.
2. Registros autorizados entram em lote de publicação.
3. O exportador gera JSON, hashes e manifesto.
4. Validações bloqueiam relações quebradas, questões incompletas e dados pessoais.
5. Mudanças seguem por branch, testes e pull request.
6. O GitHub Pages publica somente após merge autorizado.

## Aplicação

A primeira versão usa HTML, CSS e JavaScript sem dependências de produção. Isso reduz custo, superfície de falha e complexidade de manutenção.

## Progresso

- Supabase: fonte oficial do progresso.
- IndexedDB: fila local para indisponibilidade temporária.
- Identificador permanente: `STU-MYCHAEL`.
- Nenhum dado pessoal é incluído nos arquivos públicos.

## Módulos previstos

Início, Estudo de hoje, Matérias, Questões, Revisões, Caderno de erros, Provas anteriores, Simulados, TAF, Desempenho e Configurações.

Redação permanece desativada até decisão formal.
