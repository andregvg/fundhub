# FundHub - Sistema Visual: ícones, toggles, mensagens e tipografia

> Decisões tomadas em 27/08/2026, a partir de um pedido de padronização visual
> que atravessa todos os módulos. Este documento explica o **porquê**; o plano
> de implementação correspondente detalha o **como**.
>
> Spec irmã: `2026-08-27-horarios-escalas-grade-design.md`. Esta aqui vem
> primeiro - a Spec B consome o conjunto de ícones, o toast e o `.switch`.

## 1. Objetivo

Fixar quatro vocabulários visuais que hoje não existem ou existem pela metade,
de modo que módulo novo nasça consistente sem que ninguém precise lembrar da
regra:

1. **Ícones** - hoje 199 emojis espalhados por 40 arquivos, cada um com métrica
   própria e nenhum alinhamento confiável.
2. **Toggles** - `.switch` existe e é bom, mas convive com `checkbox` e `radio`
   crus fazendo o mesmo papel.
3. **Mensagens de sistema** - não há padrão: sucesso é silêncio, erro às vezes é
   inline, às vezes é toast, às vezes nada.
4. **Pontuação e vazios** - 386 travessões e o `—` usado como "campo vazio", que
   não diz nada a quem lê.

Fora de escopo, explicitamente: identidade de cor por módulo (R14 continua
valendo - só nasce quando o André pedir para um módulo específico).

## 2. Diagnóstico

### 2.1 Ícones

| Fato | Número |
|---|---|
| Emojis no `src/` | 199 ocorrências, 53 glifos distintos |
| Arquivo mais afetado | `modules/docs/docs.content.js` (31) |
| Ícones já em SVG | 1 (`USER_SVG` em `shell/chrome.js`) |

O emoji tem três problemas concretos aqui, e nenhum deles é estético:

- **Não alinha.** Cada glifo tem baseline e altura próprias, definidas pela
  fonte do sistema. `🕒` e `👤` não ficam na mesma linha, e nenhum CSS conserta
  isso de fora.
- **Não herda cor.** Emoji é bitmap colorido. Num botão de perigo, no tema
  escuro, num chip saturado, ele continua com a cor que a Apple ou a Microsoft
  escolheram. Isso é uma violação de fato da R9, ainda que não seja um `#hex`.
- **Muda entre plataformas.** O `🗑` do Windows não é o do Android. Um sistema
  usado por 144 escolas com parque heterogêneo não pode ter ícone que muda de
  desenho conforme o computador.

O `USER_SVG` que já existe prova que o traçado desejado já foi escolhido: Feather
(24×24, `fill:none`, `stroke: currentColor`, `stroke-width: 2`, linecap e
linejoin redondos). Não é estilo novo - é o estilo existente virando sistema.

### 2.2 Toggles

`.switch` está em `styles/components.css:160` e é usado em três lugares
(Escolas ×2, Servidores ×1). É markup sem comportamento, então por R12 é classe
CSS e não componente JS - e está correto assim. Faltam adotá-lo:

- `shared/ui/phones.js` - "principal" é um `radio` cru;
- `modules/usuarios/views/lista.js:141` - "Acesso ativo" é um `checkbox` cru.

### 2.3 Mensagens

`shared/ui/toast.js` existe, mas:

- **O CSS dele mora em `modules/notificacoes/notificacoes.css:72.`** Um módulo de
  fundo é dono do estilo de um componente do kernel. Se o módulo Notificações
  for desativado, o toast perde o visual.
- **O vocabulário de tipos é do domínio de notificações**, não do sistema:
  `'novo' | 'ok' | 'no' | 'upd' | 'del'`. Um formulário que salvou com sucesso
  não tem por que dizer `tipo: 'ok'`.
- **Aparece no rodapé**, longe de onde a ação aconteceu.
- **Quase ninguém usa.** Os formulários fecham a gaveta em silêncio quando dão
  certo; quando dão errado, escrevem em `.auth-msg` inline - inclusive erros de
  rede, que não têm nada a ver com o campo onde a mensagem aparece.

### 2.4 Pontuação e vazios

386 travessões (`—`). O uso como separador de prosa é legítimo em português,
mas está inconsistente com o hífen usado em outros pontos, e o André decidiu
padronizar em hífen. Mais grave é o **travessão como valor**:

```js
.join(' · ') || '—';                       // phones.js:160
${total ? ... : '<span class="hb-vazio">—</span>'}   // por-escola.js
```

`—` não informa. "sem telefone cadastrado" informa, e distingue "ninguém
cadastrou" de "carregou vazio por erro".

## 3. Decisões

### D1 - Conjunto de ícones em `shared/ui/icones.js`

**Decisão:** um módulo do kernel exporta `ico(nome, { tam = 16, classe = '' })`,
que devolve a string SVG inline do ícone pedido. Os traçados ficam num objeto
`TRACOS` no próprio arquivo - só o miolo do SVG, sem o envelope, que é montado
pela função.

```js
export function ico(nome, { tam = 16, classe = '' } = {}) {
  const d = TRACOS[nome];
  if (!d) return '';                       // ícone inexistente não quebra a tela
  return `<svg class="ico ${classe}" width="${tam}" height="${tam}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
```

**Por que assim:**

- **`currentColor` resolve a R9 de graça.** O ícone é da cor do texto onde está.
  Tema escuro, botão de perigo, chip saturado - todos funcionam sem nenhuma
  regra de cor no módulo.
- **`aria-hidden="true"` sempre.** Ícone é decoração; quem carrega o significado
  é o texto ao lado ou o `aria-label` do botão. Isso já é a regra de
  `.claude/rules/ui.md` e o conjunto a cumpre por construção, em vez de depender
  de quem escreve lembrar.
- **Sem arquivo externo, sem sprite.** O projeto não tem build. String inline é
  a única forma que não acrescenta requisição nem dependência.
- **Ícone inexistente devolve string vazia.** Um `nome` errado deixa um buraco,
  não um erro de JS que derruba a tela inteira.

**Alinhamento** - a classe `.ico` em `components.css`:

```css
.ico { display: inline-block; vertical-align: -0.125em; flex: 0 0 auto; }
```

Onde o ícone é sozinho num botão, o container é `inline-flex` centrado. É esse
par - `flex: 0 0 auto` no ícone, centro no container - que faz o alinhamento
vertical e horizontal deixar de ser sorte.

**Nomes** - kebab-case descrevendo a **coisa**, não o desenho: `escola`,
`servidor`, `horario`, `excluir`, `editar`, `buscar`, `atualizar`. Assim trocar o
desenho depois não obriga a renomear as 40 chamadas.

**Manifestos** - `ico: '🏫'` vira `ico: 'escola'`. `registry.js`, `chrome.js` e
os tiles passam a chamar `ico(m.ico, { tam: 18 })`.

**Alcance** - `src/` inteiro, incluindo `docs.content.js`, o `favicon`, o
`brand-mark` e o `☰` do `index.html`. O favicon deixa de ser um `data:` URI com
emoji e passa a ser um `data:` URI com o SVG da marca.

### D2 - Toggles

**Decisão:** nenhum componente JS novo. `.switch` já existe e é a resposta.

**Telefone principal** - o `<input type="radio" name="phone-pri">` **continua
sendo um radio**; só a aparência vira o trilho do `.switch`.

Isto merece justificativa porque parece um detalhe: a exclusividade mútua ("só
um principal") é exatamente o que um grupo de radio faz nativamente. Trocar por
checkbox obrigaria a escrever JS para desmarcar os outros, e esse JS teria de
lidar com linhas adicionadas depois, com a linha do principal sendo removida, e
com navegação por teclado. Mantendo o radio, o navegador faz tudo isso e o
código novo é zero. A classe fica `.switch.radio`, e o CSS do trilho já reage a
`input:checked` sem saber o tipo do input.

Consequência aceita: com radio não é possível "desmarcar todos". Isso é
desejável - uma escola com telefones deve ter um principal. `montarPhonesEditor`
passa a marcar a primeira linha como principal se nenhuma estiver marcada.

**Acesso ativo (Usuários)** - sai do `checkbox` e sobe para a mesma linha do
select de Papel:

```
[ Papel ......................... v ]  [ (o) Acesso ativo ]
```

Grid `1fr auto` com `align-items: end`, que é o que alinha o trilho com a base do
select em vez de com o topo do rótulo. Abaixo de 560px, empilha.

### D3 - Sistema de mensagens

**Decisão:** `shared/ui/toast.js` reescrito com vocabulário semântico, posição no
topo e entrada pela direita. CSS migra para `components.css`.

**Vocabulário:**

| tipo | quando | cor | duração |
|---|---|---|---|
| `sucesso` | a ação concluiu | verde | 5s |
| `atencao` | concluiu, mas há algo a saber | amarelo | 6s |
| `erro` | a ação falhou | vermelho | 8s |
| `info` | contexto, sem ação do usuário | azul | 5s |

Erro dura mais porque erro precisa ser lido, e frequentemente contém um texto do
Postgres que a pessoa vai querer copiar. Todo toast tem botão de fechar, e o
hover pausa o timer - sem isso, um erro longo desaparece no meio da leitura.

Os tipos antigos (`novo`, `ok`, `no`, `upd`, `del`) continuam aceitos, mapeados
para os novos. As Notificações não são reescritas por causa disto.

**Posição:** topo à direita, abaixo da topbar, entrando de `translateX(110%)`
para `0`. No celular ocupa a largura, descontadas as margens. Empilha, com no
máximo 4 visíveis - o quinto remove o mais antigo.

Isto exige um token que **ainda não existe**: hoje a `.topbar` não tem altura
declarada, ela decorre do conteúdo mais `padding: 8px 14px` (`base.css:36`).
Sem número, não há como posicionar o toast logo abaixo dela. Cria-se
`--topbar-h: 52px` em `tokens.css`, aplicado como `min-height` na própria
`.topbar` e usado como origem do container de toasts - uma definição, dois
consumidores, sem valor mágico repetido. O botão Atualizar (D5) usa o mesmo
token para casar altura com o sino e o menu de usuário.

**Acessibilidade:** o container tem `role="status"` e `aria-live="polite"`;
`erro` usa um segundo container com `aria-live="assertive"`. Anúncio de erro que
espera a pessoa parar de digitar não serve.

**A regra de adoção**, que é a parte que importa mais que o componente:

> **Validação de campo fica inline, no formulário, junto do campo.
> Resultado da ação vira toast.**

Concretamente: "Informe o e-mail" é inline (`.auth-msg`), porque a correção é
ali. "Acesso adicionado" é toast, porque a gaveta já fechou. Todo
`fecharDrawer(); carregar();` de sucesso ganha um toast.

**O erro de gravação se divide, e a divisão não é pelo que ele é, mas pelo que a
pessoa pode fazer com ele.** Número de ata repetido chega como erro do banco, mas
a gaveta continua aberta e o campo "Nº" está na tela: é erro de campo, e vai
inline. Falha de rede, chave estrangeira e permissão negada pelo RLS não se
consertam ali: vão de toast. A fronteira é o código do Postgres - `23505`,
`23514` e `23502` são corrigíveis, o resto não - e mora num helper só
(`reportarErro`, em `shared/ui/feedback.js`), porque são 13 formulários e treze
cópias da mesma decisão são treze chances de errar.

**Tokens novos** em `tokens.css`, nas duas variantes. As cores de traço já
existem (`--ok`, `--danger`, `--accent`, `--brand`); falta o fundo suave:

```
--sucesso-bg  --atencao-bg  --erro-bg  --info-bg
```

Derivados por `color-mix` da cor de traço com a superfície, para que claro e
escuro saiam coerentes sem escolher oito valores à mão.

### D4 - Travessão, hífen e vazios semânticos

**Decisão A:** substituir `—` por `-` em todo o repositório - `src/`, `docs/`,
`CHANGELOG.md`, `CLAUDE.md`, `.claude/rules/` e `index.html`. É troca mecânica.

**Decisão B:** o travessão como valor vazio some. Novo helper em `shared/dom.js`:

```js
export const vazio = (msg) => `<span class="vazio">${esc(msg)}</span>`;
```

`.vazio` é itálico em `--muted`. Cada chamada escolhe a mensagem - não há
mensagem genérica, porque o valor do helper está justamente em a mensagem ser
específica.

**Mapa de mensagens** (o plano de implementação carrega a lista completa;
estes fixam o tom):

| Onde | Antes | Depois |
|---|---|---|
| Último acesso, nunca acessou | `—` | `nunca acessou` |
| Telefones vazios | `—` | `sem telefone cadastrado` |
| Jornada do dia vazia | `—` | `sem jornada` |
| Lotação ausente | `—` | `sem lotação` |
| Cargo ausente | `—` | `cargo não informado` |

Tom: minúscula, sem ponto final, descrevendo o **fato** ("nunca acessou") e não
a ausência do dado ("sem informação"). "Nunca acessou" é uma informação;
"sem informação" não é.

**Decisão C:** concatenação usa hífen com espaços: `SME - Sede`.

### D5 - Botão Atualizar

**Decisão:** botão SVG na `.topbar-right`, **antes** do sino, com o carimbo da
última carga à esquerda.

```
[ atualizado às 14:32 ]  [⟳]  [🔔]  [👤]
```

O carimbo usa `fmtDataHora` e some abaixo de 720px, onde não cabe - o botão
fica. Os três botões compartilham a mesma altura e o mesmo `inline-flex`
centrado, que é o que faz o alinhamento vertical do pedido acontecer.

**O que "atualizar" faz:** limpa os caches dos models e re-renderiza a rota
atual. Não recarrega a página - o scroll, a aba e o filtro em que a pessoa
estava sobrevivem.

**Mecanismo:** um `shared/cache.js` de ~20 linhas.

```js
const registrados = new Set();
export function registrarCache(limpar) { registrados.add(limpar); }
export function limparCaches() { registrados.forEach(f => f()); }
```

Cada model que tem `_cache` chama `registrarCache(() => { _cache = null; })` no
carregamento. Hoje são quatro (`escolas`, `locais`, `servidores`,
`sate/atividades`).

**Por que não uma função no kernel que conheça os models:** isso obrigaria
`core/` a importar `modules/`, quebrando a R1. A inversão aqui é a mesma do
`registry.js`: o kernel oferece o ponto de registro, os módulos se registram.
A diferença é que o registry conhece manifestos e este não conhece nada - só
guarda funções anônimas.

**Por que isso não é overengineering (R13):** já são quatro usos concretos, todos
existentes no repositório hoje. A regra de três está cumprida com folga, e a
alternativa (o botão não invalidar cache) faria o botão mentir - ele diria
"atualizado às 14:32" mostrando dados de 14:05.

`core/router.js` ganha `recarregarRota()`, que reexecuta `route()` sem mexer no
hash.

## 4. Arquivos afetados

| Arquivo | Natureza |
|---|---|
| `shared/ui/icones.js` | **novo** - conjunto de ícones |
| `shared/cache.js` | **novo** - registro de caches |
| `shared/ui/toast.js` | reescrito |
| `shared/dom.js` | ganha `vazio()` |
| `shared/ui/phones.js` | radio vira `.switch.radio`; principal automático |
| `shell/chrome.js` | botão Atualizar + carimbo; `USER_SVG` sai para `icones.js` |
| `core/router.js` | ganha `recarregarRota()` |
| `styles/components.css` | `.ico`, `.vazio`, `.switch.radio`, toast (vindo de notificações) |
| `styles/tokens.css` | `--sucesso-bg`, `--atencao-bg`, `--erro-bg`, `--info-bg`; recebe `--topo`, vindo de `base.css` |
| `styles/base.css` | `.topbar` ganha `min-height: var(--topo)`; `--topo` sai daqui para `tokens.css` |
| `modules/notificacoes/notificacoes.css` | perde o bloco de toast |
| `modules/*/module.js` (17) | `ico` passa a ser nome, não emoji |
| `modules/**` | emojis → `ico()`; travessões; vazios; toasts de sucesso |
| `index.html` | favicon, `brand-mark`, `☰` |
| `docs/`, `CHANGELOG.md`, `CLAUDE.md`, `.claude/rules/` | travessões |

## 5. Verificação

- `python .claude/scripts/verificar_arquitetura.py` sem novas violações.
- Nenhum emoji restante em `src/` (varredura por faixa Unicode).
- Nenhum `—` restante no repositório, com **uma exceção**: as ocorrências desta
  spec, onde o caractere é citado como assunto e não usado como pontuação. A
  varredura deve ignorar `docs/superpowers/specs/2026-08-27-sistema-visual-design.md`.
- Teste em tela estreita (375px): topbar com botão sem carimbo, toast ocupando a
  largura, toggle de Usuários empilhado.
- Tema claro e escuro: ícones herdando cor, fundos de toast legíveis nos dois.
- Console limpo.

## 6. Fora de escopo

- Identidade de cor por módulo (R14 - só quando o André pedir para um módulo).
- Substituir os `confirm()`/`alert()` remanescentes (regra existente: quando
  tocar no arquivo, não como refatoração própria).
- Qualquer mudança de layout de página que não decorra das quatro decisões
  acima.

## Adendo (05/09/2026)

A coerência de *uso* dos ícones recorrentes (excluir / fechar / adicionar /
busca) foi tratada em `2026-09-05-icones-e-botoes-design.md`: uma só lixeira
vermelha para excluir, `ico(fechar)` e `ico(adicionar)` no lugar dos glifos de
texto, e a lupa sempre dentro do campo de busca.
