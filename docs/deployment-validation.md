# Validação pública do GitHub Pages

Depois de cada deploy, o workflow compara o conteúdo público com os arquivos do mesmo commit.

## Arquivos verificados

- `index.html`;
- `assets/app.js`;
- `assets/styles.css`;
- `content/catalog.json`;
- `content/manifest.json`.

O verificador confirma os hashes dos arquivos, a coerência entre catálogo e manifesto e a presença das áreas de aula, questões e registro de tentativas.

## Status do commit

O resultado é publicado no contexto `pages-smoke` do commit:

- `success`: o GitHub Pages serve exatamente os arquivos do commit;
- `failure`: o site está indisponível, desatualizado ou divergente.

O teste faz novas tentativas por até dois minutos para absorver o tempo normal de atualização do CDN do GitHub Pages.

A validação é pública e técnica. Ela não usa e-mail, senha, UUID, respostas ou progresso do estudante e não substitui o teste autenticado de gravação no Supabase.
