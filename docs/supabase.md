# Supabase — progresso do estudante

## Estado desta etapa

A fundação do banco foi modelada em migração versionada, mas **ainda não foi aplicada a um projeto remoto**. Nenhuma chave, usuário ou dado pessoal está no GitHub.

## Perfil permanente

O perfil funcional do estudante será:

```text
STU-MYCHAEL
```

Esse identificador não substitui a conta de autenticação. O registro `STU-MYCHAEL` deverá ser relacionado ao UUID de um usuário criado no Supabase Auth por convite administrativo.

Exemplo para execução posterior, somente no ambiente administrativo do Supabase:

```sql
insert into public.student_profiles (id, user_id)
values ('STU-MYCHAEL', '<UUID_DO_USUARIO_AUTH>');
```

Não preencher o UUID no repositório.

## Dados previstos

A migração cria estruturas privadas para:

- unidades estudadas;
- sessões de estudo;
- respostas e tentativas de questões;
- caderno de erros;
- revisões;
- provas anteriores;
- simulados;
- registros de treino de TAF;
- aparelhos;
- configurações do estudante.

## Segurança obrigatória

- Todas as tabelas de progresso usam Row Level Security.
- O navegador acessa apenas linhas pertencentes ao usuário autenticado relacionado ao perfil.
- O perfil não pode ser criado pelo cliente público; ele será provisionado administrativamente.
- Tentativas de questões e registros de TAF são históricos append-only no cliente.
- Nenhum dado pessoal ou progresso é exportado para `content/`.
- O cliente público usará apenas a **Publishable key** do Supabase.
- Chaves `sb_secret_...`, credenciais administrativas e chaves legadas elevadas nunca podem aparecer no site, no GitHub ou em logs.

## Sequência de ativação remota

1. Criar um projeto gratuito e exclusivo no Supabase.
2. Manter cadastro público desativado; criar o usuário por convite administrativo.
3. Vincular o repositório ao projeto sem registrar token no código.
4. Aplicar a migração versionada.
5. Criar o registro `STU-MYCHAEL` com o UUID real do Auth.
6. Executar testes de isolamento com usuário autenticado e sem autenticação.
7. Configurar no cliente somente URL do projeto e Publishable key.
8. Validar gravação, leitura, sincronização e recuperação entre aparelhos.

## Regra de implantação

Mudanças futuras no banco devem ser feitas por novas migrações. Não alterar o banco remoto diretamente sem registrar a mudança no histórico do repositório.
