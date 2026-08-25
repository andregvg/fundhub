# FundHub

Hub de aplicações gerenciais da Gerência de Ensino Fundamental — SME Ribeirão Preto.
SPA estática **sem build** + Supabase. Repositório **PÚBLICO**. Produção: `andregvg.github.io/fundhub/`

Decisões e o porquê de cada regra: [`docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`](docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md)

## Invioláveis (segurança)

1. **Nenhum dado real, segredo ou PII no repositório** — em código, comentário, doc, exemplo ou
   fixture. Nada de nome de servidor, e-mail, telefone, CPF ou nº de processo. Dados reais só no
   Supabase; seeds em `_private/` (gitignored). `sb_secret_…` / `service_role` **nunca**, em hipótese
   alguma — nem pedir. Conferir `git diff --cached` antes de commitar.
2. **RLS default-deny; nenhuma policy concede acesso a `anon`.** Acesso externo sem login só via
   Edge Function com token.
3. **O front esconde botão por conforto; a barreira é sempre o banco.** Se front e RLS discordarem,
   o banco vence — e é assim que tem que ser.
4. **Todo valor vindo do banco passa por `esc()`** antes de entrar em template literal. Sem exceção.

## Estrutura

```
src/
├── main.js       bootstrap: gate de login → moldura → roteador → serviços
├── core/         KERNEL com estado: config, supabase, auth, perfil, permissoes, segmentos, registry, router
├── shared/       KERNEL sem estado: dom, format, realtime + ui/{drawer,toast,feedback,phones,filtro-segmento}
├── shell/        MOLDURA: chrome.js (topo/menu/usuário) · pendente.js
├── modules/      UMA PASTA POR MÓDULO
└── styles/       main.css (@imports) · tokens.css · base.css · components.css
```

Um módulo tem três formas legítimas: **completo** (dados + tela, com manifesto), **agregador**
(tela sem dados próprios — `dashboard`, `viagens`) e **domínio sem tela** (dados renderizados por
outro módulo, sem manifesto — `telefones`, `locais`).

```
modules/<modulo>/
  module.js              manifesto — id, ico, cor, nome, rota, nav, grupo, perm, load()
  <modulo>.model.js      API PÚBLICA: dados + regras de domínio
  <modulo>.view.js       tela; exporta render(app, ctx)
  <modulo>.css           opcional (+ @import em styles/main.css)
  views/<aba>.js         só quando o módulo se divide
```

## Dependências (a regra que impede o novelo)

1. **O kernel (`core/` + `shared/`) nunca importa `modules/` nem `shell/`.** Única exceção:
   `core/registry.js` importa os `module.js` (manifestos, não implementações).
2. **Só arquivos `*.model.js` atravessam a fronteira de um módulo.** View, `views/`, CSS e helpers
   internos são privados. O model *é* a API pública.
3. **Model nunca toca no DOM. View nunca chama `sb()`.** O model é dono do domínio — regra de
   negócio mora nele, não na view.
4. **Zero ciclos** no grafo de imports.

## Datas

- **Data civil** = `string` `yyyy-mm-dd`. **Timestamp** = ISO do banco. Nunca converter uma na outra.
- Toda formatação de data/hora fica em `shared/format.js`. Módulo não chama `toISOString`,
  `toLocaleDateString` nem `toLocaleString`. Exibição de timestamp sempre por `fmtDataHora`
  (fuso `America/Sao_Paulo`).

## Sem build

Sem npm, sem bundler, sem dependência nova. O que está no repositório é o que roda no navegador —
é restrição arquitetural, não preferência. **Regra de três:** pasta, camada, wrapper ou utilitário
só nascem no terceiro caso concreto.

## Fluxo de trabalho

- Trabalhar sempre na branch **`dev`**; validar na URL de dev; só então merge `dev → main`.
- Ao fechar entrega: subir `CONFIG.versao` em `src/core/config.js` **e** registrar em `CHANGELOG.md`
  (MINOR = módulo novo ou mudança de modelo; PATCH = correção). O changelog é escrito para **quem
  usa** o sistema — sem jargão, sem nome de arquivo.
- Testar em dev-local (inclusive em tela estreita) e conferir o console antes de commitar.
- **Não alterar** os Apps Script (`agendamentos-fil`, `afastamentos-gestores`): seguem em produção
  em paralelo e servem só de inspiração.
- PT-BR em código, comentário, commit e interface.

## Regras detalhadas — consultar sob demanda

| Ao mexer em… | Leia |
|---|---|
| criar, dividir ou mover código | `.claude/rules/arquitetura.md` |
| banco, auth, permissão, dado pessoal | `.claude/rules/seguranca.md` |
| tela, estilo, componente | `.claude/rules/ui.md` |
| data, validação, persistência | `.claude/rules/dados.md` |
| criar um módulo novo | `.claude/rules/modulo-novo.md` |

## Verificação

```bash
python .claude/scripts/verificar_arquitetura.py
```

Dez checagens mecânicas das regras acima. Rodar antes de commitar mudanças estruturais.
Para revisão arquitetural com análise (não só o script): skill `architecture-review`.
