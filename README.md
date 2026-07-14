# FundHub

Hub de aplicações gerenciais da **Gerência de Ensino Fundamental** — SME Ribeirão Preto.
SPA estática (sem build) + Supabase. Produção: <https://andregvg.github.io/fundhub/>

## Arquitetura

Fatias verticais: **uma pasta por módulo**, sobre um kernel compartilhado. Sem npm, sem bundler —
o que está no repositório é o que roda no navegador.

```
src/
├── main.js       bootstrap (gate de login → moldura → roteador → serviços)
├── core/         kernel: config, supabase, auth, perfil, registry, router
├── shell/        moldura: topo/navegação (chrome.js) e home (home.js)
├── shared/       reusáveis sem domínio: dom, format, ui/{drawer,toast,feedback}
├── modules/      UMA PASTA POR FERRAMENTA
│   └── <modulo>/ module.js (manifesto) · <modulo>.model.js · <modulo>.view.js · <modulo>.css
└── styles/       tokens · base · components (mobile-first)
```

**MVC adaptado:** `*.model.js` = Model (dados + regras de negócio, nunca toca no DOM) ·
`*.view.js` = View (renderiza, nunca fala com o Supabase) · `core/router.js` = Controller.
`module.js` é o manifesto — registrá-lo em `core/registry.js` faz o tile, a rota e o item de
navegação aparecerem sozinhos.

**Regra de import:** um módulo pode importar o *model* de outro módulo (é a sua API pública),
**nunca a view**.

## Documentação

A documentação completa — arquitetura, segurança/RLS, banco, deploy e o passo a passo para criar
um módulo — está **dentro do próprio app**, em `#/docs` (visível apenas para admins).
Fonte: [`src/modules/docs/docs.content.js`](src/modules/docs/docs.content.js).

Para quem desenvolve: [`docs/HANDOFF.md`](docs/HANDOFF.md) · [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) · [`docs/SUPABASE.md`](docs/SUPABASE.md)

## Segurança

Repositório **público**: nenhum dado real, seed ou seed-file versionado — nunca.
A chave do Supabase no código é a *publishable*, pública por design; quem protege os dados é o
**RLS** (default-deny + allowlist na tabela `perfil`). A chave secreta nunca entra aqui.
