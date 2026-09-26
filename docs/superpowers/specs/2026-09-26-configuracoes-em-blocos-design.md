# FundHub - Configurações em blocos

> 26/09/2026. Entrega junto da 0.37.0. Só CSS (e uma classe no markup).
>
> Revisa: `2026-09-05-configuracoes-por-modulo-design.md` (o renderizador
> único `configuracoes/painel.js` continua o mesmo).

## O problema

O painel de configuração de um módulo é uma coluna contínua: os grupos
("Exibição", "Regras e limites"…) se separam só por uma legenda e um traço
fino, e cada item empilha rótulo, dica e controle sem fronteira. Com oito
itens, não se vê onde um termina e o outro começa.

## D1 - Cada grupo é um cartão

`.cfg-form > .form-grupo` ganha a forma de cartão: borda `var(--border)`,
raio `var(--radius)`, fundo `var(--surface)`, sem padding interno no
cartão (os itens cuidam disso). A `<legend>` vira o **cabeçalho** do
cartão: faixa com fundo `var(--surface-2)`, o mesmo tratamento tipográfico
de legenda (`--form-legend`), separada do corpo por uma borda.

Cartões se afastam pelo `gap` do `.esc-form`. O traço entre grupos
(`.form-grupo + .form-grupo { border-top }`) não se aplica dentro de
`.cfg-form`.

## D2 - Cada item é uma linha de ajuste

`.cfg-item` ganha padding (`12px 16px`) e um divisor entre itens
(`.cfg-item + .cfg-item { border-top: 1px solid var(--border) }`).

**A partir de 720px**, o item com controle simples (switch, número, opção)
vira duas colunas: rótulo e dica à esquerda, controle à direita, alinhado
ao centro vertical. É o padrão das telas de ajustes (GitHub, macOS,
Android): lê-se a coluna de rótulos de cima a baixo e o valor está sempre
no mesmo lugar.

- A classe nova `.cfg-item.cfg-simples` marca o item de controle simples
  (gerada por `painel.js`). Item de **painel** (lista editável, ordenação)
  ocupa a largura inteira, sempre empilhado.
- O aviso "Só quem tem permissão…" ocupa a linha inteira embaixo.
- Abaixo de 720px, tudo empilha como hoje.

## D3 - Tela agregadora

Na página Configurações, o cabeçalho de módulo (`.cfg-mod-head`) fica como
está - ícone e nome - e os cartões do módulo vêm abaixo. Entre módulos,
espaço maior (`32px`) e um divisor, para que "Escolas" e "Horários" não se
leiam como grupos do mesmo módulo.

## Onde

Só `modules/configuracoes/configuracoes.css` e a classe `cfg-simples` em
`painel.js`. Nenhum token novo: `--surface`, `--surface-2`, `--border`,
`--radius` já existem, com variantes clara e escura (R9). Vale para todos
os módulos, na engrenagem (modal) e na página, de uma vez - é o renderizador
único.

## Verificação

Dev-local: engrenagem de Horários (painéis), de Escolas (lista editável),
do SATE (números e cor) e a página Configurações, em 360px, 768px e
1280px, tema claro e escuro.
