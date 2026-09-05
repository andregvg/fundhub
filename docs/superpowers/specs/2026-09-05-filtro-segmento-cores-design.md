# FundHub - Filtro de segmento: eixos com cor própria

> Decisões tomadas em 05/09/2026. Bloco C da rodada de melhorias.
> Não depende de nenhuma outra spec desta rodada e não é dependência de
> nenhuma - pode ser implementada e entregue sozinha.

## 1. O problema

O filtro de segmento (`shared/ui/filtro-segmento.js`) mostra oito botões numa
fila: três atalhos (Ensino Fundamental, Educação Infantil, Todas), um traço
separador e cinco segmentos-base (EMEF, EJA, CEI, EMEI, Conveniadas). Todos com
o mesmo tratamento visual e cada segmento-base com um ícone à esquerda.

Duas coisas não funcionam:

1. **O ícone não informa.** CEI e EMEI dividem o mesmo traçado de propósito
   (decisão registrada em `core/segmentos.js`), EMEF usa o ícone genérico de
   escola e EJA usa uma lua. Quem lê a fila lê o texto - o ícone é ruído que
   ocupa 14px e alarga a linha, que já quebra em tela estreita.
2. **A fila não mostra a estrutura que existe.** Ensino Fundamental é EMEF +
   EJA; Educação Infantil é CEI + EMEI + Conveniadas. Essa hierarquia é real e
   governa o trabalho da Gerência, mas na tela os oito botões parecem oito
   coisas independentes.

## 2. Decisões

### D1 - "Eixo" é vocabulário de domínio, mora em `core/segmentos.js`

O agrupamento Fundamental × Infantil não é uma escolha de cor: é como a SME
organiza a rede. Ele já existe implicitamente em `ATALHOS`, cujos `id`s são
exatamente `fundamental`, `infantil` e `todas`.

A mudança é tornar explícito o que já está lá:

```js
export const SEGMENTOS = [
  { codigo: 'EMEF',       rotulo: 'EMEF',        eixo: 'fundamental' },
  { codigo: 'EJA',        rotulo: 'EJA',         eixo: 'fundamental' },
  { codigo: 'CEI',        rotulo: 'CEI',         eixo: 'infantil' },
  { codigo: 'EMEI',       rotulo: 'EMEI',        eixo: 'infantil' },
  { codigo: 'CONVENIADA', rotulo: 'Conveniadas', eixo: 'infantil' },
];
```

O campo `ico` **sai** de `SEGMENTOS` (ver D2). O eixo de um atalho é o próprio
`id` - nenhum campo novo em `ATALHOS`.

Não há função nova em `segmentos.js`: quem monta a fila lê `s.eixo` direto,
como já lê `s.rotulo`.

### D2 - Chip de segmento é só texto

Sai o `ico(s.ico, { tam: 14 })` dos cinco chips de segmento e dos três atalhos.
**Fica** o ícone do botão "limpar" - ali ele não é decoração, é o sinal de que
aquele botão faz outra coisa (desfaz) e não é mais um filtro na fila.

O campo `ico` de `SEGMENTOS` fica sem consumidor e é removido. O comentário de
`core/segmentos.js` que justifica CEI e EMEI dividirem o traçado sai junto - a
justificativa deixa de existir quando o ícone deixa de existir.

> **Atenção ao remover:** `usuarios/views/lista.js` também monta chips a partir
> de `SEGMENTOS` e também usa `s.ico`. Ele precisa ser ajustado no mesmo
> commit, ou quebra. Ver D4.

### D3 - Cor por indireção: um token, três valores

O `.chip.on` de `components.css` hoje escreve `var(--brand)` em três lugares
(fundo, texto, borda). Trocar isso por `var(--eixo)` e definir `--eixo` por
eixo resolve o pedido inteiro sem duplicar a regra:

```css
.chip { --eixo: var(--brand); }                    /* default: nada muda */
.fseg .chip[data-eixo="fundamental"] { --eixo: var(--eixo-fundamental); }
.fseg .chip[data-eixo="infantil"]    { --eixo: var(--eixo-infantil); }
.fseg .chip[data-eixo="todas"]       { --eixo: var(--eixo-todas); }

.chip.on {
  background: color-mix(in srgb, var(--eixo) 12%, transparent);
  color: var(--eixo);
  border-color: color-mix(in srgb, var(--eixo) 40%, var(--border));
}
```

O default `--eixo: var(--brand)` é o que garante **zero regressão**: todo chip
fora do filtro de segmento (os tipos de afastamento, as escalas de horário, os
segmentos em Usuários) continua exatamente como está hoje.

**Em repouso** o chip não fica colorido - só a borda ganha uma insinuação do
eixo:

```css
.fseg .chip { border-color: color-mix(in srgb, var(--eixo) 25%, var(--border)); }
```

Assim a fila lê como dois grupos mesmo sem nada selecionado, sem transformar
uma barra de filtros num arco-íris. É o valor a calibrar na implementação: se
25% ficar invisível no tema escuro, sobe; se ficar berrante, desce.

### D4 - Os tokens, e por que o Infantil não é amarelo puro

Três tokens novos em `tokens.css`, nas duas variantes (R9):

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `--eixo-fundamental` | `#1d4ed8` | `#5b8cff` | mesmo azul de `--brand` |
| `--eixo-infantil` | `#b45309` | `#fbbf24` | âmbar |
| `--eixo-todas` | `#57606a` | `#adbac7` | cinza destacado |

O pedido foi "amarelo" para o Infantil. **Amarelo puro (`#f59e0b`, o
`--accent`) como cor de TEXTO sobre fundo claro tem contraste de 2,2:1** -
abaixo do mínimo de 4,5:1 e ilegível para muita gente. A saída é a mesma
família em outro tom: no tema claro o texto é o âmbar escuro (`#b45309`,
~5,0:1) e o fundo do chip é o âmbar diluído a 12%, que é onde o amarelo
aparece de fato. No tema escuro o texto vira o âmbar claro (`#fbbf24`), com
contraste de sobra sobre a superfície escura.

O `--eixo-todas` é o "cinza destacado, iluminado no tema escuro" pedido: no
claro é um cinza mais escuro que `--muted` (para o botão não parecer
desabilitado); no escuro é claro o bastante para se destacar da borda.

Estes tokens **não** são identidade de módulo (R14) - são vocabulário de
domínio compartilhado, como as cores de tipo de afastamento que já vivem em
`tokens.css`.

### D5 - Onde a mudança aparece

O filtro é um componente do kernel, então basta mudá-lo uma vez:

| Módulo | Tela |
|---|---|
| Escolas · Servidores · Horários (por escola) · Afastamentos · Ocorrências · Projetos · SATE (solicitações) · Visitas | filtro na toolbar |

Fora do componente, um lugar monta chips de segmento à mão:
`usuarios/views/lista.js` (escolha dos segmentos de atuação de um usuário).
Ele **também** recebe `data-eixo` e perde o ícone - a cor significa "eixo
Infantil" em qualquer lugar do hub, e ter dois tratamentos para o mesmo
vocabulário seria pior que não ter cor nenhuma.

### D6 - Cor nunca é o único sinal

O estado selecionado continua marcado por **peso** (600 vs 500) e **borda**,
além da cor - quem não distingue azul de âmbar continua enxergando o que está
ligado. Todo chip tem rótulo em texto; nada depende de reconhecer a cor.

## 3. Arquivos

| Arquivo | Ação |
|---|---|
| `src/core/segmentos.js` | `eixo` em cada segmento; remove `ico` e o comentário que o justificava |
| `src/shared/ui/filtro-segmento.js` | remove `ico()` dos chips; emite `data-eixo` nos atalhos e nos segmentos |
| `src/styles/tokens.css` | três tokens novos, claro e escuro |
| `src/styles/components.css` | `--eixo` no `.chip`; `.chip.on` por `var(--eixo)`; borda em repouso no `.fseg` |
| `src/modules/usuarios/views/lista.js` | remove `ico()`, emite `data-eixo` |

Nenhuma migration. Nenhum arquivo novo.

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Remover `SEGMENTOS[].ico` quebrar um consumidor esquecido | são dois e estão listados em D5; `grep -rn "s\.ico"` antes de commitar |
| Âmbar ficar ilegível em algum tema | valores escolhidos por contraste em D4; conferir nos dois temas antes de commitar |
| `.chip.on` mudar sem querer os chips de outros módulos | o default `--eixo: var(--brand)` mantém o valor atual; conferir Afastamentos e Horários na verificação |

## 5. Critérios de aceite

1. Os cinco chips de segmento e os três atalhos aparecem **sem ícone**; o botão
   "limpar" mantém o dele.
2. Ligar "Ensino Fundamental", "EMEF" ou "EJA" pinta em azul; "Educação
   Infantil", "CEI", "EMEI" ou "Conveniadas", em âmbar; "Todas", em cinza.
3. Em repouso, a borda dos chips já agrupa os dois eixos.
4. Nos oito módulos que usam o filtro o comportamento é idêntico - nenhum
   ajuste por módulo.
5. Os chips de segmento em Usuários seguem o mesmo tratamento.
6. Chips de outros domínios (afastamento, escala) continuam visualmente
   inalterados.
7. Legível nos temas claro e escuro, e em 375px.
8. `python .claude/scripts/verificar_arquitetura.py` sem violações.
