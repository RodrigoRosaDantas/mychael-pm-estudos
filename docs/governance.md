# Governança técnica

Fluxo obrigatório para mudanças relevantes:

1. verificar Fonte Principal e Registro-Mestre no Notion;
2. verificar a situação atual do repositório;
3. criar branch separada;
4. implementar e testar;
5. abrir pull request;
6. validar checks;
7. realizar merge somente após autorização;
8. validar o deploy.

A arquitetura principal é: Notion privado → exportação validada → GitHub → GitHub Pages → Supabase.
