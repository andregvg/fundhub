# FundHub - Horários: TDC por dia da semana, cobertura por tipo e leitura da grade

> Decisões tomadas em 05/09/2026. Bloco G da rodada de melhorias - o maior e o
> último. **Depende do Bloco A** (três configurações de rede) e continua a spec
> `2026-08-27-horarios-escalas-grade-design.md`, cujo modelo de escalas é
> mantido inteiro.

## 1. Os problemas

Cinco coisas, da mais estrutural à mais cosmética:

1. **O TDC só existe depois que alguém preenche o calendário.** A aba de TDC na
   gaveta de jornada só aparece se alguma data do ano já estiver marcada com
   aquela escala (`horarios.view.js` monta `escalasEmUso` a partir de
   `getEscalasRede`). Em janeiro, antes de o calendário escolar ser lançado, não
   há como registrar o horário de TDC de ninguém. E o TDC tem dia: hoje é
   quarta, e isso pode mudar de um ano para o outro.
2. **O horário de TDC não aparece na grade da escola** junto com a semana. Ele
   está atrás de um chip que troca a grade inteira - dá para ver *ou* a semana
   normal *ou* o dia de TDC, nunca a relação entre os dois.
3. **A janela de cobertura é a mesma para toda a rede** (`07:00`–`18:20`,
   constantes em `horarios.model.js`). Um CEI e uma EMEF com EJA não funcionam
   no mesmo horário, e mudar isso exige deploy.
4. **A configuração da equipe gestora está no lugar errado.** O botão "Equipe
   gestora" fica na barra do módulo, ao lado das duas abas, como se fosse uma
   terceira visão. Ele configura a rede inteira e só faz sentido para a aba
   "Por escola".
5. **Detalhes de leitura da grade e da toolbar:** os campos de busca não ocupam
   a linha; o eixo de horas mostra `07` sem dizer que é hora; os dias aparecem
   como `Seg`, `Ter`.

## 2. Decisões

### D1 - O campo de busca ocupa a linha

Em "Por escola" e em "Por servidor" o seletor fica numa `.toolbar` ao lado do
contador. Hoje ele tem a largura natural do componente.

```css
.toolbar > .busca-selecao { flex: 1 1 auto; min-width: 0; }
.toolbar > .count { flex: 0 0 auto; }
```

`min-width: 0` é obrigatório: sem ele o item flex não encolhe abaixo do
conteúdo e o contador é empurrado para a linha de baixo em tela média.

Vale para os dois seletores - "Buscar escola…" e "Buscar servidor pelo nome…" -
porque a regra é da toolbar, não de cada tela.

### D2 - "Equipe gestora" vira configuração de rede

O botão sai da barra do módulo. A tela que ele abre (`views/cargos.js`) passa a
ser um **painel** de configuração (Bloco A, D6), no grupo "Regras e limites",
escopo `rede`:

```js
{ chave: 'cargos_gestao', escopo: 'rede', grupo: 'regras',
  rotulo: 'Equipe gestora',
  dica: 'Quais cargos entram na grade e na cobertura por padrão.',
  painel: pintarCargosGestao }
```

A tela em si quase não muda - ela deixa de ser aberta por `abrirDrawer` e passa
a receber um elemento onde desenhar. O model continua sendo
`servidores/vinculos.model.js` (dono do domínio "cargo"), e a gravação continua
protegida por RLS.

**Por que isso é reposicionamento e não mudança de escopo:** quais cargos são
equipe gestora não é uma visão do módulo, é um parâmetro dele. Estava numa barra
de abas porque não havia lugar para parâmetro; agora há.

O que **não** se muda de lugar: a ordem dos servidores na grade e o switch de
cobertura de cada um (`horario_exibicao`). Aquilo é **dado por escola**, não
configuração da rede - e o lugar certo de arrastar a legenda é a grade em que
ela aparece.

### D3 - Cobertura por tipo de escola

Uma chave de rede, um objeto:

```json
{
  "EMEF":       { "inicio": "07:00", "fim": "18:20" },
  "EMEF_EJA":   { "inicio": "07:00", "fim": "23:00" },
  "CEI":        { "inicio": "07:00", "fim": "17:00" },
  "EMEI":       { "inicio": "07:00", "fim": "17:00" },
  "CONVENIADA": { "inicio": "07:00", "fim": "17:00" }
}
```

Os valores acima são **exemplo de forma**, não decisão - quem os define é a
Gerência, na tela. O padrão de fábrica é `07:00`–`18:20` para todos os tipos,
que é o que vale hoje.

**O tipo de uma unidade** sai do vocabulário que já existe: `segmento` da
unidade, mais a flag `tem_eja` (`segmentosDaUnidade` em `core/segmentos.js`).
Uma EMEF com EJA cai em `EMEF_EJA`; sem EJA, em `EMEF`. A sede da SME continua
sem cobertura nenhuma - a janela é regra de escola.

**Consequência no código:** `COBERTURA_INICIO`/`COBERTURA_FIM` deixam de ser
constantes de módulo. `grade.model.js` calcula `INI`/`FIM` uma vez, no
carregamento do arquivo, e três funções dependem disso:

| Função | Passa a receber |
|---|---|
| `posicaoNaBarra(bloco)` | `posicaoNaBarra(bloco, janela)` |
| `marcasDaBarra()` | `marcasDaBarra(janela)` |
| `lacunasCobertura(blocos)` | `lacunasCobertura(blocos, janela)` |

`janela` é `{ ini, fim }` em minutos, derivada da unidade pela view. As funções
continuam **puras** - passam a receber o que hoje leem de uma constante, que é
o que as torna testáveis com mais de uma janela.

Os testes atuais (`tests/horarios.test.mjs`, `tests/grade`) não usam nenhuma das
três, então nada quebra; a rodada acrescenta testes com duas janelas diferentes,
que é o comportamento novo.

### D4 - TDC: o dia da semana entra no catálogo de escalas

`escala_tipo` ganha uma coluna:

```sql
alter table escala_tipo add column if not exists dia_semana smallint
  check (dia_semana is null or dia_semana between 1 and 5);
```

Configurável no painel "Dias de escala" (grupo "Calendário e escalas", escopo
`rede`): para cada escala do catálogo, um `<select>` com Segunda a Sexta e a
opção "sem dia fixo".

**Por que na tabela e não em `config_modulo`:** é atributo da escala, e
`escala_tipo` já é o catálogo editável de escalas (migration 025). Guardar
metade do catálogo numa tabela e metade noutra criaria dois lugares para a mesma
pergunta. O painel de configuração escreve nela pelo model que já existe
(`escalas.model.js`, `definirEscalaTipo`).

**O calendário continua mandando.** O dia da semana diz *quando o TDC costuma
cair*; `dia_calendario.escala` continua dizendo, data a data, se aquela quarta
específica é mesmo TDC - e `escala_unidade` continua permitindo que uma escola
remarque ou cancele. O passado continua imutável porque continua sendo dado
gravado, não conta. Esta é a decisão que a spec de 27/08 defendeu e que
permanece intacta.

O que o dia da semana resolve é o **problema 1**: uma escala com `dia_semana`
definido entra na lista de escalas da gaveta de jornada **mesmo que o calendário
do ano ainda esteja vazio**. A lista passa a ser a união de três origens:

```
escalas em uso no calendário do ano
  ∪ escalas já gravadas nos blocos deste servidor
  ∪ escalas com dia_semana definido        ← novo
```

### D5 - A jornada de uma escala com dia fixo mostra só aquele dia

Na gaveta (`views/jornada.js`), a aba de uma escala com `dia_semana = 3` mostra
**um** bloco: Quarta. As escalas sem dia fixo continuam mostrando Segunda a
Sexta, como hoje.

É a tradução literal do pedido ("vincular esses horários a um determinado dia da
semana") e elimina uma pergunta sem resposta: hoje a aba de TDC oferece cinco
dias, e ninguém sabe o que significa preencher a segunda-feira de uma escala que
só acontece às quartas.

A dica da aba muda junto: "Deixe em branco para seguir a jornada Normal desta
quarta-feira."

Blocos já gravados em outros dias numa escala que ganhou dia fixo **não são
apagados** - continuam no banco e a tela avisa que existem, com um botão para
removê-los. Apagar dado do usuário por causa de uma configuração seria a coisa
errada a fazer em silêncio.

### D6 - Na grade, o TDC é uma sub-linha do dia

Na aba "Por escola", o dia que tem escala com dia fixo ganha uma **segunda
faixa**, abaixo da faixa normal, separada por um traço fino e rotulada com o
nome da escala:

```
QUA  ▓▓▓▓▓▓▓ 07:00–13:00   ▓▓▓▓▓ 13:00–18:20
     ┈┈┈┈┈┈┈┈ TDC Presencial ┈┈┈┈┈┈┈┈
     ▓▓▓▓ 07:00–11:00
```

Consequência: **o chip de escala desaparece para as escalas com dia fixo.** Um
chip que troca a grade inteira e uma sub-linha que mostra o mesmo dado ao mesmo
tempo seriam duas respostas para a mesma pergunta. Escala sem dia fixo mantém o
chip - ali ele continua significando "mostre-me a grade como ela fica num dia
desse tipo".

Três regras de correção que a sub-linha precisa respeitar:

1. **Validação por escala, nunca somada.** Os blocos normais e os de TDC de uma
   mesma quarta descrevem dias **alternativos**. Concatená-los para validar
   produziria "blocos sobrepostos" fantasma em quem tem 07:00–13:00 normal e
   07:00–11:00 no TDC. `validarDia` roda uma vez por escala.
2. **A tira de cobertura é do dia regular.** As lacunas continuam calculadas
   sobre os blocos normais; a sub-linha de TDC é informativa. Misturar os dois
   dias num cálculo só responderia a uma pergunta que ninguém faz.
3. **Quem não tem bloco de TDC não aparece na sub-linha.** A regra do modelo já
   diz que, sem bloco na escala, vale o normal (`escolherBlocos`); repetir a
   pessoa na sub-linha com os mesmos horários seria ruído. Um texto abaixo da
   sub-linha diz isso uma vez: "Quem não tem horário próprio de TDC cumpre a
   jornada normal."

### D7 - Leitura do eixo e dos dias

| Hoje | Passa a ser | Onde |
|---|---|---|
| `<em>07</em>` | `<em>07h</em>`, menor e mais fraco | `views/grade.js` (`eixo()`) + `.hg-marca em` |
| `Seg` `Ter` … | `SEG` `TER` … | `.hg-dia { text-transform: uppercase }` |

O `em` do eixo passa de 10px/`--muted` para 9,5px e uma variante mais apagada
(`color-mix` de `--muted` com a superfície) - o eixo é referência, não conteúdo;
ele precisa estar lá e precisa sumir quando não se está olhando para ele.

`DIAS[].curto` **não** muda em `horarios.model.js`: a caixa alta é decisão de
apresentação e mora no CSS. O model continua dizendo "Seg", que é o que outros
consumidores esperam.

## 3. Ordem de implementação sugerida

As cinco decisões são independentes entre si, exceto pela dependência do Bloco
A. Sugestão de fatiamento, do menor risco ao maior:

1. D1 e D7 - CSS e uma linha de HTML; entregáveis isolados.
2. D2 - move a tela de cargos para o painel de configuração.
3. D3 - parametriza a janela de cobertura (mexe em model puro e tem teste).
4. D4 e D5 - migration + gaveta de jornada.
5. D6 - a sub-linha na grade, que é o que depende de tudo acima.

## 4. Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/027_escala_dia_semana.sql` | criar - coluna + check |
| `src/modules/horarios/horarios.config.js` | criar - declaração + três painéis |
| `src/modules/horarios/module.js` | campo `config`, `doc: true` |
| `src/modules/horarios/horarios.model.js` | cobertura deixa de ser constante; helper de janela por tipo |
| `src/modules/horarios/grade.model.js` | `janela` como parâmetro nas três funções |
| `src/modules/horarios/escalas.model.js` | `dia_semana` no catálogo; união das três origens |
| `src/modules/horarios/horarios.view.js` | remove o botão "Equipe gestora" da barra |
| `src/modules/horarios/views/cargos.js` | vira painel (recebe elemento, não abre gaveta) |
| `src/modules/horarios/views/jornada.js` | um dia só para escala com dia fixo; aviso de blocos órfãos |
| `src/modules/horarios/views/por-escola.js` | janela por unidade; sub-linha de TDC; chips só para escalas sem dia fixo |
| `src/modules/horarios/views/grade.js` | sub-linha, validação por escala, eixo com `h` |
| `src/modules/horarios/horarios.css` | `.hg-dia` em caixa alta; `.hg-marca em`; sub-linha |
| `src/styles/components.css` | `.toolbar` com busca elástica (D1) |
| `tests/horarios.test.mjs` · `tests/escalas.test.mjs` | janela parametrizada; escolha de blocos por escala com dia fixo |
| `docs/modulos/horarios.md` | criar - tutorial, no mesmo commit |

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Parametrizar a janela quebrar a grade em silêncio | as três funções são puras e ganham teste com duas janelas |
| Validação somar escalas e acusar sobreposição falsa | D6.1 é critério de aceite explícito |
| Blocos órfãos ao definir dia fixo numa escala já usada | não são apagados; a tela avisa e oferece remover (D5) |
| Sub-linha inchar a grade em tela estreita | a faixa extra só existe no dia que tem escala com dia fixo; medir em 375px |
| Cobertura por tipo divergir do que a escola faz de fato | é configuração da Gerência, auditada; exceção por escola fica para quando houver caso real |
| Migration 027 não rodar | `42703` na leitura de `dia_semana` → catálogo sem dia fixo → comportamento de hoje |

## 6. Critérios de aceite

1. Os dois campos de busca ocupam a linha até o contador, sem empurrá-lo para
   baixo em nenhuma largura.
2. "Equipe gestora" não aparece mais na barra do módulo; a mesma tela está nas
   configurações de Horários e continua gravando.
3. Uma escola CEI com janela configurada mostra a tira de cobertura calculada
   por essa janela; uma EMEF com EJA, pela dela.
4. Com o calendário do ano **vazio**, uma escala com dia fixo já aparece na
   gaveta de jornada.
5. A aba de uma escala com dia fixo mostra só aquele dia da semana.
6. Blocos de TDC aparecem na grade, na linha do dia, separados dos normais e
   rotulados.
7. Um servidor com 07:00–13:00 normal e 07:00–11:00 no TDC da mesma quarta
   **não** recebe aviso de sobreposição.
8. A tira de cobertura não muda por causa dos blocos de TDC.
9. O eixo mostra `07h`, `08h`…, mais discreto; os dias aparecem em caixa alta.
10. `node --test tests/` sem falhas, incluindo os testes novos.
11. Legível em 375px, nos dois temas.
12. `docs/modulos/horarios.md` escrito no mesmo commit.
13. `python .claude/scripts/verificar_arquitetura.py` sem violações.
