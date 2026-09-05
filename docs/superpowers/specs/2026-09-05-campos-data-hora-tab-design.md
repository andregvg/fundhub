# FundHub - Data e hora: o Tab vai para o próximo campo

> Decisões tomadas em 05/09/2026. Bloco D da rodada de melhorias.
> Independente das demais specs da rodada. Vale para os **32 campos de data e
> hora** que hoje existem em 14 telas, e para todos os que vierem depois.

## 1. O problema

Ao terminar de digitar uma data ou uma hora e apertar Tab, o foco não vai para
o próximo campo: ele para no ícone de calendário/relógio dentro do próprio
campo. É preciso um Tab a mais - e quem preenche uma jornada semanal inteira
(cinco dias × dois campos de hora) paga esse Tab extra dez vezes.

### 1.1 A medição

Não é impressão: foi medido no navegador, com teclas reais, em pt-BR.

| Campo | Segmentos | Tabs até sair | Conclusão |
|---|---|---|---|
| `<input type="date">` | dd, mm, aaaa (3) | **4** | há uma parada além dos segmentos |
| `<input type="time">` | hh, mm (2) | **3** | idem |

A parada extra é o `::-webkit-calendar-picker-indicator` - o ícone do seletor
nativo, que o Chromium coloca na ordem de tabulação. Durante a passagem por
ele, `document.activeElement` continua sendo o `<input>`: o ícone vive no
shadow DOM do campo e **não é alcançável por JavaScript**.

## 2. A resposta à pergunta ("é fácil e seguro?")

**É fácil.** Uma regra de CSS elimina a parada extra:

```css
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator { display: none; }
```

Medido de novo depois de aplicar: date passa a sair em 3 Tabs, time em 2 -
exatamente o número de segmentos. Nenhuma parada sobrando.

**É seguro** quanto ao dado: não muda valor, formato, validação nem o
comportamento de digitação. O que se perde é o **ícone** - e com ele o clique
que abre o calendário. Por isso a correção não é só a regra acima; ver D2 e D3.

## 3. Decisões

### D1 - Esconder o indicador nativo, globalmente

A regra vive em `components.css`, ao lado das outras regras de campo de
formulário. Não é opcional por tela: um paradigma que vale "quase sempre" não
é paradigma - e a 33ª data, escrita daqui a três meses, nasceria com o defeito
de volta.

### D2 - O ícone volta, desenhado por nós

Sem ícone, um campo de data fica indistinguível de um campo de texto. Ele volta
como `background-image` do próprio `<input>`, um SVG do mesmo traçado que já
existe em `shared/ui/icones.js` (`calendario` e `horario`), posicionado à
direita (`background-position: right 8px center`).

**`mask-image` foi testado e descartado - ele quebra o campo, não só o ícone.**
`mask-image` (ao contrário de `background-image`) não *soma* uma camada: ele
recorta a visibilidade do elemento inteiro para a área onde a máscara tem
opacidade. Aplicada a um `<input>` com `mask-size: 16px` e posição fixa, o
efeito medido no navegador é o campo inteiro desaparecer - texto, fundo, borda -
sobrando só o ícone de 16px; o valor digitado, o cursor, tudo some fora dessa
janela. Não há como restringir `mask-image` a "só o canto direito" sem que o
resto do elemento vire invisível, e `<input>` não aceita `::before`/`::after`
como camada sobreposta para carregar a máscara à parte (testado: o pseudo-
elemento até existe no `getComputedStyle`, mas o navegador o desenha **abaixo**
do campo, nunca por cima - útil para outra coisa, inútil aqui). `background-
image`, ao contrário, pinta *sobre* o fundo existente sem afetar o resto da
caixa - é a única das duas que serve para um ícone dentro de um campo que
continua editável.

**A cor do ícone não pode vir de `var(--muted)` - é uma limitação da própria
CSS, não uma escolha.** Uma `url(data:image/svg+xml,...)` não enxerga variáveis
CSS do documento que a referencia; o SVG dentro da data URI é um documento à
parte. A saída é **dois SVGs, com a cor do traço escrita à mão dentro da data
URI**, um para cada tema, trocados pelo mesmo `@media (prefers-color-scheme:
dark)` que o resto de `tokens.css` já usa:

```css
input[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23656d76' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
}
@media (prefers-color-scheme: dark) {
  input[type="date"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2393a0bd' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");
  }
}
```

`#656d76` e `#93a0bd` são os valores literais de `--muted` claro e escuro
(`tokens.css`) **copiados à mão**, com um comentário apontando de volta para o
token - se `--muted` mudar, os dois SVGs precisam mudar junto, e é por isso que
o comentário existe. Isto **não** é uma cor de módulo (R9 fala de
`src/modules/**`, e `components.css` é kernel); é uma limitação de plataforma
sem outra saída em CSS puro sem build. O `horario` (relógio) recebe o mesmo
tratamento, com o traçado próprio.

O ícone é **decorativo** (não entra na árvore de acessibilidade por não ser um
elemento - é pintura de fundo) e não é foco de nada. É exatamente o papel que
ele deveria ter desde sempre.

### D3 - O clique no ícone continua abrindo o seletor

`HTMLInputElement.showPicker()` existe nos navegadores em uso (confirmado no
ambiente) e abre o seletor nativo quando chamado a partir de um gesto do
usuário. Um único ouvinte delegado em `document` cobre os 32 campos de hoje e
os futuros, inclusive os que nascem dentro de uma gaveta aberta depois:

```js
// A área do ícone é a faixa à direita do campo. Clicar no texto continua
// posicionando o cursor no segmento, que é o que permite digitar.
document.addEventListener('click', (e) => {
  const campo = e.target.closest('input[type="date"], input[type="time"]');
  if (!campo || campo.disabled || campo.readOnly) return;
  if (e.offsetX < campo.clientWidth - LARGURA_ICONE) return;
  campo.showPicker?.();
});
```

O teste geométrico é deliberado e é o preço de não mexer no markup: o ícone
nativo não pode ser mantido (é ele que causa o problema) e um botão nosso
exigiria envolver **32 campos em 14 arquivos** num wrapper. Trocar um teste de
30px por 14 arquivos alterados é mau negócio.

`showPicker?.()` com encadeamento opcional: onde não existir, o clique
simplesmente não faz nada e a digitação continua sendo o caminho - degradação
silenciosa e sem erro no console.

### D4 - Onde isso mora

`shared/ui/campo-data-hora.js`, com uma função `ligarCamposDataHora()` chamada
uma vez no boot (`main.js`), ao lado das outras montagens da moldura.

É `shared/ui/` por ter **comportamento** (R12: evento, ciclo de vida) e não
`modules/` por não ter dono - é do hub inteiro. Não é um componente que se
instancia por tela: é um comportamento global ligado uma vez, como o `keydown`
de Esc da gaveta. Cerca de 25 linhas, ouvinte único.

### D5 - Alternativas descartadas

**Interceptar o Tab por JavaScript.** Impossível fazer direito: não há API
pública que diga em qual segmento interno o cursor está, e `activeElement`
continua sendo o input durante a parada extra. Só daria para chutar - e chutar
errado tira o foco do campo no meio da digitação, que é um defeito pior que o
atual (e já aconteceu aqui, em 05/09/2026, na jornada semanal).

**Envolver cada campo num wrapper com botão próprio.** Funciona e é acessível,
mas custa 14 arquivos alterados e cria uma forma nova de escrever campo de data
que toda tela futura precisa lembrar. O ganho não paga.

**Não fazer nada e viver com o Tab a mais.** É a opção honesta se algo aqui der
errado - o defeito é incômodo, não impeditivo.

## 4. Onde se aplica

| Módulo | Arquivos |
|---|---|
| Afastamentos, Atas, Calendário, Dashboard (hoje), Horários (jornada), Ocorrências, Projetos, SATE (frota, nova), Servidores (formulário, vínculo), Usuários (auditoria), Viagens, Visitas | 14 arquivos, 32 campos |

Nenhum deles é alterado: a correção é global.

## 5. Arquivos

| Arquivo | Ação |
|---|---|
| `src/styles/components.css` | esconder o indicador; ícone por `background-image` (dois SVGs por campo, claro/escuro); espaço à direita no campo |
| `src/shared/ui/campo-data-hora.js` | criar - ouvinte delegado + `showPicker()` |
| `src/main.js` | chamar `ligarCamposDataHora()` no boot |

Nenhuma migration. Nenhuma view alterada.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| `Alt+↓` deixar de abrir o seletor com o indicador escondido | **verificar na implementação**; se quebrar, o mesmo ouvinte trata a tecla e chama `showPicker()` |
| Ícone desenhado desalinhar em algum campo | o campo já tem altura fixa (`--campo`); posicionar por `background-position: right 8px center` |
| `--muted` mudar em `tokens.css` e os SVGs ficarem desatualizados | comentário em `components.css` aponta de volta para o token; é checagem manual, não mecânica |
| `offsetX` medir errado num campo com transform/zoom | usar `getBoundingClientRect()` se aparecer; o caso não existe hoje |
| Firefox/Safari se comportarem diferente | a regra `-webkit-` é ignorada por Firefox; conferir se lá também há parada extra e tratar só se houver |

## 7. Critérios de aceite

1. Num `<input type="date">` com foco no primeiro segmento, **3 Tabs** levam ao
   próximo campo do formulário.
2. Num `<input type="time">`, **2 Tabs**.
3. O campo continua exibindo ícone de calendário/relógio, nos dois temas.
4. Clicar no ícone abre o seletor nativo; clicar no texto posiciona o cursor
   para digitar.
5. `Alt+↓` abre o seletor (ou, se não abrir nativamente, passa a abrir pelo
   ouvinte).
6. Nenhuma das 14 telas com campo de data/hora precisou ser alterada.
7. Verificado na jornada semanal de Horários, que é o caso com mais campos
   seguidos.
8. `python .claude/scripts/verificar_arquitetura.py` sem violações.
