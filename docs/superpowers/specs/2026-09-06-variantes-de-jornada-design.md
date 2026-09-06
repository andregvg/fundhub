# FundHub - Variantes de jornada (o revezamento do TDC)

> Decisões tomadas em 06/09/2026. Entrega prevista como **MINOR** - muda o
> modelo de `horario_bloco`.
>
> **Substitui a decisão D6.2** de `2026-09-05-horarios-tdc-e-cobertura-design.md`
> ("a tira de cobertura é do dia regular"). O resto daquela spec continua
> valendo, inclusive D6.1 (validação por escala, nunca somada) e D6.3.

## 1. O problema

Em dia de TDC a escola não tem **um** horário: tem dois papéis. Quem conduz o
encontro cumpre uma jornada deslocada para a tarde e a noite; quem não conduz
cumpre outra, cobrindo a escola no restante. Os ofícios de horário que as
unidades enviam à Gerência dizem isso literalmente - "o(a) gestor(a) responsável
pelo TDC seguirá o seguinte horário X, enquanto o(a) outro(a) gestor(a) fará Y".

**E o revezamento é o ponto: nunca se sabe, de antemão, qual gestor conduz em
qual data.** A escola combina isso internamente e a Gerência não recebe essa
informação data a data.

Hoje o FundHub só sabe registrar jornada com dono: `horario_bloco` amarra um
horário a um servidor. Para representar o dia de TDC restam duas saídas, e as
duas são ruins:

1. **Gravar uma atribuição arbitrária** - "Gestor 1 faz X, Gestor 2 faz Y". O
   banco passa a afirmar como certo algo que é verdade em metade das ocorrências
   e falso na outra metade.
2. **Gravar as duas jornadas para os dois gestores.** A grade desenha quatro
   barras onde existem dois horários reais, a validação de 8h/dia acusa carga
   dobrada em quem não a tem, e a cobertura fica ilegível.

Há ainda um terceiro caso, que a mesma limitação impede: **a quarta-feira sem
TDC também pode ter revezamento.** Uma unidade em que os dois gestores alternam
manhã e tarde a cada semana tem duas configurações do mesmo dia da semana, e
nenhuma delas é "o TDC".

**As duas configurações não são intercambiáveis.** Poder-se-ia supor que a
cobertura é a mesma de qualquer jeito - se um faz X e o outro faz Y, a união é
sempre `X ∪ Y`. Não é: quando o Gestor 1 conduz, o Gestor 2 pode cobri-lo de um
jeito; quando o Gestor 2 conduz, o Gestor 1 pode cobrir de **outro**. Aí as duas
configurações têm coberturas diferentes, e somá-las esconderia exatamente a
lacuna que a Gerência precisa enxergar.

## 2. Escopo

Um segundo eixo no modelo de jornada - a **variante** -, para que a escola possa
registrar **cada configuração completa** de um dia e a Gerência possa validar a
cobertura **de cada uma, separadamente**.

Entra também nesta rodada, porque encosta no mesmo desenho:

- a **régua da grade para de recortar** blocos que passam da janela de cobertura;
- **Supervisor(a) sai** da equipe gestora.

**Fora do escopo:** registrar qual variante valeu numa data concreta (a Gerência
não tem essa informação e não vai passar a ter); designar nominalmente quem
conduz o TDC em cada data; qualquer inferência automática de rodízio a partir do
calendário.

## 3. Decisões

### D1 - A variante é o segundo eixo do dia

Hoje a jornada de um dia é identificada por `(unidade, dia da semana, escala)`.
Passa a ser `(unidade, dia da semana, escala, **variante**)`.

**Uma variante é uma configuração completa e autossuficiente daquele dia**: os
horários de todo mundo, juntos, formando uma cobertura própria. Duas variantes
da mesma escala descrevem dias **alternativos** - exatamente como `escala` já
faz em relação a `normal` -, e por isso nunca se somam, nem para desenhar, nem
para validar, nem para calcular cobertura.

Numa escola de exemplo com dois gestores, a quarta de TDC presencial fica:

| | Variante 1 | Variante 2 |
|---|---|---|
| Gestor(a) 1 | 11:10–13:10 · 14:10–20:10 | 06:45–11:45 · 12:45–15:45 |
| Gestor(a) 2 | 06:45–11:45 · 12:45–15:45 | 11:10–13:10 · 14:10–20:10 |
| Cobertura | 06:45–20:10 | 06:45–20:10 |

Nesse exemplo as duas coincidem, e a tabela mostra isso de relance. Onde não
coincidirem, as duas tiras de cobertura serão diferentes - e é aí que a tela
ganha utilidade.

**Os blocos continuam com dono.** Um bloco é sempre de um servidor; a variante
diz em qual configuração do dia ele vale. Isso preserva a aba "Por servidor",
mantém `servidor_id NOT NULL` e não mexe em RLS nenhuma.

### D2 - Uma coluna `variante`, não uma tabela nem um papel anônimo

`horario_bloco` ganha **uma** coluna:

```sql
alter table horario_bloco add column if not exists variante smallint not null default 1;
alter table horario_bloco add constraint horario_variante_positiva check (variante >= 1);
```

Toda jornada já gravada vira variante 1 sem migração de dado. A RLS não muda: as
policies da 021 são por `unidade_id`, que a linha continua tendo.

**Descartado: uma tabela `horario_variante`.** Ela guardaria pouco mais que um
número e um rótulo, e cobraria policies, `grant`, trigger de auditoria e uma
junção em toda leitura da grade. Separação que não separa nada.

**Descartado: blocos sem dono, pertencentes a um "papel" da unidade** (`servidor_id`
nulo + `papel text`, no padrão de dono exclusivo que `telefone` usa). Modelaria
bem o caso em que as duas configurações são simétricas, mas apaga justamente a
informação que o problema exige: *quem* cobre *como*, em cada configuração. Só
funcionaria se a união bastasse - e § 1 mostra que não basta.

**Sem catálogo de variantes.** Quantas existem se descobre lendo os blocos
daquela `(unidade, escala, dia)`. Uma escola com três gestores em rodízio grava
três; nada no modelo precisa mudar.

### D3 - Cobertura por variante (substitui D6.2)

`lacunasCobertura` passa a receber os blocos de **uma** variante, e cada
variante desenha a própria tira.

A regra do domínio fica mais forte e mais correta:

> A unidade precisa estar coberta na janela do seu tipo **em todas as
> variantes** - porque qualquer uma delas pode ser a de amanhã.

Uma variante com lacuna é um aviso sobre **aquela configuração**, não sobre a
escola. A escola corrige aquela, não a outra.

A decisão anterior (D6.2 de 05/09/2026: "as lacunas continuam calculadas sobre
os blocos normais; a sub-linha de TDC é informativa") nasceu quando o TDC era
uma jornada alternativa única. Com duas configurações concorrentes, uma
sub-linha sem tira de cobertura seria o único lugar da tela que não responde à
pergunta que a tela existe para responder.

### D4 - O fallback tem três degraus, e é por pessoa

Para um servidor, numa escala e numa variante, valem:

1. os blocos daquela **escala e variante**; se não houver,
2. os blocos daquela **escala, variante 1**; se não houver,
3. os blocos da escala **`normal`, variante 1**.

O degrau 2 é o que evita digitação boba: quem tem horário próprio de TDC que
**não** muda entre as variantes - uma coordenadora, por exemplo - escreve uma
vez, na variante 1, e vale nas duas. Quem reveza escreve as duas.

O degrau 3 é o fallback que já existe hoje (`escolherBlocos`), preservado: quem
não tem jornada alternativa nenhuma não precisa de registro nenhum.

`normal`/variante 1 nunca cai em outra coisa - seria circular.

### D5 - Quem conduz é declarado por quem conduz

`horario_bloco` ganha a segunda e última coluna:

```sql
alter table horario_bloco add column if not exists conduz boolean not null default false;
```

Marcada nas linhas do servidor que conduz o TDC naquela variante. A tela lê o
nome dali e rotula a sub-linha "TDC Presencial · quando <Nome> conduz".

**Ninguém marcado é um estado válido e previsto:** na quarta-feira sem TDC que
tem revezamento, não há responsável nenhum. Aí o rótulo cai em "Variante 2" e o
mesmo mecanismo continua servindo, sem coluna extra e sem caso especial no
código.

**Por que na linha do bloco e não num ponteiro por variante:** a gaveta de
jornada edita **um servidor por vez**. Um ponteiro "a variante 2 é conduzida
pelo Gestor 2" obrigaria a gaveta do Gestor 1 a escrever sobre dado do Gestor 2,
o que quebra o escopo do arquivo e a leitura de quem mantém. Com a coluna no
bloco, cada um declara de si: "conduzo o TDC nesta variante".

A consistência (dois marcados na mesma variante) não é garantida por constraint
- seria um índice parcial sobre um agregado. É garantida pela tela, e o custo de
errar é um rótulo estranho, não um dado corrompido. Se houver mais de um
marcado, o rótulo usa o **primeiro na ordem da grade** (`ordenarParaGrade`) -
determinístico, para a tela não trocar de rótulo entre dois repintes.

### D6 - Na grade, uma sub-linha por configuração alternativa do dia

A sub-linha criada em D6 de 05/09/2026 servia a uma pergunta: "como este dia
fica na outra escala?". Ela passa a servir à pergunta mais geral de que aquela
era um caso - **"quais são as outras configurações deste dia?"** -, e cada uma
ganha a própria tira de cobertura.

Uma configuração é um par `(escala, variante)`. A primeira ocupa a linha do dia;
as demais entram como sub-linhas, rotuladas. Isso vale tanto para uma escala
diferente (o TDC, como já era) quanto para uma variante da **mesma** escala -
que é o que faz o caso da quarta-feira sem TDC com revezamento funcionar sem
mecanismo próprio: são duas variantes da escala `normal`, desenhadas em duas
faixas, cada uma com sua cobertura.

```
QUA  ▓▓▓▓▓▓▓ Gestor 1        ▓▓▓▓▓▓▓▓ Gestor 2           ← jornada normal
     ┈┈ TDC Presencial · quando Gestor 1 conduz ┈┈
     ▓▓▓▓ Gestor 2   ▓▓▓▓▓▓▓▓▓ Gestor 1          ▁▁▁▁    ← cobertura desta variante
     ┈┈ TDC Presencial · quando Gestor 2 conduz ┈┈
     ▓▓▓▓ Gestor 1   ▓▓▓▓▓▓▓▓▓ Gestor 2          ▁▁▁▁    ← cobertura desta variante
```

`subLinhas` passa de `{ dia, escala, rotulo }` a `{ dia, escala, variante, rotulo }`,
e `blocosDeEscala(servidorId, dia, escala)` ganha o quarto argumento. As três
regras de D6 da spec anterior continuam valendo, com D6.2 relida por D3 acima.

### D7 - Na gaveta, uma segunda linha de abas

`estado.porEscala[escala][dia]` passa a `estado.porEscala[escala][variante][dia]`.

Abaixo da barra de abas de escala aparece uma segunda `.tabbar`, **só quando a
escala ativa tem mais de uma variante**, com as variantes e um "+ nova variante".
Mesmo componente, mesmo comportamento de troca de aba, mesma regra de não
descartar o que foi digitado nas outras.

Uma caixa por variante - "conduzo o TDC nesta variante" - escreve o `conduz` de
D5 nas linhas daquele servidor.

Excluir uma variante na gaveta remove os blocos **daquele servidor** naquela
escala e variante - a gaveta nunca escreve sobre dado de outra pessoa (mesmo
motivo de D5). A variante some da grade quando o último servidor deixa de ter
bloco nela. A variante 1 não pode ser excluída: é o degrau final do fallback
de D4.

### D8 - "Por servidor" mostra as variantes

A aba lista, para cada escala com mais de uma variante, a jornada do servidor em
cada uma: "em TDC Presencial você faz 11:10–20:10 na variante 1 e 06:45–15:45 na
variante 2". É a informação que a pessoa de fato tem - qual delas vale numa data
concreta ninguém sabe, e a tela não finge saber.

### D9 - A régua da grade para de recortar

`posicaoNaBarra` recorta o bloco nas bordas da janela de cobertura e devolve
`forade: true` avisando disso. **Nenhuma view lê essa flag** - o trecho fora da
janela simplesmente some da tela, sem aviso.

Isso importa agora porque o TDC é justamente o que estoura a janela: uma EMEF
tem janela 07:00–18:20 e o horário de quem conduz vai até 20h10; uma unidade que
atende EJA vai bem além.

A régua passa a ser a **união da janela configurada com os blocos que a grade
efetivamente desenha** - os cinco dias, todas as escalas e variantes visíveis,
inclusive de quem não conta na cobertura. Nada é recortado, e os dias continuam
no mesmo eixo: a régua é uma só por grade, nunca uma por dia, senão os dias
deixam de ser comparáveis.

Ela é calculada sobre os blocos já resolvidos pelo fallback de D4, não sobre o
retorno cru de `getBlocos` - senão um bloco herdado esticaria a régua num dia
em que ele nem aparece.

**O cálculo de cobertura continua na janela configurada.** A régua é leitura; a
janela é a regra. `lacunasCobertura` não muda de contrato.

`forade` deixa de ser calculado: uma flag que ninguém lê é ruído, e depois desta
decisão ela seria sempre `false`.

### D10 - Supervisor(a) sai da equipe gestora

A migration 024 semeia `cargo_gestao` com `Gestor(a)`, `Coordenador(a)` e
`Supervisor(a)`. Supervisor(a) é cargo da SME: visita as unidades, não compõe a
gestão de nenhuma delas, e não entra na grade nem no cálculo de cobertura de
escola alguma.

A remoção é **idempotente e não destrutiva de configuração**: a tabela é
editável pela Gerência (é configuração de rede desde o Bloco G), então a
migration remove a linha semeada apenas se ela ainda estiver lá.

## 4. Arquivos

| Arquivo | O quê |
|---|---|
| `supabase/migrations/030_variantes_jornada.sql` | `variante`, `conduz`, CHECK, remoção do Supervisor(a) |
| `src/modules/horarios/horarios.model.js` | `variante` no payload; `validarDia` inalterado (já é por pessoa e por dia) |
| `src/modules/horarios/escalas.model.js` | `escolherBlocos` ganha os três degraus de D4; `jornadaEm` ganha `variante`; `variantesDe(blocos, escala, dia)` e `conduzDaVariante(blocos, …)` |
| `src/modules/horarios/grade.model.js` | `posicaoNaBarra` sem `forade`; `janelaDaGrade(janela, blocos)` para D9 |
| `src/modules/horarios/views/grade.js` | sub-linha por variante, cada uma com tira; rótulo derivado de `conduz` |
| `src/modules/horarios/views/jornada.js` | eixo de variante no estado, segunda `.tabbar`, caixa "conduzo" |
| `src/modules/horarios/views/por-escola.js` | passa `variante` aos helpers da grade |
| `src/modules/horarios/views/por-servidor.js` | D8 |
| `src/modules/horarios/horarios.css` | rótulo e tira da sub-linha |
| `docs/modulos/horarios.md` | tutorial (`doc: true`) |
| `tests/escalas.test.mjs` | os três degraus do fallback, `variantesDe`, `conduzDaVariante` |
| `tests/grade.test.mjs` | `janelaDaGrade`, cobertura por variante |

## 5. Riscos

1. **A gaveta ganha um segundo eixo e pode ficar confusa.** Mitigação: a segunda
   barra de abas só aparece quando existe mais de uma variante. Numa escola sem
   revezamento a tela é idêntica à de hoje.
2. **`conduz` sem constraint pode ficar inconsistente.** Aceito por D5: o pior
   caso é um rótulo estranho numa sub-linha, revertido ao desmarcar.
3. **A régua de D9 pode ficar larga demais** numa escola cujo TDC vai até 23h -
   as barras do dia normal ficam proporcionalmente estreitas. Aceito: o
   alternativo é continuar escondendo horário de gente que trabalha.
4. **Migration aplicada à mão.** Sem a 030, `variante` e `conduz` não existem e
   o Postgres devolve `42703`. O módulo degrada para o comportamento de hoje
   (uma variante só), avisando - padrão de `.claude/rules/dados.md`.

## 6. Critérios de aceite

1. Numa escola com dois gestores, é possível registrar duas variantes da quarta
   de TDC presencial e as duas aparecem na grade, cada uma com a própria tira de
   cobertura.
2. Alterar o horário de cobertura de uma variante **não** altera a outra.
3. Uma variante com lacuna é sinalizada sem que a outra seja.
4. Um servidor sem bloco na variante 2 herda o da variante 1; sem bloco na
   escala, herda o da `normal` (D4, três degraus, verificado em teste).
5. Marcar "conduzo o TDC nesta variante" muda o rótulo da sub-linha para o nome
   da pessoa; sem ninguém marcado, o rótulo é "Variante N".
6. Um bloco que termina depois da janela do tipo da escola aparece **inteiro**
   na grade, e a lacuna de cobertura continua sendo calculada só dentro da
   janela.
7. `Supervisor(a)` não aparece mais na configuração "Equipe gestora" nem na
   grade de nenhuma escola.
8. Sem a migration 030, a tela abre e funciona com uma variante só.
9. `python .claude/scripts/verificar_arquitetura.py` sem bloqueio; suíte de
   testes verde.
