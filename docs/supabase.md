# Supabase — progresso do estudante

## Estado validado em 3 de agosto de 2026

O projeto remoto Supabase foi conectado e recebeu as quatro migrações versionadas desta branch.

Validado remotamente:

- 11 tabelas privadas de progresso no schema `public`;
- Row Level Security habilitada em todas as tabelas;
- nenhuma permissão para o papel `anon`;
- permissões mínimas e explícitas para `authenticated`;
- helper de autorização em schema `private`, com `SECURITY INVOKER`;
- tentativas de questões e registros de TAF sem update/delete pelo cliente;
- zero alertas no advisor de segurança;
- foreign key `error_items.attempt_id` coberta por índice;
- zero usuários Auth, perfis ou registros de progresso criados.

Os avisos de índices não utilizados são informativos e esperados enquanto o banco estiver vazio.

## Perfil permanente

O identificador editorial e técnico do estudante será:

```text
STU-MYCHAEL
```

O registro só poderá ser criado após a existência de um usuário autenticado real e será vinculado pelo `user_id`. O cliente público não possui permissão para criar ou alterar `student_profiles`.

## Segurança

- Nunca expor `service_role`, secret key, senha de banco ou credenciais administrativas.
- O navegador usará apenas URL pública do projeto e publishable key.
- Todas as operações do estudante dependem de autenticação e RLS.
- Dados de progresso não são versionados no GitHub.
- O helper central de autorização permanece fora do schema exposto.

## Próximas etapas

1. Criar o usuário Auth de Mychael por processo administrativo seguro.
2. Inserir `STU-MYCHAEL` relacionado ao UUID real do usuário.
3. Testar isolamento RLS com usuário autenticado e acesso anônimo.
4. Integrar o cliente web usando apenas a publishable key.
5. Sincronizar a fila IndexedDB com o Supabase.

Nenhum conteúdo editorial do Notion depende desta etapa e o LOT-0001 permanece bloqueado para publicação.