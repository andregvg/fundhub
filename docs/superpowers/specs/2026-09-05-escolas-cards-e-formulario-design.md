# FundHub - Escolas: card configurável e formulário mais legível

> Decisões tomadas em 05/09/2026. Bloco F da rodada de melhorias.
> **Depende do Bloco A** para as três configurações de exibição.
> O que vale para Escolas vale igual para Servidores (§ D4).

## 1. O problema

Quatro incômodos distintos na mesma tela:

1. **O card mostra o que a Gerência decidiu em 2026, para sempre.** Quem
   telefona para escolas o dia inteiro quer o telefone no card; quem monta
   equipes quer saber quantos servidores estão vinculados. Nenhum dos dois tem
   como pedir.
2. **A grade de cards ignora o monitor.** `repeat(auto-fill, minmax(280px,1fr))`
   dá quatro colunas apertadas num monitor largo e ninguém pode preferir três.
3. **O formulário de escola tem uma linha desequilibrada:** "Nome" e "Apelido"
   dividem a linha, e o nome - que é o campo mais longo do cadastro - fica com
   metade do espaço.
4. **As dicas competem com os campos.** Abaixo de Nome, Apelido e Nome oficial
   há um `<small class="form-hint">`, e ele sai **em negrito e caixa alta**.

### 1.1 A causa da dica berrante

Não é o `.form-hint`, que só declara cor e tamanho:

```css
.form-hint { color: var(--muted); font-size: 13px; }
```

É **herança**. O `<small>` está dentro de um `<label>`, e o rótulo de campo do
hub declara `font-weight: 700`, `text-transform: uppercase` e
`letter-spacing: .04em` (`components.css`, tratamento único de rótulo). Como
`.form-hint` não redefine nenhuma das três, a dica herda as três e sai
**MAIÚSCULA E EM NEGRITO**, competindo com o rótulo que deveria estar abaixo.

## 2. Decisões

### D1 - Três configurações de exibição, escopo `usuario`

Declaradas em `escolas.config.js` (Bloco A, D5):

| Chave | Tipo | Padrão | Efeito |
|---|---|---|---|
| `telefones_no_card` | switch | desligado | telefone principal no card |
| `servidores_no_card` | switch | desligado | "N servidores" no card |
| `cards_por_linha` | número (1–6) | **3** | colunas da grade acima de 900px |

Padrão **desligado** para as duas primeiras: o card de hoje é o que a rede já
conhece, e uma preferência que muda a tela de todo mundo por omissão não é
preferência, é redesenho. Quem quiser liga.

`cards_por_linha` nasce em 3 porque foi o número pedido; abaixo de 900px a
grade continua em coluna única e o valor é ignorado - largura de celular não
comporta escolha.

### D2 - A contagem de servidores é carregada só quando ligada

`escolas.view.js` não conhece servidores hoje, e não deve passar a carregar a
lista inteira para todo mundo por causa de um número que a maioria não pediu.

Quando `servidores_no_card` está ligado, a view faz `import()` **dinâmico** de
`servidores/servidores.model.js` e conta os vínculos abertos por unidade. O
model tem cache próprio, então quem navega para Servidores em seguida não paga
duas vezes.

É import model→model entre módulos (R2, permitido) e não fecha ciclo:
`servidores.model.js` importa `telefones.model.js` e nada de Escolas.

O número conta **vínculos abertos** (sem data de fim), que é a definição de
"está lotado aqui" que o hub usa em todo lugar - inclusive na grade de
Horários.

### D3 - Cards por linha: uma variável, duas regras

```css
.cards { --por-linha: 3; }                         /* fallback do CSS */
@media (min-width: 900px) {
  .cards { grid-template-columns: repeat(var(--por-linha), minmax(0, 1fr)); }
}
```

A view escreve `style="--por-linha: N"` no container a partir da preferência. O
`minmax(0, 1fr)` (e não `1fr`) é o que impede um nome de escola comprido de
esticar a coluna e estourar a grade.

Abaixo de 900px nada muda: coluna única, como hoje.

### D4 - Servidores recebe as mesmas duas

`servidores.config.js` declara `telefones_no_card` e `cards_por_linha`, com os
mesmos padrões. **Duas declarações, uma em cada módulo** - não uma abstração
compartilhada. São dois módulos que por ora coincidem; se um terceiro pedir o
mesmo par, aí existe o terceiro caso concreto que a R13 exige para generalizar.

Servidores **não** ganha `servidores_no_card` (não faria sentido) nem contagem
de escolas - ninguém pediu.

### D5 - Formulário: nome em linha inteira

`<label class="col-full">` no campo Nome. `.campos.auto` já trata `col-full`
como `grid-column: 1 / -1` - é o mecanismo que "Nome oficial / SAE" já usa na
mesma tela. Apelido fica sozinho na linha seguinte, e a leitura do bloco
Identificação passa a ser: nome inteiro, apelido, nome oficial inteiro.

### D6 - Transporte e EJA viram switch

Os dois `<label class="inline"><input type="checkbox">` viram `.switch`, o
padrão do hub para ligar/desligar - o mesmo controle que os filtros da lista já
usam para "Transporte" e "EJA" logo acima. Hoje a mesma pergunta tem duas
aparências na mesma tela: caixa no formulário, switch no filtro.

Markup sem comportamento novo: `.switch` é classe CSS e o estado continua sendo
o do `<input type="checkbox">` - teclado, rótulo e leitor de tela de graça
(R12).

### D7 - A dica volta ao seu lugar

```css
.form-hint {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;        /* não herda o 700 do rótulo */
  text-transform: none;    /* não herda a caixa alta */
  letter-spacing: 0;
  line-height: 1.4;
}
```

Correção **global**, não em Escolas: a herança atinge toda dica dentro de um
`<label>`, e hoje isso acontece em Escolas, Servidores, SATE e Projetos. Os
usos de `.form-hint` fora de rótulo (gaveta de jornada, aviso de escala) não
mudam - eles já renderizavam normal, e as declarações novas são exatamente o
que eles já herdavam do corpo.

Se 13px ainda competir com o campo de 16px depois do reset, cair para 12,5px é
ajuste de calibração, não decisão de arquitetura.

## 3. Arquivos

| Arquivo | Ação |
|---|---|
| `src/modules/escolas/escolas.config.js` | criar - três chaves + acessos |
| `src/modules/escolas/module.js` | campo `config` |
| `src/modules/escolas/escolas.view.js` | telefone e contagem no card; `--por-linha` no container |
| `src/modules/escolas/views/formulario.js` | `col-full` no Nome; dois `.switch` |
| `src/modules/servidores/servidores.config.js` | criar - duas chaves + acessos |
| `src/modules/servidores/module.js` | campo `config` |
| `src/modules/servidores/servidores.view.js` | telefone no card; `--por-linha` |
| `src/styles/components.css` | `.form-hint` (D7); `.cards` com `--por-linha` (D3) |
| `docs/modulos/escolas.md` | criar - tutorial, no mesmo commit (regra do Bloco B) |

Nenhuma migration própria.

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Contagem de servidores pesar na lista de 144 escolas | carga só quando ligada, com cache do model (D2) |
| `--por-linha` alto deixar o card ilegível | limite de 6 na declaração; `minmax(0,1fr)` evita estouro |
| Reset do `.form-hint` mudar telas que dependiam do negrito | nenhuma depende: o negrito era herança acidental; conferir Escolas, Servidores, SATE e Projetos |
| Switch mudar o payload do formulário | `.switch` é só CSS sobre o mesmo `<input type="checkbox">`; `f.tem_eja.checked` continua igual |

## 5. Critérios de aceite

1. Ligar "Exibir telefones" faz o telefone principal aparecer no card; desligar
   o remove.
2. Ligar "Exibir quantidade de servidores" mostra a contagem de vínculos
   abertos; com a opção desligada, a lista de servidores **não** é carregada.
3. Mudar "cards por linha" para 2 e para 5 muda a grade acima de 900px; abaixo
   disso continua em coluna única.
4. No formulário, Nome ocupa a linha inteira.
5. Transporte e EJA são switches, e salvar continua gravando os dois valores
   corretamente.
6. As dicas dos campos aparecem em caixa normal, peso normal, discretas.
7. As mesmas duas configurações funcionam em Servidores.
8. Legível em 375px, nos dois temas.
9. `docs/modulos/escolas.md` escrito no mesmo commit e listado em `#/ajuda`.
10. `python .claude/scripts/verificar_arquitetura.py` sem violações.
