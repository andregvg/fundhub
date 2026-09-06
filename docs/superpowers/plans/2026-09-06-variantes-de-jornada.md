# Variantes de jornada - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma escola registre mais de uma configuração completa do mesmo dia (o revezamento do TDC) e que a Gerência valide a cobertura de cada uma, separadamente.

**Architecture:** A jornada de um dia passa de `(unidade, dia, escala)` para `(unidade, dia, escala, variante)`. Duas colunas em `horario_bloco` (`variante smallint`, `conduz boolean`), nenhuma tabela nova, RLS intocada. Os blocos continuam com dono; a variante diz em qual configuração do dia eles valem. A grade desenha uma faixa por configuração, cada uma com a própria tira de cobertura.

**Tech Stack:** JavaScript ES modules sem build, Supabase/PostgREST, `node:test` para testes de função pura.

**Spec:** [`docs/superpowers/specs/2026-09-06-variantes-de-jornada-design.md`](../specs/2026-09-06-variantes-de-jornada-design.md)

## Global Constraints

- **Repositório PÚBLICO.** Nenhum dado real de pessoa ou escola em código, comentário, teste ou documentação. Inventar: `Escola Exemplo`, `Gestor(a) 1`, `nome@exemplo.com`, `(00) 00000-0000`. Rodar `git diff --cached` antes de cada commit.
- **PT-BR** em código, comentário, commit e interface.
- **Sem build, sem npm, sem dependência nova.**
- **Model nunca toca no DOM. View nunca chama `sb()`.**
- **Todo valor vindo do banco passa por `esc()`** antes de entrar em template literal.
- **Migrations são aplicadas à mão.** Todo código novo degrada se a 030 não rodou: coluna ausente = Postgres `42703`.
- **Data civil** = string `yyyy-mm-dd`. Formatação de data/hora só em `shared/format.js`.
- **Nenhuma cor literal** em `src/modules/**` - só `var(--token)`.
- Rodar antes de cada commit: `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes) e `node --test tests/*.test.mjs` (tudo verde).
- Trabalhar na branch **`dev`**.
- **`variante` ausente vale 1.** Todo código que lê a coluna usa o helper `varDe(b)`, nunca `b.variante` direto - sem a migration a propriedade não existe.

---

### Task 1: Migration 030 e o fallback de três degraus

**Files:**
- Create: `supabase/migrations/030_variantes_jornada.sql`
- Modify: `src/modules/horarios/escalas.model.js` (`escolherBlocos`, `jornadaEm`)
- Test: `tests/escalas.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `varDe(bloco) -> number` · `escolherBlocos(blocos, escala, variante = 1) -> bloco[]` · `jornadaEm(blocos, { escala, dataISO, variante = 1 }) -> bloco[]`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/030_variantes_jornada.sql`:

```sql
-- ============================================================
-- 030 - Variantes de jornada (o revezamento do TDC)
-- Spec: docs/superpowers/specs/2026-09-06-variantes-de-jornada-design.md
--
-- Em dia de TDC a escola tem DUAS configuracoes do mesmo dia, e nunca
-- se sabe qual vale numa data. As duas nao sao intercambiaveis: cada
-- uma tem a propria cobertura. `variante` e o segundo eixo do dia;
-- `conduz` marca as linhas de quem conduz o TDC naquela variante.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================

alter table horario_bloco add column if not exists variante smallint not null default 1;
alter table horario_bloco add column if not exists conduz   boolean  not null default false;

-- Toda jornada ja gravada e a variante 1. O CHECK so garante que
-- ninguem grave 0 ou negativo - nao ha teto: uma escola com tres
-- gestores em rodizio grava tres.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'horario_variante_positiva') then
    alter table horario_bloco add constraint horario_variante_positiva check (variante >= 1);
  end if;
end $$;

-- A grade le por (unidade, dia, escala, variante); o indice existente
-- cobre os tres primeiros. Sem indice novo: a leitura ja e por unidade
-- e o volume por unidade e de dezenas de linhas.

-- ── D10: Supervisor(a) sai da equipe gestora ──
-- Supervisor(a) e cargo da SME: visita as unidades, nao compoe a gestao
-- de nenhuma delas, e nao entra na grade nem no calculo de cobertura de
-- escola alguma. A tabela e editavel pela Gerencia (configuracao de
-- rede desde o Bloco G), entao a remocao e so da linha semeada.
delete from cargo_gestao where cargo = 'Supervisor(a)';

select registrar_migration('030', 'Variantes de jornada (horario_bloco.variante, .conduz)');
```

- [ ] **Step 2: Escrever os testes que falham**

Acrescentar em `tests/escalas.test.mjs`, logo abaixo do bloco `// ── escolherBlocos ──` existente:

```js
// ── escolherBlocos: os tres degraus do fallback (D4) ──
const BV = (escala, variante, inicio) => ({ escala, variante, inicio, fim: '12:00', dia_semana: 3 });

test('degrau 1: a escala e a variante pedidas', () => {
  const blocos = [BV('tdc-presencial', 1, '11:10'), BV('tdc-presencial', 2, '06:45')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-presencial', 2).map(b => b.inicio), ['06:45']);
});

test('degrau 2: sem bloco na variante, cai na variante 1 da MESMA escala', () => {
  // O horario que nao muda entre as variantes se escreve uma vez so.
  const blocos = [BV('tdc-presencial', 1, '08:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-presencial', 2).map(b => b.inicio), ['08:00']);
});

test('degrau 3: sem bloco na escala, cai no normal variante 1', () => {
  const blocos = [BV('normal', 1, '07:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-virtual', 2).map(b => b.inicio), ['07:00']);
});

test('o degrau 3 ignora variante alta do normal - so a 1 e fallback', () => {
  const blocos = [BV('normal', 2, '09:45')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-virtual', 2), []);
});

test('variante do normal nao cai em outra coisa', () => {
  const blocos = [BV('normal', 1, '07:00')];
  assert.deepEqual(escolherBlocos(blocos, 'normal', 2).map(b => b.inicio), ['07:00']);
  assert.deepEqual(escolherBlocos([BV('tdc-presencial', 1, '08:00')], 'normal', 2), []);
});

test('bloco sem a coluna variante conta como variante 1 - sem a migration 030', () => {
  const blocos = [{ escala: 'normal', inicio: '07:00', fim: '12:00', dia_semana: 3 }];
  assert.deepEqual(escolherBlocos(blocos, 'normal', 1).map(b => b.inicio), ['07:00']);
  assert.deepEqual(escolherBlocos(blocos, 'tdc-presencial', 1).map(b => b.inicio), ['07:00']);
});

test('jornadaEm respeita a variante', () => {
  // 2026-09-02 e uma quarta-feira.
  const blocos = [BV('tdc-presencial', 1, '11:10'), BV('tdc-presencial', 2, '06:45')];
  assert.deepEqual(
    jornadaEm(blocos, { escala: 'tdc-presencial', dataISO: '2026-09-02', variante: 2 }).map(b => b.inicio),
    ['06:45']);
});
```

Acrescentar `varDe` ao import no topo do arquivo:

```js
import { resolverEscala, escolherBlocos, diaDaSemana, jornadaEm, rotulaEscala, escalasParaJornada, varDe }
  from '../src/modules/horarios/escalas.model.js';
```

E um teste de `varDe`:

```js
// ── varDe ──
test('varDe: sem a coluna, a variante e 1', () => {
  assert.equal(varDe({}), 1);
  assert.equal(varDe({ variante: null }), 1);
  assert.equal(varDe({ variante: 3 }), 3);
});
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `node --test tests/escalas.test.mjs`
Expected: FAIL - `varDe` não é exportado (`SyntaxError: The requested module ... does not provide an export named 'varDe'`).

- [ ] **Step 4: Implementar**

Em `src/modules/horarios/escalas.model.js`, substituir a função `escolherBlocos` inteira (e o comentário acima dela) por:

```js
// A variante de um bloco. SEMPRE por aqui, nunca `b.variante` direto:
// sem a migration 030 a coluna não existe e a propriedade vem
// `undefined` - toda jornada gravada antes dela é a variante 1.
export const varDe = (b) => b?.variante ?? 1;

const daEscala = (lista, escala) => lista.filter(b => (b.escala || 'normal') === escala);

// Blocos daquela escala e variante, em três degraus (D4 da spec
// 2026-09-06-variantes-de-jornada):
//
//   1. a escala e a variante pedidas;
//   2. a MESMA escala, variante 1 - o horário que não muda entre as
//      variantes se escreve uma vez só (a coordenadora que tem horário
//      próprio de TDC, igual nas duas, escreve na 1 e vale nas duas);
//   3. a escala 'normal', variante 1 - o fallback que já existia, o que
//      poupa registro de quem não tem jornada alternativa nenhuma.
//
// 'normal'/1 nunca cai em outra coisa: seria circular.
export function escolherBlocos(blocos, escala, variante = 1) {
  const lista = blocos || [];

  const exatos = daEscala(lista, escala).filter(b => varDe(b) === variante);
  if (exatos.length) return exatos;

  if (variante !== 1) {
    const base = daEscala(lista, escala).filter(b => varDe(b) === 1);
    if (base.length) return base;
  }

  if (escala === 'normal') return [];
  return daEscala(lista, 'normal').filter(b => varDe(b) === 1);
}
```

E em `jornadaEm`, acrescentar a variante:

```js
// A jornada de uma data: o dia da semana filtra, a escala e a variante
// escolhem. Qual variante vale numa data concreta ninguém sabe - o
// parâmetro existe para a tela poder pedir cada uma.
export function jornadaEm(blocos, { escala, dataISO, variante = 1 }) {
  const dow = diaDaSemana(dataISO);
  if (dow < 1 || dow > 5) return [];              // fim de semana não tem jornada
  return escolherBlocos((blocos || []).filter(b => b.dia_semana === dow), escala, variante);
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `node --test tests/escalas.test.mjs`
Expected: PASS, incluindo os quatro testes antigos de `escolherBlocos` (que não passam variante e continuam valendo pelo default `1`).

- [ ] **Step 6: Verificador e commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add supabase/migrations/030_variantes_jornada.sql src/modules/horarios/escalas.model.js tests/escalas.test.mjs
git diff --cached
git commit -m "feat(horarios): variante como segundo eixo do dia - fallback em tres degraus

Migration 030 acrescenta horario_bloco.variante e .conduz, e tira
Supervisor(a) da equipe gestora (D10). escolherBlocos ganha o terceiro
argumento e o degrau do meio: a mesma escala na variante 1, para o
horario que nao muda entre variantes ser escrito uma vez so.

varDe() e o unico jeito de ler a coluna - sem a migration ela nao
existe e todo bloco antigo e a variante 1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `variantesDe` e `conduzDaVariante`

**Files:**
- Modify: `src/modules/horarios/escalas.model.js`
- Test: `tests/escalas.test.mjs`

**Interfaces:**
- Consumes: `varDe(bloco)` da Task 1.
- Produces: `variantesDe(blocos, escala, dia) -> number[]` · `conduzDaVariante(blocos, { escala, dia, variante, ordem }) -> servidorId | null`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `tests/escalas.test.mjs`:

```js
// ── variantesDe / conduzDaVariante ──
import { variantesDe, conduzDaVariante } from '../src/modules/horarios/escalas.model.js';

const BQ = (servidor_id, escala, variante, inicio, extra = {}) =>
  ({ servidor_id, escala, variante, inicio, fim: '12:00', dia_semana: 3, ...extra });

test('variantesDe: um dia sem nada ainda tem a variante 1', () => {
  assert.deepEqual(variantesDe([], 'tdc-presencial', 3), [1]);
});

test('variantesDe: devolve em ordem, sem repetir', () => {
  const blocos = [BQ('s1', 'tdc-presencial', 2, '06:45'), BQ('s2', 'tdc-presencial', 2, '11:10'),
                  BQ('s1', 'tdc-presencial', 1, '11:10')];
  assert.deepEqual(variantesDe(blocos, 'tdc-presencial', 3), [1, 2]);
});

test('variantesDe: nao mistura escala nem dia', () => {
  const blocos = [BQ('s1', 'tdc-virtual', 3, '10:40'),
                  { ...BQ('s1', 'tdc-presencial', 4, '10:40'), dia_semana: 5 }];
  assert.deepEqual(variantesDe(blocos, 'tdc-presencial', 3), [1]);
});

test('conduzDaVariante: devolve quem esta marcado naquela variante', () => {
  const blocos = [BQ('s1', 'tdc-presencial', 1, '11:10', { conduz: true }),
                  BQ('s2', 'tdc-presencial', 1, '06:45'),
                  BQ('s2', 'tdc-presencial', 2, '11:10', { conduz: true })];
  assert.equal(conduzDaVariante(blocos, { escala: 'tdc-presencial', dia: 3, variante: 1 }), 's1');
  assert.equal(conduzDaVariante(blocos, { escala: 'tdc-presencial', dia: 3, variante: 2 }), 's2');
});

test('conduzDaVariante: ninguem marcado e null - a quarta sem TDC que reveza', () => {
  const blocos = [BQ('s1', 'normal', 2, '09:45'), BQ('s2', 'normal', 2, '06:50')];
  assert.equal(conduzDaVariante(blocos, { escala: 'normal', dia: 3, variante: 2 }), null);
});

test('conduzDaVariante: com dois marcados, vence o primeiro da ordem da grade', () => {
  // Estado que nenhuma constraint impede (D5). O desempate existe para
  // o rotulo nao trocar entre dois repintes da mesma tela.
  const blocos = [BQ('s1', 'tdc-presencial', 1, '11:10', { conduz: true }),
                  BQ('s2', 'tdc-presencial', 1, '06:45', { conduz: true })];
  assert.equal(conduzDaVariante(blocos, { escala: 'tdc-presencial', dia: 3, variante: 1, ordem: ['s2', 's1'] }), 's2');
  assert.equal(conduzDaVariante(blocos, { escala: 'tdc-presencial', dia: 3, variante: 1, ordem: ['s1', 's2'] }), 's1');
});

test('conduzDaVariante: marcado fora da ordem ainda e devolvido', () => {
  // Quem conduz pode ter saido da grade (deixou de ser exibido). Melhor
  // rotular com o nome certo do que cair em "variante N".
  const blocos = [BQ('s9', 'tdc-presencial', 1, '11:10', { conduz: true })];
  assert.equal(conduzDaVariante(blocos, { escala: 'tdc-presencial', dia: 3, variante: 1, ordem: ['s1'] }), 's9');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/escalas.test.mjs`
Expected: FAIL - `does not provide an export named 'variantesDe'`.

- [ ] **Step 3: Implementar**

Acrescentar em `src/modules/horarios/escalas.model.js`, logo depois de `escolherBlocos`:

```js
// Os números de variante em uso numa (escala, dia) de uma unidade, em
// ordem crescente. SEMPRE inclui a 1: um dia sem nenhum bloco escrito
// ainda tem a variante 1 - a implícita, degrau final do fallback de D4.
export function variantesDe(blocos, escala, dia) {
  const ns = new Set([1]);
  for (const b of blocos || []) {
    if ((b.escala || 'normal') === escala && b.dia_semana === dia) ns.add(varDe(b));
  }
  return [...ns].sort((a, b) => a - b);
}

// Quem conduz o TDC naquela variante (o `servidor_id`), ou null.
//
// Null é estado VÁLIDO e previsto: na quarta-feira sem TDC que tem
// revezamento não há responsável nenhum, e a tela cai em "Variante N".
//
// Nenhuma constraint impede dois marcados na mesma variante (seria um
// índice parcial sobre um agregado - D5). Com dois, vence o primeiro
// da `ordem` da grade: o desempate precisa ser determinístico, senão o
// rótulo troca entre dois repintes da mesma tela. Marcado que não está
// na ordem (saiu da grade) ainda é devolvido - o nome certo é melhor
// que "variante N".
export function conduzDaVariante(blocos, { escala, dia, variante, ordem = [] } = {}) {
  const ids = new Set((blocos || [])
    .filter(b => (b.escala || 'normal') === escala && b.dia_semana === dia
              && varDe(b) === variante && b.conduz)
    .map(b => b.servidor_id));
  if (!ids.size) return null;
  for (const id of ordem) if (ids.has(id)) return id;
  return [...ids].sort()[0];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/escalas.test.mjs`
Expected: PASS.

- [ ] **Step 5: Conferir o tamanho do arquivo (R11)**

Run: `wc -l src/modules/horarios/escalas.model.js`
`escalas.model.js` tinha 193 linhas e o limite de model é **250** (`.claude/rules/arquitetura.md` R11). As duas funções somam ~35 linhas com comentário - deve ficar por volta de 240. Se passar de 250, **não dividir agora**: anotar no commit e tratar na Task 9, porque dividir no meio da entrega deixa o plano fora de sincronia com o código.

- [ ] **Step 6: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/escalas.model.js tests/escalas.test.mjs
git commit -m "feat(horarios): variantesDe e conduzDaVariante

Quais configuracoes um dia tem, e quem conduz o TDC em cada uma. O
desempate de conduzDaVariante e deterministico de proposito: sem
constraint que impeca dois marcados, um desempate instavel faria o
rotulo da sub-linha trocar entre dois repintes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: A régua da grade para de recortar

**Files:**
- Modify: `src/modules/horarios/grade.model.js` (`posicaoNaBarra`, nova `janelaDaGrade`)
- Test: `tests/grade.test.mjs`

**Interfaces:**
- Consumes: `paraMin` de `horarios.model.js` (já importado no arquivo).
- Produces: `janelaDaGrade(janela, blocosDesenhados) -> { ini, fim }`. `posicaoNaBarra` deixa de devolver `forade`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `tests/grade.test.mjs`:

```js
// ── janelaDaGrade (D9) ──
import { janelaDaGrade } from '../src/modules/horarios/grade.model.js';

test('janelaDaGrade: sem bloco fora, a janela nao muda', () => {
  const blocos = [{ inicio: '08:00', fim: '17:00' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), J1);
});

test('janelaDaGrade: estica para caber o TDC que passa do fim da janela', () => {
  // O horario de quem conduz o TDC vai muito alem do fim da janela da
  // EMEF (18:20). Antes disso a barra era recortada e o trecho sumia.
  const blocos = [{ inicio: '11:10', fim: '20:10' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), { ini: paraMin('07:00'), fim: paraMin('20:10') });
});

test('janelaDaGrade: estica tambem para tras', () => {
  const blocos = [{ inicio: '06:45', fim: '15:45' }];
  assert.deepEqual(janelaDaGrade(J1, blocos), { ini: paraMin('06:45'), fim: paraMin('18:20') });
});

test('janelaDaGrade: lista vazia devolve a janela recebida', () => {
  assert.deepEqual(janelaDaGrade(J2, []), J2);
  assert.deepEqual(janelaDaGrade(J2, undefined), J2);
});

test('janelaDaGrade: uma regua so para o pior caso da semana', () => {
  // A regua e UMA por grade: dias com reguas diferentes deixam de ser
  // comparaveis, que e o motivo de a grade existir.
  const blocos = [{ inicio: '07:00', fim: '12:00' }, { inicio: '14:00', fim: '23:00' }];
  assert.equal(janelaDaGrade(J1, blocos).fim, paraMin('23:00'));
});

test('posicaoNaBarra: um bloco que cabe na regua ocupa ate o fim dela', () => {
  const bloco = { inicio: '11:10', fim: '20:10' };
  const regua = janelaDaGrade(J1, [bloco]);
  const p = posicaoNaBarra(bloco, regua);
  assert.equal(Math.round(p.esquerda + p.largura), 100);
});

test('posicaoNaBarra nao devolve mais a flag forade', () => {
  // Ela era calculada e nenhuma view a lia - o trecho fora da janela
  // sumia da tela sem aviso. Com a regua de D9 ela seria sempre false.
  assert.ok(!('forade' in posicaoNaBarra({ inicio: '08:00', fim: '12:00' }, J1)));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/grade.test.mjs`
Expected: FAIL - `does not provide an export named 'janelaDaGrade'`.

- [ ] **Step 3: Implementar**

Em `src/modules/horarios/grade.model.js`, substituir `posicaoNaBarra` por:

```js
// Posição de um bloco na barra gráfica, em % da régua.
//
// O recorte continua, como rede de segurança para quem passar uma
// janela não esticada - mas com `janelaDaGrade` ele não deve acontecer
// mais. A flag `forade` saiu: ela era calculada, nenhuma view a lia, e
// o trecho fora da janela sumia da tela em silêncio (D9).
export function posicaoNaBarra(bloco, { ini, fim } = JANELA_FABRICA) {
  const janela = fim - ini;
  const i = Math.max(paraMin(bloco.inicio), ini);
  const f = Math.min(paraMin(bloco.fim), fim);
  return {
    esquerda: ((i - ini) / janela) * 100,
    largura: (Math.max(f - i, 0) / janela) * 100,
  };
}

// A RÉGUA da grade: a janela de cobertura esticada para caber tudo que
// a grade desenha. Em dia de TDC o horário de quem conduz vai muito
// além do fim da janela (uma EMEF fecha 18:20 e o TDC vai a 20h10),
// e antes disso a barra era recortada sem aviso.
//
// UMA régua por grade, nunca uma por dia: dias com réguas diferentes
// deixam de ser comparáveis, que é o motivo de a grade existir.
//
// Recebe os blocos JÁ RESOLVIDOS pelo fallback de D4, não o retorno cru
// de getBlocos - um bloco herdado esticaria a régua num dia em que ele
// nem aparece.
//
// A régua é leitura; a JANELA continua sendo a regra: `lacunasCobertura`
// não muda de contrato e segue recebendo a janela configurada.
export function janelaDaGrade(janela, blocosDesenhados) {
  let { ini, fim } = janela || JANELA_FABRICA;
  for (const b of blocosDesenhados || []) {
    ini = Math.min(ini, paraMin(b.inicio));
    fim = Math.max(fim, paraMin(b.fim));
  }
  return { ini, fim };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/grade.test.mjs`
Expected: PASS.

- [ ] **Step 5: Confirmar que ninguém lia `forade`**

Run: `grep -rn "forade" src/`
Expected: nenhuma linha (a única ocorrência era a própria atribuição, agora removida).

- [ ] **Step 6: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/grade.model.js tests/grade.test.mjs
git commit -m "feat(horarios): a regua da grade estica em vez de recortar

posicaoNaBarra recortava o bloco na borda da janela e devolvia uma flag
`forade` avisando - que nenhuma view lia. Com o TDC indo alem do fim da
janela da escola, o horario sumia da tela em silencio.

janelaDaGrade estica a regua para caber o que a grade desenha. Uma
regua por grade, nunca uma por dia. O calculo de cobertura continua na
janela configurada: a regua e leitura, a janela e a regra.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `variante` e `conduz` na gravação, com degradação

**Files:**
- Modify: `src/modules/horarios/horarios.model.js` (`criarBloco`, `atualizarBloco`)
- Test: `tests/horarios.test.mjs`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: `semColunasNovas(payload) -> payload` (exportada só para o teste). `criarBloco`/`atualizarBloco` aceitam `variante` e `conduz` no payload e degradam sozinhos sem a migration 030.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao final de `tests/horarios.test.mjs`:

```js
// ── degradacao sem a migration 030 ──
import { semColunasNovas } from '../src/modules/horarios/horarios.model.js';

test('semColunasNovas tira variante e conduz, preserva o resto', () => {
  const payload = {
    servidor_id: 's1', unidade_id: 'u1', dia_semana: 3,
    inicio: '07:00', fim: '12:00', obs: null, escala: 'normal',
    variante: 2, conduz: true,
  };
  const out = semColunasNovas(payload);
  assert.ok(!('variante' in out));
  assert.ok(!('conduz' in out));
  assert.deepEqual(out, {
    servidor_id: 's1', unidade_id: 'u1', dia_semana: 3,
    inicio: '07:00', fim: '12:00', obs: null, escala: 'normal',
  });
});

test('semColunasNovas nao muda o objeto original', () => {
  const payload = { escala: 'normal', variante: 2 };
  semColunasNovas(payload);
  assert.equal(payload.variante, 2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/horarios.test.mjs`
Expected: FAIL - `does not provide an export named 'semColunasNovas'`.

- [ ] **Step 3: Implementar**

Em `src/modules/horarios/horarios.model.js`, substituir `criarBloco` e `atualizarBloco` por:

```js
// Sem a migration 030 as colunas `variante`/`conduz` não existem e o
// PostgREST devolve 42703 na escrita (a LEITURA não quebra: o select é
// `*`, que traz o que existir). Em vez de derrubar a gaveta, grava sem
// elas - que é exatamente o comportamento anterior à 030: uma variante
// só. `.claude/rules/dados.md`, degradação por migration ausente.
export const semColunasNovas = ({ variante, conduz, ...resto }) => resto;

// Lembrado entre chamadas: descobrir a ausência uma vez por sessão
// evita pagar um round-trip perdido a cada bloco de um lote.
let _temColunasNovas = true;

export async function criarBloco(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...payload, criado_por: await emailAtual() };
  const inserir = (r) => sb().from('horario_bloco').insert(r).select(SEL).single();

  let { data, error } = await inserir(_temColunasNovas ? row : semColunasNovas(row));
  if (error?.code === '42703' && _temColunasNovas) {
    _temColunasNovas = false;
    ({ data, error } = await inserir(semColunasNovas(row)));
  }
  if (error) throw error;
  return data;
}

export async function atualizarBloco(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const gravar = (r) => sb().from('horario_bloco').update(r).eq('id', id);

  let { error } = await gravar(_temColunasNovas ? payload : semColunasNovas(payload));
  if (error?.code === '42703' && _temColunasNovas) {
    _temColunasNovas = false;
    ({ error } = await gravar(semColunasNovas(payload)));
  }
  if (error) throw error;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/horarios.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/horarios.model.js tests/horarios.test.mjs
git commit -m "feat(horarios): gravar variante e conduz, degradando sem a migration

Sem a 030 as colunas nao existem e a escrita devolve 42703 (a leitura
nao quebra: o select e `*`). O model tenta com as colunas, e na primeira
recusa passa a gravar sem elas pelo resto da sessao - o comportamento
de antes da 030, uma variante so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: A grade desenha uma faixa por configuração do dia

**Files:**
- Modify: `src/modules/horarios/views/grade.js` (`gradeHtml`)
- Modify: `src/modules/horarios/horarios.css`
- Test: `tests/grade-html.test.mjs` (criar)

**Interfaces:**
- Consumes: `lacunasCobertura`, `posicaoNaBarra` (Task 3).
- Produces: `gradeHtml(dias, { linhas, blocosDe, mostrarCobertura, janela, subLinhas, blocosDeEscala })` onde `subLinhas` é `{ dia, escala, variante, rotulo }[]` e `blocosDeEscala` é `(servidorId, dia, escala, variante) -> bloco[]`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/grade-html.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeHtml } from '../src/modules/horarios/views/grade.js';
import { paraMin } from '../src/modules/horarios/horarios.model.js';

const J = { ini: paraMin('07:00'), fim: paraMin('20:10') };
const DIAS_QUA = [{ n: 3, curto: 'Qua', nome: 'Quarta' }];

const linhas = [
  { servidor: { id: 's1', nome: 'Gestor 1' }, cargo: 'Gestor(a)', serie: 0, contaCobertura: true },
  { servidor: { id: 's2', nome: 'Gestor 2' }, cargo: 'Gestor(a)', serie: 1, contaCobertura: true },
];

const B = (servidor_id, inicio, fim) => ({ id: `${servidor_id}-${inicio}`, servidor_id, inicio, fim, dia_semana: 3 });

// Variante 1 cobre 07:00-20:10; variante 2 deixa um buraco no fim.
const porVariante = {
  1: { s1: [B('s1', '11:10', '20:10')], s2: [B('s2', '07:00', '15:45')] },
  2: { s1: [B('s1', '07:00', '15:45')], s2: [B('s2', '11:10', '17:00')] },
};

const blocosDeEscala = (id, dia, escala, variante) => porVariante[variante]?.[id] || [];
const blocosDe = () => [];

const subLinhas = [
  { dia: 3, escala: 'tdc-presencial', variante: 1, rotulo: 'TDC Presencial · quando Gestor 1 conduz' },
  { dia: 3, escala: 'tdc-presencial', variante: 2, rotulo: 'TDC Presencial · variante 2' },
];

test('cada variante vira uma sub-linha propria', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  assert.equal(html.split('hg-sublinha').length - 1, 2);
  assert.ok(html.includes('quando Gestor 1 conduz'));
  assert.ok(html.includes('variante 2'));
});

test('cada sub-linha tem tira de cobertura propria (D3, substitui D6.2)', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  // Uma tira do dia regular + uma por sub-linha.
  assert.equal(html.split('hg-cobertura').length - 1, 3);
});

test('a variante com buraco marca lacuna e a outra nao', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: true, janela: J, subLinhas, blocosDeEscala });
  const [, v1, v2] = html.split('hg-sublinha');
  assert.ok(!v1.includes('hg-lacuna'), 'variante 1 cobre a janela inteira');
  assert.ok(v2.includes('hg-lacuna'), 'variante 2 deixa 17:00-20:10 descoberto');
});

test('sem cobertura (a sede da SME), nenhuma tira em lugar nenhum', () => {
  const html = gradeHtml(DIAS_QUA, { linhas, blocosDe, mostrarCobertura: false, janela: J, subLinhas, blocosDeEscala });
  assert.ok(!html.includes('hg-cobertura'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/grade-html.test.mjs`
Expected: FAIL - a sub-linha ainda não tem tira de cobertura (o segundo teste conta 1 em vez de 3) e `blocosDeEscala` ainda é chamada sem `variante`.

- [ ] **Step 3: Implementar**

Em `src/modules/horarios/views/grade.js`, dentro de `gradeHtml`, extrair a tira de cobertura (hoje duplicada no corpo do dia) para um helper local, logo depois das três primeiras `const` (`serieDe`, `nomeDe`, `contam`):

```js
  // A tira de lacunas de UM conjunto de blocos. Extraída porque agora
  // ela aparece duas vezes: sob o dia regular e sob CADA sub-linha -
  // cada configuração do dia tem a própria cobertura (D3).
  const tiraHtml = (doDia) => {
    if (!mostrarCobertura) return '';
    const lacunas = lacunasCobertura(doDia.filter(b => contam.has(b.servidor_id)), janela);
    return `<div class="hg-cobertura">${lacunas.map(l => {
      const pos = posDoIntervalo(l.ini, l.fim, janela);
      return `<span class="hg-lacuna" style="left:${pos.esquerda}%;width:${pos.largura}%"
        title="Sem ninguém entre ${esc(paraHora(l.ini))} e ${esc(paraHora(l.fim))}"></span>`;
    }).join('')}</div>`;
  };
```

Substituir `subLinhaHtml` inteira por:

```js
  // Uma faixa fina abaixo do dia para cada CONFIGURAÇÃO ALTERNATIVA
  // dele - outra escala (o TDC) ou outra variante da mesma escala (o
  // revezamento da quarta sem TDC). Blocos e validação daquela
  // configuração, nunca somados aos do dia regular (D6.1), e tira de
  // cobertura própria: se as variantes cobrem a escola de formas
  // diferentes, a única tira útil é a de cada uma (D3).
  const subLinhaHtml = (dia) => subLinhas.filter(s => s.dia === dia).map(s => {
    const doDia = linhas.flatMap(l => (blocosDeEscala?.(l.servidor.id, dia, s.escala, s.variante)) || []);
    if (!doDia.length) return '';
    const faixas = contarFaixas(doDia);
    const barras = empilhar(doDia).map(({ bloco, faixa }) => {
      const p = posicaoNaBarra(bloco, janela);
      const serie = (serieDe.get(bloco.servidor_id) ?? 0) + 1;
      return `<span class="hg-bloco serie-${serie}" style="left:${p.esquerda}%;width:${p.largura}%;top:${faixa * 26}px"
        title="${esc(nomeDe.get(bloco.servidor_id) || '')} · ${esc(hhmm(bloco.inicio))}–${esc(hhmm(bloco.fim))}">
        <span>${esc(hhmm(bloco.inicio))}–${esc(hhmm(bloco.fim))}</span></span>`;
    }).join('');
    const marcasFalha = linhas.flatMap(l => {
      const meus = (blocosDeEscala?.(l.servidor.id, dia, s.escala, s.variante)) || [];
      return validarDia(meus).map(pb => {
        const pos = posDoIntervalo(pb.ini, pb.fim, janela);
        return `<span class="hg-falha n-${pb.nivel}" style="left:${pos.esquerda}%;width:${pos.largura}%"
          title="${esc(l.servidor.nome)}: ${esc(pb.texto)}"></span>`;
      });
    }).join('');
    return `<div class="hg-sublinha">
      <div class="hg-sub-rotulo">${esc(s.rotulo)}</div>
      <div class="hg-track" style="height:${faixas * 26 + 4}px">${eixo(janela)}${barras}${marcasFalha}</div>
      ${tiraHtml(doDia)}
    </div>`;
  }).join('');
```

E no corpo do dia, trocar o cálculo inline de `lacunas`/`tira` pela chamada ao helper. Substituir estas linhas:

```js
    const lacunas = mostrarCobertura
      ? lacunasCobertura(doDia.filter(b => contam.has(b.servidor_id)), janela)
      : [];
    const tira = mostrarCobertura
      ? `<div class="hg-cobertura">${lacunas.map(l => {
          const pos = posDoIntervalo(l.ini, l.fim, janela);
          return `<span class="hg-lacuna" style="left:${pos.esquerda}%;width:${pos.largura}%"
            title="Sem ninguém entre ${esc(paraHora(l.ini))} e ${esc(paraHora(l.fim))}"></span>`;
        }).join('')}</div>`
      : '';
```

por:

```js
    const tira = tiraHtml(doDia);
```

**Atenção:** `tiraHtml` e `subLinhaHtml` usam `janela`, `contam`, `linhas` e `mostrarCobertura` por closure, e `subLinhaHtml` precisa estar declarada **depois** de `tiraHtml` (ambas são `const`, sem hoisting).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/grade-html.test.mjs`
Expected: PASS, os quatro testes.

- [ ] **Step 5: CSS do rótulo e da tira da sub-linha**

Em `src/modules/horarios/horarios.css`, localizar o bloco de `.hg-sublinha` / `.hg-sub-rotulo` e garantir que a tira dentro da sub-linha tenha o mesmo tratamento da tira do dia. Acrescentar, logo depois das regras existentes de `.hg-sublinha`:

```css
/* A sub-linha ganhou tira de cobertura própria (spec 2026-09-06, D3):
   cada configuração do dia tem a sua. Mesmo desenho da tira do dia,
   só um pouco mais discreta - a de cima é a do dia regular. */
.hg-sublinha .hg-cobertura { opacity: .85; }
```

Nenhuma cor literal (R9): a tira herda os tokens de `.hg-cobertura`/`.hg-lacuna`.

- [ ] **Step 6: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/views/grade.js src/modules/horarios/horarios.css tests/grade-html.test.mjs
git commit -m "feat(horarios): uma faixa por configuracao do dia, com cobertura propria

A sub-linha deixa de ser 'o TDC' e passa a ser 'outra configuracao
deste dia' - outra escala ou outra variante da mesma escala, o que faz
o revezamento da quarta sem TDC funcionar sem mecanismo proprio.

Cada uma ganha tira de cobertura propria. Substitui a D6.2 de
2026-09-05: com duas configuracoes concorrentes, uma sub-linha sem tira
seria o unico lugar da tela que nao responde a pergunta da tela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: "Por escola" monta as variantes e a régua

**Files:**
- Modify: `src/modules/horarios/views/por-escola.js`

**Interfaces:**
- Consumes: `variantesDe`, `conduzDaVariante`, `varDe`, `escolherBlocos` (Tasks 1-2); `janelaDaGrade` (Task 3); `gradeHtml` com `subLinhas`/`blocosDeEscala` de 4 argumentos (Task 5).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Ampliar os imports**

Em `src/modules/horarios/views/por-escola.js`, trocar as duas linhas de import:

```js
import { escolherBlocos, rotulaEscala, variantesDe, conduzDaVariante, varDe } from '../escalas.model.js';
import { ordenarParaGrade, janelaDaGrade } from '../grade.model.js';
```

- [ ] **Step 2: `blocosDe` e `blocosDeEscala` ganham a variante**

Substituir as duas funções (logo abaixo de `carregar()`) por:

```js
// O dia regular desenha SEMPRE a variante 1 - as demais entram como
// sub-linha (D6). O fallback de três degraus mora em escolherBlocos.
const blocosDe = (servidorId, dia) =>
  escolherBlocos(blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia), escalaVista, 1);

// Blocos EXATAMENTE daquela escala e variante (sem o fallback) - a
// sub-linha só mostra quem tem horário próprio ali (D6.3).
const blocosDeEscala = (servidorId, dia, escala, variante = 1) =>
  blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia
    && (b.escala || 'normal') === escala && varDe(b) === variante);
```

- [ ] **Step 3: Montar as sub-linhas das duas origens**

Dentro de `carregar()`, substituir o bloco que hoje monta `subLinhas` (as três linhas que começam em `const subLinhas = [...diasFixos]`) por:

```js
  // Duas origens de sub-linha, mesmo desenho (D6):
  //   • outra ESCALA no mesmo dia - o TDC, que já era assim;
  //   • outra VARIANTE da escala visível - o revezamento da quarta sem
  //     TDC, que assim não precisa de mecanismo próprio.
  const subDeEscala = [...diasFixos]
    .filter(([chave]) => (ctxAtual.escalasEmUso || []).includes(chave))
    .flatMap(([chave, dia]) => variantesDe(blocos, chave, dia)
      .map(v => ({ dia, escala: chave, variante: v, rotulo: rotuloSubLinha(chave, dia, v) })));

  // `.slice(1)`: a variante 1 da escala visível JÁ é o dia regular, a
  // faixa de cima. Repeti-la abaixo seria a mesma informação duas vezes.
  const subDeVariante = DIAS.flatMap(d => variantesDe(blocos, escalaVista, d.n).slice(1)
    .map(v => ({ dia: d.n, escala: escalaVista, variante: v, rotulo: rotuloSubLinha(escalaVista, d.n, v) })));

  const subLinhas = [...subDeVariante, ...subDeEscala];
```

E acrescentar a função de rótulo no fim do arquivo, junto das outras auxiliares:

```js
// O rótulo de uma sub-linha. Sai de quem está marcado como condutor
// (D5); sem ninguém marcado - a quarta que reveza sem ter TDC - cai no
// número da variante, e o mesmo mecanismo continua servindo.
// A ordem da grade entra como desempate determinístico.
function rotuloSubLinha(escala, dia, variante) {
  const nome = rotulaEscala(escala, ctxAtual.catalogoEscalas);
  const so = variantesDe(blocos, escala, dia).length <= 1;
  if (so && escala !== escalaVista) return nome;

  const condutorId = conduzDaVariante(blocos, {
    escala, dia, variante, ordem: linhas.map(l => l.servidor.id),
  });
  const condutor = condutorId
    && (linhas.find(l => l.servidor.id === condutorId)?.servidor.nome
        || servidores.find(s => s.id === condutorId)?.nome);
  if (condutor) return `${nome} · quando ${condutor} conduz`;
  return so ? nome : `${nome} · variante ${variante}`;
}
```

- [ ] **Step 4: A régua estica para caber tudo que será desenhado**

Ainda em `carregar()`, logo **depois** da montagem de `subLinhas` e **antes** do `corpo.innerHTML`, acrescentar:

```js
  // A régua é UMA por grade e precisa caber tudo que a grade desenha -
  // inclusive quem não conta na cobertura. Calculada sobre os blocos já
  // RESOLVIDOS pelo fallback: um bloco herdado esticaria a régua num
  // dia em que ele nem aparece (D9).
  const desenhados = [
    ...DIAS.flatMap(d => linhas.flatMap(l => blocosDe(l.servidor.id, d.n))),
    ...subLinhas.flatMap(s => linhas.flatMap(l => blocosDeEscala(l.servidor.id, s.dia, s.escala, s.variante))),
  ];
  const regua = janelaDaGrade(janela, desenhados);
```

E na chamada de `gradeHtml`, trocar `janela` por `regua`:

```js
    + gradeHtml(DIAS, { linhas, blocosDe, mostrarCobertura, janela: regua, subLinhas, blocosDeEscala })
```

**Não** trocar na linha do `form-hint` acima ("Cobertura da escola: …"): ali o texto anuncia a **janela configurada**, que continua sendo a regra.

- [ ] **Step 5: Verificar no browser (dev-local)**

Aplicar o patch temporário de dev-local (`src/core/config.js` → `supabaseAnonKey: ''`; `src/core/perfil.js` → ramo `!hasSupabase()` devolvendo `{ email:'dev@local', papel:'admin_sme', isAdmin:true }` e chamando `definirMapa(new Proxy({}, { get: () => 'escrita' }))`).

```bash
python .claude/devserver.py 8123
```

Abrir `http://localhost:8123/?v=1#/horarios`, escolher uma escola, e conferir:
1. a grade abre sem erro no console;
2. um dia com duas variantes mostra duas sub-linhas, cada uma com a própria tira;
3. um bloco que termina depois do fim da janela aparece **inteiro**.

**Reverter o patch de dev-local antes de commitar** e conferir:

```bash
grep -rn "dev@local\|__fixture" src/ index.html
```
Expected: só `docs.content.js` (que documenta o procedimento).

- [ ] **Step 6: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/views/por-escola.js
git diff --cached
git commit -m "feat(horarios): a aba Por escola monta as variantes e a regua

Sub-linha de duas origens - outra escala (o TDC) e outra variante da
escala visivel (o revezamento da quarta sem TDC) -, com o rotulo saindo
de quem conduz e caindo no numero quando ninguem conduz.

A regua e calculada sobre os blocos ja resolvidos pelo fallback, nunca
sobre o retorno cru de getBlocos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: A gaveta de jornada ganha o eixo de variante

**Files:**
- Modify: `src/modules/horarios/views/jornada.js`
- Modify: `src/modules/horarios/horarios.css`

**Interfaces:**
- Consumes: `variantesDe`, `conduzDaVariante`, `varDe` (Tasks 1-2); `criarBloco`/`atualizarBloco` com `variante`/`conduz` (Task 4).
- Produces: `abrirJornada({ …, varianteInicial = 1 })` - `por-escola.js` e `por-servidor.js` continuam funcionando sem passar o novo campo.

- [ ] **Step 1: Estado com três níveis**

Em `src/modules/horarios/views/jornada.js`, trocar o import de `escalas.model.js`:

```js
import { rotulaEscala, variantesDe, varDe } from '../escalas.model.js';
```

Atualizar o comentário do estado e a montagem em `abrirJornada`. Substituir o bloco que hoje monta `porEscala` por:

```js
// estado.porEscala = { [escala]: { [variante]: { [dia_semana]: linhas[] } } }
// A semana inteira de TODAS as escalas e variantes, carregada de uma vez.
// estado.escala/estado.variante são só QUAL ABA está visível: trocar de
// aba nunca descarta o que foi digitado nas outras - ver salvar().
  const chaves = [...new Set([...escalasEmUso, ...blocos.map(b => b.escala || 'normal')])];
  const meus = blocos.filter(b => b.servidor_id === servidor.id);
  const porEscala = {};
  for (const chaveEsc of chaves) {
    porEscala[chaveEsc] = {};
    // As variantes desta escala em QUALQUER dia, na unidade inteira: uma
    // variante criada por outro gestor precisa aparecer aqui, senão a
    // configuração fica pela metade e a cobertura dela nunca fecha.
    const vs = [...new Set(DIAS.flatMap(d => variantesDe(blocos, chaveEsc, d.n)))].sort((a, b) => a - b);
    for (const v of vs) {
      porEscala[chaveEsc][v] = {};
      for (const d of DIAS) {
        porEscala[chaveEsc][v][d.n] = meus
          .filter(b => b.dia_semana === d.n && (b.escala || 'normal') === chaveEsc && varDe(b) === v)
          .map(b => ({ id: b.id, inicio: hhmm(b.inicio), fim: hhmm(b.fim), obs: b.obs || '', conduz: Boolean(b.conduz) }));
      }
    }
  }
```

E o `estado`:

```js
  estado = {
    servidor, unidadeId,
    escala: chaves.includes(escalaInicial) ? escalaInicial : 'normal',
    variante: 1,
    porEscala, recarregar, escalasEmUso: chaves, catalogoEscalas, diasFixos,
  };
```

- [ ] **Step 2: A segunda barra de abas**

Substituir a `const abas` e o `abrirDrawer` por:

```js
  const abas = chaves.length > 1 ? `
    <div class="tabbar hj-escalas" role="tablist">
      ${chaves.map(e => `<button type="button" class="tab ${e === estado.escala ? 'on' : ''}"
        role="tab" aria-selected="${e === estado.escala}" data-escala="${esc(e)}">${esc(rotulaEscala(e, catalogoEscalas))}</button>`).join('')}
    </div>
    <p class="form-hint" id="hj-dica"></p>` : '';

  abrirDrawer(`
    ${drawerHead('Jornada da semana', esc(servidor.nome))}
    <div class="drawer-body">
      <form id="hj-form" class="esc-form">
        ${abas}
        <div id="hj-variantes"></div>
        <div id="hj-dias"></div>
        <div class="form-foot">
          <span id="hj-msg" class="auth-msg"></span>
          <button type="submit" id="hj-save" class="btn-primary">Salvar jornada</button>
        </div>
      </form>
    </div>`);
```

E acrescentar a função que pinta essa barra, junto de `pintarDica()`:

```js
// A segunda barra de abas: as variantes da escala ativa. Só aparece
// quando há mais de uma OU quando dá para criar a segunda - numa escola
// sem revezamento a gaveta fica idêntica à de antes.
function pintarVariantes() {
  const box = document.getElementById('hj-variantes');
  if (!box) return;
  const vs = Object.keys(estado.porEscala[estado.escala]).map(Number).sort((a, b) => a - b);

  const conduzAqui = DIAS.some(d =>
    estado.porEscala[estado.escala][estado.variante][d.n].some(l => !l.excluir && l.conduz));

  box.innerHTML = `
    <div class="tabbar hj-variantes-bar" role="tablist">
      ${vs.map(v => `<button type="button" class="tab ${v === estado.variante ? 'on' : ''}"
        role="tab" aria-selected="${v === estado.variante}" data-variante="${v}">Variante ${v}</button>`).join('')}
      <button type="button" class="tab hj-var-nova" id="hj-var-nova"
        aria-label="Criar uma variante">${ico('adicionar', { tam: 13 })}</button>
    </div>
    <label class="switch hj-conduz">
      <input type="checkbox" id="hj-conduz" ${conduzAqui ? 'checked' : ''} />
      <span class="switch-trilho" aria-hidden="true"></span>
      <span class="switch-txt">conduzo o TDC nesta variante</span>
    </label>`;
}
```

**Por que a caixa "conduzo" é do próprio servidor:** a gaveta edita uma pessoa por vez e nunca escreve sobre dado de outra (D5). Cada gestor declara de si.

- [ ] **Step 3: Ligar a troca de variante, o "+" e a caixa**

Depois do listener de `.hj-escalas` em `abrirJornada`, acrescentar:

```js
  // Mesmo padrão das abas de escala: ligado uma vez, sobre o container
  // estável do form. Trocar de variante só troca `estado.variante`.
  document.getElementById('hj-variantes').addEventListener('click', (e) => {
    const nova = e.target.closest('#hj-var-nova');
    if (nova) {
      const vs = Object.keys(estado.porEscala[estado.escala]).map(Number);
      const proxima = Math.max(...vs) + 1;
      estado.porEscala[estado.escala][proxima] = Object.fromEntries(DIAS.map(d => [d.n, []]));
      estado.variante = proxima;
      pintarVariantes(); pintar();
      return;
    }
    const b = e.target.closest('[data-variante]'); if (!b) return;
    estado.variante = Number(b.dataset.variante);
    pintarVariantes(); pintar();
  });

  document.getElementById('hj-variantes').addEventListener('change', (e) => {
    if (e.target.id !== 'hj-conduz') return;
    // Marca as linhas DESTE servidor nesta escala e variante. É o que a
    // grade lê para rotular a sub-linha com o nome de quem conduz.
    const marcado = e.target.checked;
    for (const d of DIAS) {
      for (const l of estado.porEscala[estado.escala][estado.variante][d.n]) l.conduz = marcado;
    }
  });
```

E acrescentar `pintarVariantes();` logo antes do `pintar();` inicial, e dentro do handler de troca de escala (junto de `pintarDica()`), com o cuidado de reencaixar a variante:

```js
    estado.escala = b.dataset.escala;
    // A variante ativa pode não existir na escala nova.
    if (!estado.porEscala[estado.escala][estado.variante]) estado.variante = 1;
```

- [ ] **Step 4: Trocar `estado.porEscala[estado.escala][dia]` pelo caminho de três níveis**

São **seis** lugares em `jornada.js`. Substituir em todos `estado.porEscala[estado.escala][` por `estado.porEscala[estado.escala][estado.variante][`:

- `atualizarDia()` - `const linhas = …[dia]`
- `aoMudarCampo()` - `const alvo = …[dia].filter(…)`
- `pintar()` - `const linhas = …[d.n].filter(…)`
- `pintar()`, handler do `.hj-add` - `…[Number(b.dataset.dia)].push(…)`
- `pintar()`, handler do `.hj-del` - `const dias = …`
- `pintar()`, handler do `.hj-copiar` - `const dias = …`

Em `orfaos()`, trocar `const dias = estado.porEscala[estado.escala];` por `const dias = estado.porEscala[estado.escala][estado.variante];`.

Run: `grep -n "porEscala\[estado.escala\]\[" src/modules/horarios/views/jornada.js` para conferir que nenhum caminho de dois níveis sobrou.

- [ ] **Step 5: `salvar()` percorre as variantes e grava as duas colunas**

Em `salvar()`, os dois laços `for (const chaveEsc of Object.keys(estado.porEscala))` ganham um nível. No laço de **validação**:

```js
  for (const chaveEsc of Object.keys(estado.porEscala)) {
    for (const chaveVar of Object.keys(estado.porEscala[chaveEsc])) {
      for (const d of DIAS) {
        const linhas = estado.porEscala[chaveEsc][chaveVar][d.n].filter(l => !l.excluir);
        const nomeEsc = rotulaEscala(chaveEsc, estado.catalogoEscalas);
        const temVar = Object.keys(estado.porEscala[chaveEsc]).length > 1;
        const prefixo = estado.escalasEmUso.length > 1 || temVar
          ? `${nomeEsc}${temVar ? ` (variante ${chaveVar})` : ''} - ${d.nome}`
          : d.nome;
        for (const l of linhas) {
          if (!l.inicio || !l.fim) return falha(msg, `${prefixo}: informe início e fim de todos os blocos.`);
          if (l.fim <= l.inicio) return falha(msg, `${prefixo}: o fim precisa ser depois do início.`);
        }
        const erro = validarDia(linhas).find(p => p.nivel === 'erro');
        if (erro) return falha(msg, `${prefixo}: ${erro.texto}`);
      }
    }
  }
```

No laço de **gravação**:

```js
    for (const chaveEsc of Object.keys(estado.porEscala)) {
      for (const chaveVar of Object.keys(estado.porEscala[chaveEsc])) {
        for (const d of DIAS) {
          for (const l of [...estado.porEscala[chaveEsc][chaveVar][d.n]]) {
            const payload = {
              servidor_id: estado.servidor.id,
              unidade_id: estado.unidadeId,
              dia_semana: d.n,
              inicio: l.inicio,
              fim: l.fim,
              obs: l.obs.trim() || null,
              escala: chaveEsc,
              variante: Number(chaveVar),
              conduz: Boolean(l.conduz),
            };
            if (l.excluir && l.id) {
              await excluirBloco(l.id);
              estado.porEscala[chaveEsc][chaveVar][d.n] =
                estado.porEscala[chaveEsc][chaveVar][d.n].filter(x => x !== l);
            } else if (l.id) {
              await atualizarBloco(l.id, payload);
            } else if (!l.excluir) {
              const novo = await criarBloco(payload);
              l.id = novo.id;
            }
          }
        }
      }
    }
```

Manter os comentários existentes sobre gravação sequencial e atualização do estado em memória - a razão deles não mudou.

Novas linhas criadas pelo `.hj-add` não têm `conduz`; `Boolean(undefined)` é `false`, e a caixa do Step 3 marca todas as linhas do dia quando ligada.

- [ ] **Step 6: CSS da segunda barra**

Em `src/modules/horarios/horarios.css`, acrescentar junto das regras de `.hj-*`:

```css
/* Segunda barra de abas da gaveta: as variantes da escala ativa. Mesmo
   vocabulário de .tabbar/.tab; só um pouco menor, porque é o eixo
   secundário - a escala é que manda. */
.hj-variantes-bar { margin-top: -4px; }
.hj-variantes-bar .tab { font-size: 12.5px; padding-top: 6px; padding-bottom: 6px; }
.hj-variantes-bar .hj-var-nova { display: inline-flex; align-items: center; }
/* O toggle é uma linha própria dentro do formulário: alinha à esquerda
   e larga a altura de campo (mesma correção de .form-grupo .campos
   label.switch - ver .claude/rules/ui.md R17). */
.hj-conduz { align-self: start; min-height: var(--campo); margin-bottom: 6px; }
```

- [ ] **Step 7: Verificar no browser (dev-local)**

Aplicar o patch de dev-local. Abrir `#/horarios`, escolher escola, clicar no lápis de um gestor e conferir:
1. sem variantes, a gaveta abre igual à de antes (só a barra de variantes com "Variante 1" e o "+");
2. o "+" cria a Variante 2 vazia e a aba fica ativa;
3. digitar horários na Variante 2, voltar para a 1 e conferir que o que foi digitado **não** se perdeu;
4. marcar "conduzo o TDC nesta variante" e salvar; reabrir e conferir que voltou marcado;
5. o console sem erro.

Reverter o patch e conferir com `grep -rn "dev@local\|__fixture" src/ index.html`.

- [ ] **Step 8: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/views/jornada.js src/modules/horarios/horarios.css
git diff --cached
git commit -m "feat(horarios): eixo de variante na gaveta de jornada

porEscala ganha um nivel: escala > variante > dia. Segunda barra de
abas, so quando ha o que escolher, e uma caixa 'conduzo o TDC nesta
variante' - que marca as linhas DESTE servidor. A gaveta edita uma
pessoa por vez e continua nunca escrevendo sobre dado de outra.

salvar() percorre todas as escalas E variantes: trocar de aba nao pode
descartar em silencio o que foi digitado nas outras.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: "Por servidor" mostra as variantes

**Files:**
- Modify: `src/modules/horarios/views/por-servidor.js`

**Interfaces:**
- Consumes: `variantesDe`, `escolherBlocos` (Tasks 1-2).
- Produces: `linhaDia(s, d, doDia, { podeEditar, unidadeId, rotuloVariante })` - o quarto campo é novo e tem default `''`.

- [ ] **Step 1: Import**

```js
import { escolherBlocos, rotulaEscala, variantesDe } from '../escalas.model.js';
```

- [ ] **Step 2: Uma linha por variante em cada dia**

Em `painelLocal()`, substituir a montagem de `semana` e `totalSemana` por:

```js
  // Qual variante vale numa data concreta ninguém sabe - a tela mostra
  // todas e não finge saber (D8). Numa escola sem revezamento há uma
  // variante só e o resultado é idêntico ao de antes: `rotuloVariante`
  // vem vazio e `linhaDia` não desenha rótulo nenhum.
  const semana = DIAS.flatMap(d => {
    const vs = variantesDe(doLocal, escalaVista, d.n);
    return vs.map(v => linhaDia(s, d,
      escolherBlocos(doLocal.filter(b => b.dia_semana === d.n), escalaVista, v),
      { podeEditar: ctxAtual.podeEditar, unidadeId: local.id,
        rotuloVariante: vs.length > 1 ? `Variante ${v}` : '' }));
  }).join('');

  // Soma só a variante 1: variantes são dias ALTERNATIVOS, e somá-las
  // inventaria carga semanal que ninguém cumpre.
  const totalSemana = DIAS.reduce((acc, d) =>
    acc + totalDoDia(escolherBlocos(doLocal.filter(b => b.dia_semana === d.n), escalaVista, 1)), 0);
```

E em `linhaDia`, aceitar e desenhar o rótulo. Trocar a assinatura e o `return`:

```js
function linhaDia(s, d, doDia, { podeEditar, unidadeId: uni, rotuloVariante = '' }) {
```

```js
  return `<div class="hb-linha ${problemas.some(p => p.nivel === 'erro') ? 'tem-erro' : ''}">
    <div class="hb-dia">${d.curto}${
      rotuloVariante ? `<small class="hb-variante">${esc(rotuloVariante)}</small>` : ''}</div>
    <div class="hb-track">${eixoHb()}${barras || `<span class="hb-vazio">sem jornada</span>`}</div>
    <div class="hb-info">
      ${total ? `<b>${duracao(total)}</b>` : vazio('sem jornada')}
      ${addBtn}
    </div>
    ${alertas ? `<div class="hb-alertas">${alertas}</div>` : ''}
  </div>`;
```

O botão `+` (`data-add="<servidor>:<dia>:<unidade>"`) fica repetido entre as variantes do mesmo dia, e é assim mesmo: ele abre a gaveta, onde a escolha da variante é explícita.

- [ ] **Step 2b: CSS do rótulo**

Em `src/modules/horarios/horarios.css`, junto das regras `.hb-dia`:

```css
/* Numa escola que reveza, o mesmo dia aparece uma vez por variante -
   o rótulo abaixo da sigla do dia é o que distingue as duas linhas. */
.hb-variante { display: block; font-size: 9.5px; font-weight: 400; color: var(--muted); line-height: 1.2; }
```

- [ ] **Step 3: Verificar no browser (dev-local)**

Abrir `#/horarios`, aba "Por servidor", escolher um gestor e conferir:
1. numa escola sem revezamento, a tela está idêntica à de antes;
2. num servidor com duas variantes, as duas aparecem rotuladas;
3. o total da semana **não** dobrou.

Reverter o patch de dev-local.

- [ ] **Step 4: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
git add src/modules/horarios/views/por-servidor.js
git commit -m "feat(horarios): Por servidor lista as variantes do gestor

Qual delas vale numa data ninguem sabe, e a tela nao finge saber: mostra
as duas. O total da semana soma so a variante 1 - variantes sao dias
alternativos, somar inventaria carga que ninguem cumpre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Tutorial, changelog e versão

**Files:**
- Modify: `docs/modulos/horarios.md`
- Modify: `CHANGELOG.md`
- Modify: `src/core/config.js`

**Interfaces:**
- Consumes: tudo.
- Produces: a entrega fechada.

- [ ] **Step 1: Atualizar o tutorial**

`horarios` tem `doc: true`, então o tutorial é atualizado **no mesmo commit** que muda o fluxo (`.claude/rules/documentacao.md`). Escrito para **quem usa**: nenhum nome de arquivo, tabela ou coluna; nenhum dado real (usar "Escola Exemplo", "Gestor 1").

Acrescentar em "O que dá para fazer aqui": registrar mais de uma configuração do mesmo dia.

Acrescentar uma tarefa em "Passo a passo":

```markdown
### Registrar o revezamento de um dia de TDC

Em dia de TDC a escola tem dois horários: o de quem conduz o encontro e
o de quem cobre a escola. Como o rodízio muda a cada mês, o sistema
guarda as duas configurações em vez de uma.

1. Abra **Horários** e escolha a escola.
2. Clique no lápis do primeiro gestor.
3. Escolha a aba da escala (por exemplo, **TDC Presencial**).
4. Na barra **Variante 1**, preencha o horário que ele cumpre quando
   **ele** conduz o TDC, e marque **conduzo o TDC nesta variante**.
5. Clique em **+** para criar a **Variante 2** e preencha o horário que
   ele cumpre quando é **o outro** que conduz. Deixe a caixa desmarcada.
6. Clique em **Salvar jornada**.
7. Repita com o segundo gestor, invertendo: na Variante 1 o horário de
   cobertura, na Variante 2 o horário de quem conduz (com a caixa
   marcada).

Na grade da escola aquele dia passa a mostrar as duas configurações,
uma embaixo da outra, cada uma com a própria faixa de cobertura.
```

Acrescentar em "Regras que o sistema aplica":

```markdown
- A escola precisa estar coberta **em todas as variantes**, porque
  qualquer uma delas pode ser a do próximo TDC. Uma variante com
  buraco é sinalizada sozinha, sem afetar a outra. É **aviso**: dá para
  salvar e corrigir depois.
- Quem não tem horário próprio numa variante segue o da Variante 1
  daquela escala; sem horário nenhum na escala, segue a jornada normal.
  Só preencha o que muda.
- **Supervisor(a)** não faz parte da equipe gestora e não aparece mais
  na grade nem no cálculo de cobertura das escolas.
```

Atualizar o carimbo final para `> Atualizado na versão 0.21.0.`

- [ ] **Step 2: Subir a versão**

Em `src/core/config.js`, `CONFIG.versao` passa de `0.20.1` para **`0.21.0`** (MINOR - mudança de modelo).

- [ ] **Step 3: Registrar no CHANGELOG**

No topo de `CHANGELOG.md`, escrito para **quem usa** (sem jargão, sem nome de arquivo):

```markdown
## 0.21.0 - 06/09/2026

### Horários de trabalho

- **Dia de TDC agora aceita as duas configurações.** Quando os gestores
  se revezam na condução do TDC, dá para registrar o horário de cada
  situação em vez de escolher uma e torcer. A grade da escola mostra as
  duas, uma embaixo da outra.
- **Cada configuração tem a própria faixa de cobertura.** Se numa delas
  a escola fica descoberta em algum horário, o aviso aparece só nela.
- **O mesmo vale para dias sem TDC**: uma quarta-feira em que os
  gestores alternam manhã e tarde a cada semana também pode ter as duas.
- **Horário que passa do fim do expediente não é mais cortado na tela.**
  Antes, quem ficava até 20h numa escola que fecha 18h20 tinha o horário
  recortado sem aviso.
- **Supervisor(a) saiu da equipe gestora.** É cargo da Secretaria, não
  compõe a gestão da escola, e não entra mais na grade nem na cobertura.
```

- [ ] **Step 4: Rodar tudo**

```bash
python .claude/scripts/verificar_arquitetura.py
node --test tests/*.test.mjs
```
Expected: 0 bloqueantes; todos os testes verdes.

- [ ] **Step 5: Testar em tela estreita**

Com o patch de dev-local, abrir `#/horarios` e conferir a 375px de largura:
1. a grade rola horizontalmente dentro do próprio container, sem estourar a página;
2. a segunda barra de abas da gaveta não quebra o layout;
3. os alvos de toque continuam confortáveis.

Reverter o patch.

- [ ] **Step 6: Commit final**

```bash
git add docs/modulos/horarios.md CHANGELOG.md src/core/config.js
git diff --cached
git commit -m "docs(horarios): tutorial das variantes, changelog e v0.21.0

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Avisar sobre a migration**

A entrega **não funciona por completo** até a `030_variantes_jornada.sql` ser rodada no SQL Editor do painel. Antes dela o módulo degrada para uma variante só (Task 4). Informar o André, junto do lembrete de que a 026, 027 e 028 seguem pendentes conforme as rodadas anteriores.

---

## Ordem e dependências

```
Task 1 (migration + fallback)
  └─ Task 2 (variantesDe / conduzDaVariante)
       ├─ Task 6 (por-escola)
       ├─ Task 7 (jornada)
       └─ Task 8 (por-servidor)
Task 3 (régua) ────────────────┘  (Task 6 usa janelaDaGrade)
Task 4 (gravação) ─────────────┘  (Task 7 usa criarBloco com variante)
Task 5 (grade.js) ─────────────┘  (Task 6 passa subLinhas de 4 campos)
Task 9 (docs) - por último, depois de tudo verificado
```

Tasks 3, 4 e 5 são independentes entre si e podem ir em qualquer ordem depois da Task 2 (a Task 5 só depende da Task 3 por causa do `posicaoNaBarra` sem `forade`, que não muda a assinatura usada).
