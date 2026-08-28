# UI - tela, estilo e componentes

Regras R9, R12, R14 e R16. Contexto em
`docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

## R12 - Quando é componente JS e quando é classe CSS

Esta é a regra que impede o FundHub de virar um mini-framework caseiro e `shared/` de virar
depósito:

> **Componente JS em `shared/ui/` só quando há comportamento** - estado, eventos, foco ou ciclo
> de vida. **Markup recorrente sem comportamento é classe CSS** em `styles/components.css`.

| Tem comportamento → componente JS | Só markup → classe CSS |
|---|---|
| `drawer.js` (abre/fecha, Esc, foco, fundo) | tabelas, listas, cards |
| `toast.js` (fila, timer, animação) | botões, badges, chips, tags |
| `phones.js` (máscara, add/remover, cursor) | formulários, campos, rodapé de form |
| `filtro-segmento.js` (seleção, memória de sessão) | grades, painéis, estados vazios |
| `feedback.js` (loading/vazio/erro - 3 usos, sem estado, mas contrato único) | toolbars, barras de aba |

Antes de criar um componente novo em `shared/ui/`: ele tem comportamento? Já existe em 3 lugares
(regra de três)? Ele é livre de domínio? Se qualquer resposta for não, é classe CSS ou fica no
módulo.

## Vocabulário existente - reusar antes de criar

Sempre conferir `src/styles/components.css` antes de escrever CSS novo. O que já existe:

- **Página:** `.page-head` · `.toolbar` · `.toolbar-linha` · `.filters` · `.subfiltros` · `.count`
- **Abas:** `.tabbar` + `.tab` (`.on` para a ativa)
- **Listas:** `.solic` (+ `.solic-main`, `.solic-acoes`) · `.dash-item` (+ `.di-top`, `.di-meta`)
- **Cards e grades:** `.card` · `.cards` · `.tile` · `.tiles` · `.panel` · `.dash-grid` · `.md-grid`
- **Stats:** `.stat-row` · `.stat-tile` · `.stat-ico` · `.stat-num` · `.stat-label`
- **Formulário:** `.esc-form` · `.esc-row` · `.form-grid` · `.form-grupo` · `.form-foot` · `.form-hint` · `.field`
- **Botões:** `.btn-primary` · `.btn-secundario` · `.btn-perigo` (ação destrutiva, só em diálogo) · `.mini-btn` (com `.ok` / `.no`)
- **Marcadores:** `.chip` · `.tag` · `.badge` · `.pill`
- **Gaveta:** `.drawer` e família - usar sempre via `shared/ui/drawer.js`, nunca à mão
- **Confirmação:** `.confirmar-back`/`.confirmar-card` - usar sempre via `shared/ui/confirmar.js`, nunca à mão
- **Busca:** `.search`

CSS de módulo (`<modulo>.css`) só **acrescenta** ao vocabulário comum; nunca redefine `.card`,
`.chip` ou `.btn-*`. Se você precisa mudar um componente global, mude em `components.css` - e então
ele muda no hub inteiro, que é o objetivo.

## R9 - Nenhuma cor literal em módulo

Nenhum `#hex`, `rgb()` ou `hsl()` dentro de `src/modules/**`, no CSS ou no JS. Só `var(--token)`.
Os tokens vivem em `src/styles/tokens.css`, com variante clara e escura - é o que faz o tema escuro
sair de graça.

Se falta uma cor, o caminho é **acrescentar um token** em `tokens.css` (nas duas variantes), não
escrever a cor no módulo.

## R14 - Identidade por módulo (sob demanda, não por padrão)

**Decisão do André (25/08/2026): não criar uma cor por módulo especulativamente.** O padrão é UM
sistema de tokens compartilhado (`--brand`, `--brand-2`, `--accent`, `--danger`, `--ok` + o que for
preciso completar de forma harmônica nele) - não 17 paletas. Todo módulo usa esse padrão até o
André pedir destaque próprio para um módulo específico.

Quando ele pedir, o mecanismo (ainda não implementado - só nasce no primeiro pedido, regra de três
não se aplica a uma decisão já tomada pelo dono do produto) é:

1. `tokens.css` ganha `--mod-<nome>`, com valor claro e escuro;
2. o manifesto daquele módulo declara `cor: '<nome>'` (ao lado de `ico`);
3. o roteador aplica `--modulo: var(--mod-<nome>)` no container da página;
4. o CSS daquele módulo usa `var(--modulo)` onde hoje usaria `var(--brand)`.

Módulo sem `cor` cai em `--brand` - o default continua consistente. O que **não** muda por módulo,
nem quando um ganhar destaque: fundo, superfície, borda, texto, sombra, raio, tipografia e
espaçamento. Identidade é o destaque, não um tema próprio.

## R16 - Diálogos

Não usar `confirm()` / `alert()` / `prompt()` nativos: são bloqueantes, não estilizáveis e ficam
fora do design system. Usar `shared/ui/confirmar.js`.

> Estado atual: `confirm()`/`alert()` ainda aparecem em ações destrutivas (afastamentos e outros).
> Substituir quando tocar no arquivo; não vale abrir refatoração só para isso.

## Mobile-first de verdade

Base = celular. `@media (min-width: …)` **acrescenta**, nunca subtrai. Cortes: **560 · 720 · 900 ·
1100px**. A navegação vira menu ☰ abaixo de 1100px.

Alvo de toque mínimo garantido por `@media (pointer: coarse)` (token `--toque: 40px`), sem impor o
tamanho ao desktop (`--controle: 32px`). Botões seguem o padrão discreto do GitHub: compactos,
borda sutil, raio pequeno.

**Testar toda entrega em tela estreita** antes de commitar.

## Acessibilidade - o mínimo que se cumpre hoje

- `aria-label` em botão que só tem ícone (`×`, `✎`, `←`);
- `aria-hidden="true"` em ícone decorativo (emoji, SVG ornamental);
- `role="tablist"` / `role="tab"` + `aria-selected` nas barras de aba;
- `aria-expanded` em toggle de menu ou dropdown;
- gaveta fecha com `Esc` e devolve o foco (já tratado por `drawer.js`).

## CSS novo de módulo

Arquivo `<modulo>.css` na pasta do módulo **e** uma linha de `@import` em `src/styles/main.css` -
sem o import ele simplesmente não carrega. O script verifica.
