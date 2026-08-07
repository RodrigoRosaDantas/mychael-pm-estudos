# Mychael PM

Plataforma estática, responsiva e guiada para preparação aos concursos de Soldado da PMDF, PMGO e PMMG.

A integração curricular da PMMG está em preparação editorial. A interface, a navegação e o modelo de cronograma já estão preparados para os três concursos, mas o site não deve tratar conteúdo como aplicável à PMMG sem validação específica da matriz curricular e das fontes correspondentes.

## Arquitetura

`Notion privado → exportação validada → GitHub → GitHub Pages → Supabase`

- O Notion é a fonte editorial privada administrada por Rodrigo.
- O GitHub contém somente código, conteúdo publicável, testes e documentação técnica.
- O GitHub Pages é a interface usada pelo estudante.
- Respostas, tentativas, erros, revisões, desempenho e registros pessoais de treino permanecem no Supabase, com autenticação individual e RLS.
- Redação está modelada, mas desativada no MVP.
- TAF integra o MVP com acompanhamento privado de treinos, sem apresentar índice oficial vigente enquanto não houver exportação editorial validada.
- Nenhum serviço pago faz parte da implementação atual.

## Princípio pedagógico

A plataforma é voltada a um estudante iniciante e continua priorizando orientação em vez de excesso de opções.

O percurso planejado é:

1. construir primeiro a base comum entre os concursos;
2. estudar cada unidade no fluxo `teoria → questões → revisão`;
3. usar erros e revisões para controlar o avanço;
4. depois da consolidação da base, alternar conteúdos específicos em rotação `PMDF → PMGO → PMMG`;
5. retomar o ciclo sempre do ponto em que foi interrompido, sem calendário semanal obrigatório.

O cronograma definitivo só deve receber pesos e distribuição finais depois que a matriz curricular PMDF × PMGO × PMMG estiver completa e houver acervo suficiente para calibrar volume e dificuldade. Não é necessário esperar a última questão do banco para começar a usar a estrutura de ciclos.

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
- data e hora locais no rodapé;
- informação de última sincronização baseada em metadados reais do deploy.

## Estado do catálogo

O catálogo cumulativo publicado chegou à versão 12 com o `LOT-0016`:

- 12 unidades;
- 12 materiais;
- 77 questões;
- 12 conjuntos de questões.

O conteúdo cumulativo preserva os lotes publicados anteriormente. A montagem é idempotente e ocorre antes das validações e do deploy.

## Sincronização pública

Durante o build do GitHub Pages é gerado `content/deployment.json` no artefato público contendo:

- data e hora do build publicado;
- SHA do commit;
- ID da execução;
- versão do conteúdo;
- lote editorial mais recente.

A interface usa esses metadados para informar a última sincronização do site. Se o arquivo ainda não existir, a página apresenta um estado de contingência em vez de inventar uma confirmação de deploy.

## Testes

```bash
npm run check
```

A suíte monta e valida o catálogo cumulativo, confere relações editoriais, estrutura multipágina, segurança do Supabase, experiência progressiva e testes unitários/estáticos.

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
npm run deployment:check -- https://rodrigorosadantas.github.io/mychael-pm-estudos/
npm run supabase:check
```
