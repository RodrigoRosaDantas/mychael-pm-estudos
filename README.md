# Mychael PM

Plataforma estática, responsiva e guiada para preparação aos concursos de Soldado da PMGO e da PMDF.

## Arquitetura

`Notion privado → exportação validada → GitHub → GitHub Pages → Supabase`

- O Notion é a fonte editorial privada administrada por Rodrigo.
- O GitHub contém somente código, conteúdo publicável, testes e documentação técnica.
- O GitHub Pages é a interface usada pelo estudante.
- Respostas, tentativas, erros, revisões, desempenho e registros pessoais de treino permanecem no Supabase, com autenticação individual e RLS.
- Redação está modelada, mas desativada no MVP.
- TAF integra o MVP com acompanhamento privado de treinos, sem apresentar índice oficial vigente enquanto não houver exportação editorial validada.
- Nenhum serviço pago faz parte da implementação atual.

## Estado do catálogo

A plataforma possui 11 páginas:

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

O catálogo cumulativo v2 reúne:

- `U001`, `M001`, `Q000001` a `Q000005` e `QS001` — informações explícitas e implícitas;
- `U002`, `M002`, `Q000006` a `Q000011` e `QS002` — inferência, pressupostos e subentendidos.

No total, são duas unidades, dois materiais, onze questões e dois conjuntos de fixação. O fluxo de questões salva tentativas no Supabase, encaminha erros para revisão e oferece refação individual ou conjunta. A refação limpa não mostra alternativa anterior, comentário ou gabarito antes da nova resposta.

O módulo TAF permite registrar sessões físicas, consultar o histórico privado e informar avaliação médica ou supervisão profissional. Os registros usam `taf_attempts`, permanecem vinculados ao perfil `STU-MYCHAEL` e não entram no GitHub ou no Notion editorial. O módulo não apresenta índice numérico oficial vigente; índices históricos e futuros índices vigentes dependem de exportação editorial própria e fonte oficial validada.

Provas Anteriores e Simulados ainda dependem de conteúdo editorial autorizado para se tornarem atividades completas. O IndexedDB previsto para contingência offline ainda não foi implementado.

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
