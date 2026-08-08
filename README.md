# Mychael PM

Plataforma estática, responsiva e guiada para preparação aos concursos de Soldado da PMDF, PMGO e PMMG.

A integração curricular da PMMG faz parte oficialmente da governança do projeto na Fonte Principal v1.3. A interface, a navegação, a matriz curricular, a aplicabilidade por unidade, o cronograma por ciclos e o monitoramento público estão preparados para os três concursos. Conteúdo só pode ser atribuído à PMMG quando houver validação específica por matéria, assunto ou tópico e rastreabilidade de fonte.

## Arquitetura

`Notion privado → exportação validada → GitHub → GitHub Pages → Supabase`

- O Notion é a fonte editorial privada administrada por Rodrigo.
- O GitHub contém somente código, conteúdo publicável, testes e documentação técnica.
- O GitHub Pages é a interface usada pelo estudante.
- Respostas, tentativas, erros, revisões, desempenho e registros pessoais de treino permanecem no Supabase, com autenticação individual e RLS.
- Redação está modelada, mas desativada no MVP.
- TAF integra o MVP com acompanhamento privado de treinos, sem apresentar índice oficial vigente enquanto não houver exportação editorial validada. O banco editorial de TAF está estruturalmente preparado para PMGO, PMDF e PMMG; nenhum índice ou regra PMMG é criado sem fonte adequada.
- Nenhum serviço pago faz parte da implementação atual.

## Princípio pedagógico

A plataforma é voltada a um estudante iniciante absoluto e prioriza orientação em vez de excesso de escolhas.

O percurso é:

1. construir primeiro o núcleo realmente comum aos três concursos;
2. estudar cada unidade no fluxo `Aprender → Praticar → Corrigir → Revisar → Consolidar`;
3. usar erros e revisões para controlar o avanço;
4. depois do núcleo comum, avançar pelos conteúdos compartilhados por dois concursos;
5. somente com cobertura editorial mínima dos três, alternar conteúdos específicos na rotação `PMDF → PMGO → PMMG`;
6. retomar o ciclo sempre do ponto em que foi interrompido, sem calendário semanal obrigatório;
7. usar simulados quando a base pedagógica permitir.

O cronograma definitivo não recebe pesos finais enquanto o acervo ainda não for representativo para calibrar volume, dificuldade, questões e revisões. A estrutura de ciclos pode ser usada antes disso.

## Matriz multi-concurso

A classificação editorial utiliza quatro estados:

- `Comum aos 3`: sobreposição comprovada para PMDF, PMGO e PMMG;
- `Compartilhado por 2`: aplicável a dois concursos;
- `Específico`: aplicável a uma corporação;
- `Pendente de validação`: existe possível sobreposição, mas falta validação temática suficiente.

Uma matéria comum não torna automaticamente todos os seus assuntos comuns. A classificação deve ocorrer no menor nível necessário. Questões herdam a aplicabilidade da unidade e não são duplicadas por concurso.

A primeira cobertura específica de PMDF, PMGO e PMMG já foi publicada. A rotação específica definitiva permanece desativada até a calibração e decisão previstas no O7.

## Experiência do estudante

A plataforma possui 12 páginas:

- Início;
- Estudo de hoje;
- Matérias;
- Cronograma;
- Questões;
- Revisões;
- Caderno de erros;
- Provas anteriores;
- Simulados;
- TAF;
- Desempenho;
- Configurações.

A camada de experiência inclui:

- navegação lateral agrupada por finalidade;
- barra inferior simplificada no celular;
- busca global de matérias, aulas e questões;
- temas claro, escuro e conforto;
- controles de tamanho de fonte, espaçamento, largura de leitura e modo foco;
- indicador e retomada do progresso de leitura no dispositivo;
- acesso a questões no fim da aula e seleção guiada por matéria;
- cronograma por ciclos, sem associação obrigatória a datas;
- progresso no acervo publicado separado por núcleo comum, PMDF, PMGO e PMMG;
- data e hora locais no rodapé;
- informação de última sincronização baseada em metadados reais do deploy.

## Estado do catálogo

O catálogo cumulativo publicado está na versão 36 com o `LOT-0039`:

- 36 unidades;
- 36 materiais;
- 245 questões;
- 36 conjuntos de questões.

Na camada atual de aplicabilidade:

- PMDF: 34 unidades / 231 questões aplicáveis;
- PMGO: 30 unidades / 203 questões aplicáveis;
- PMMG: 24 unidades / 162 questões aplicáveis;
- núcleo comum aos três: 19 unidades / 127 questões;
- U039 — Noções de Direito PMMG — LINDB é a primeira unidade de cobertura específica PMMG publicada;
- U006 (Semântica) e U013 (remédios constitucionais) permanecem revalidadas para PMMG com evidência temática explícita do programa de referência.

Essas contagens representam o acervo físico publicado e seus vínculos de aplicabilidade. Não significam percentual do edital completo nem quantidade de questões produzidas especificamente para cada corporação.

## Sincronização e monitoramento

Durante o build do GitHub Pages é gerado `content/deployment.json` contendo:

- data e hora do build publicado;
- SHA do commit;
- ID da execução;
- versão do conteúdo;
- lote editorial mais recente;
- cobertura multi-concurso e pendências de classificação.

O CI executa um gate de cobertura: unidade publicada sem regra explícita de aplicabilidade bloqueia a validação. PMMG não pode ser atribuída sem evidência temática verificada. O `pages-smoke` verifica as 12 páginas, catálogo, manifesto, matriz curricular e módulos de aplicabilidade/progresso antes de confirmar o deploy público.

## Testes

```bash
npm run check
```

A suíte monta e valida o catálogo cumulativo, confere relações editoriais, cobertura PMDF/PMGO/PMMG, estrutura multipágina, segurança do Supabase, experiência progressiva e testes unitários/estáticos.

Os testes de navegador usam Chromium real com perfis de computador e celular:

```bash
npm install --ignore-scripts --no-save --no-package-lock @playwright/test@1.61.1
npx playwright install chromium
npm run test:e2e
```

No GitHub Actions, o Chromium e as dependências do sistema são instalados automaticamente antes dos testes autenticados com banco simulado em memória. Nenhuma credencial real é usada nos testes.

## Comandos adicionais

```bash
npm run assemble
npm run manifest
npm run coverage:check
npm run deployment:check -- https://rodrigorosadantas.github.io/mychael-pm-estudos/
npm run supabase:check
```
