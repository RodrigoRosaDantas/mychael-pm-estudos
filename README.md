# Mychael PM

Plataforma estática, responsiva e guiada para preparação aos concursos de Soldado da PMGO e da PMDF.

## Arquitetura

`Notion privado → exportação validada → GitHub → GitHub Pages → Supabase`

- O Notion é a fonte editorial privada administrada por Rodrigo.
- O GitHub contém somente código, conteúdo publicável, testes e documentação técnica.
- O GitHub Pages é a interface usada pelo estudante.
- Respostas, tentativas, erros, revisões e desempenho permanecem no Supabase, com autenticação individual e RLS.
- Redação está modelada, mas desativada no MVP.
- TAF integra a arquitetura inicial, porém ainda não possui treino publicado.
- Nenhum serviço pago faz parte da implementação atual.

## Estado atual

A `main` publica uma plataforma com 11 páginas:

- Início;
- Estudo de hoje;
- Matérias;
- Questões;
- Revisões;
- Caderno de erros;
- Provas anteriores;
- Simulados;
- TAF;
- Desempenho;
- Configurações.

O primeiro lote contém a U001, o material M001, cinco questões e o conjunto QS001. O fluxo de questões salva tentativas no Supabase, encaminha erros para revisão e oferece refação individual ou conjunta. A refação limpa não mostra alternativa anterior, comentário ou gabarito antes da nova resposta.

Provas Anteriores, Simulados e TAF possuem áreas próprias, mas ainda dependem de conteúdo editorial autorizado para se tornarem atividades completas. O IndexedDB previsto para contingência offline ainda não foi implementado.

## Testes

```bash
npm run check
```

A suíte acima valida catálogo, estrutura multipágina, segurança do Supabase e testes unitários/estáticos.

Os testes de navegador usam Chromium real com perfis de computador e celular:

```bash
npm install --ignore-scripts --no-save --no-package-lock @playwright/test@1.61.1
npx playwright install chromium
npm run test:e2e
```

No GitHub Actions, o Chromium e as dependências do sistema são instalados automaticamente antes dos testes autenticados com banco simulado em memória. Nenhuma credencial real é usada nos testes.

## Comandos adicionais

```bash
npm run manifest
npm run deployment:check -- https://rodrigorosadantas.github.io/mychael-pm-estudos/
npm run supabase:check
```
