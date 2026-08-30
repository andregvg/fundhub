# Horários B-2: Escalas e Hoje - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o sistema responder "que horário este gestor cumpre nesta data", inclusive em dia de TDC com revezamento, sem inferir nada: o calendário nomeia o dia, a jornada é escrita contra o nome, e resolver vira consulta.

**Architecture:** As colunas de escala já existem (migration 024, plano B-1). Este plano acrescenta a resolução no model, a marcação no Calendário com um gerador de proposta, as abas de escala na gaveta de jornada e o cartão Hoje na Dashboard. Toda a resolução e toda a geração de datas são funções puras, cobertas por teste.

**Tech Stack:** JavaScript ES modules puro, sem build. Postgres via PostgREST. Testes `.mjs` com `node:test` e `node:assert/strict`.

**Spec:** [`docs/superpowers/specs/2026-08-27-horarios-escalas-grade-design.md`](../specs/2026-08-27-horarios-escalas-grade-design.md)

**Depende de:** os planos `2026-08-27-sistema-visual.md` e `2026-08-27-horarios-b1-grade-e-edicao.md`, ambos concluídos e validados em produção. A migration 024 já foi rodada.

## Global Constraints

- **PT-BR** em código, comentário, commit e interface.
- **Branch `dev`.**
- **Sem npm, sem bundler, sem dependência nova.**
- **Nenhuma cor literal em `src/modules/**`.**
- **Todo valor vindo do banco passa por `esc()`.**
- **Model nunca toca no DOM. View nunca chama `sb()`.**
- **Datas.** Data civil é `string` `yyyy-mm-dd` e **nunca** vira `Date` para ser formatada. `toISOString()` **nunca** produz data civil (volta um dia à noite no Brasil) - para "hoje", `hojeISO()`. Ao construir `Date` a partir de data civil, sempre `+ 'T00:00:00'`. Toda formatação fica em `shared/format.js`; módulo não chama `toISOString`, `toLocaleDateString` nem `toLocaleString`. Aritmética de calendário (`new Date(ano, mes - 1, 1)`) é legítima; **formatar ou serializar** fora de `format.js` não é.
- **Vocabulário de escalas:** `'normal'` é fixo no código (fallback). As escalas de
  TDC nascem semeadas como `'tdc-presencial'` / `'tdc-virtual'` - é o padrão de 5
  dos 6 ofícios reais lidos para este projeto - mas o CATÁLOGO é editável pelo
  admin (tabela `escala_tipo`, migration 025): rótulo e ordem mudam pela tela,
  chave nova nasce por lá também. **A chave em si nunca é editável** depois de
  criada - é o que fica gravado em `horario_bloco.escala`, sem FK, sem cascata.
- **Fora de escopo, por decisão do André (30/08/2026):** revezamento semanal
  entre gestores independente de TDC (visto num dos seis ofícios). Não é "que dia
  é hoje" - é "de quem é a vez esta semana", eixo que `escala` não representa.
  Não modelar; se voltar, é modelo novo.
- **Fallback obrigatório:** servidor sem bloco na escala do dia usa os blocos `normal`. É isso que faz os ~140 gestores sem jornada alternativa não sentirem nada.
- **A proposta do gerador nunca grava direto.** É sempre uma tabela que o admin edita e da qual pode descartar linhas.
- **Degradar sem a migration:** `42P01` e `42703` viram estado vazio com aviso.
- **Testes:** `node --test` (sem argumento) roda tudo - o Node varre a partir do diretorio corrente. **Nao** use `node --test tests/`: nesta maquina (Node 24, Windows) o Node trata o caminho como modulo e falha com `MODULE_NOT_FOUND`. Rodar um arquivo so continua valendo: `node --test tests/horarios.test.mjs`.
- **Antes de cada commit:** `node --test`, `python .claude/scripts/verificar_arquitetura.py`, `git diff --cached` lido.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/modules/horarios/horarios.model.js` | Resolução de escala e de jornada numa data. |
| `src/modules/calendario/calendario.model.js` | Escala da rede, override por unidade, geração da proposta de TDC. |
| `src/modules/calendario/views/escalas.js` | **novo.** Seletor rede/escola e a tabela de proposta. Extraído para `calendario.view.js` não passar de 400 linhas. |
| `src/modules/calendario/calendario.view.js` | Ganha a aba/ação de escalas. |
| `src/modules/horarios/views/jornada.js` | Ganha as abas Normal / TDC A / TDC B. |
| `src/modules/horarios/views/por-escola.js` | Seletor de escala para ver a grade de cada uma. |
| `src/modules/dashboard/views/hoje.js` | **novo.** O cartão Hoje. |
| `src/modules/dashboard/dashboard.view.js` | Monta o cartão. |
| `tests/escalas.test.mjs` | **novo.** Resolução, fallback e geração da proposta. |

---

## Task 1: Resolução de escala e de jornada

**Files:**
- Create: `supabase/migrations/025_escala_tipo.sql`
- Modify: `supabase/migrations/019_auditoria_completa.sql` (array de tabelas auditadas)
- Modify: `src/modules/horarios/horarios.model.js`
- Create: `tests/escalas.test.mjs`

**Interfaces:**
- Consumes: `sb()`, `hasSupabase()`, `DIAS`, `registrarCache` (`shared/cache.js` - já existe desde o plano do sistema visual).
- Produces:
  - `ESCALAS_PADRAO: Array<{ chave: string, rotulo: string }>` - `[{chave:'normal',rotulo:'Normal'}, {chave:'tdc-presencial',rotulo:'TDC Presencial'}, {chave:'tdc-virtual',rotulo:'TDC Virtual'}]` - o *fallback* sem banco, não a fonte de verdade;
  - `rotulaEscala(chave: string, catalogo: Array<{chave,rotulo}> = ESCALAS_PADRAO) => string` - **pura**, recebe o catálogo já carregado; sem catálogo, usa o padrão;
  - `getEscalas() => Promise<Array<{ chave, rotulo, ordem }>>` - lê `escala_tipo`; sem a migration 025 (`42P01`) ou sem banco, devolve `ESCALAS_PADRAO`;
  - `definirEscalaTipo(chave: string, { rotulo, ordem? }) => Promise<void>` - upsert; cria chave nova ou renomeia rótulo de uma existente. Chave não muda depois de criada;
  - `limparCacheEscalas() => void`;
  - `resolverEscala({ rede, override }) => string` - puro. `rede` é `string | null` (de `dia_calendario.escala`); `override` é `undefined` (sem linha) ou `{ escala: string | null }`;
  - `escolherBlocos(blocos, escala) => blocos[]` - puro, com o fallback para `normal`;
  - `diaDaSemana(iso: string) => number` - 0=domingo … 6=sábado, sem fuso;
  - `getEscalaDoDia(unidadeId, dataISO) => Promise<string>` - assíncrono, consulta as duas fontes;
  - `jornadaEm(blocos, { escala, dataISO }) => blocos[]` - os blocos daquele dia da semana naquela escala, já com fallback.

- [ ] **Step 1: Migration 025 - catálogo de tipos de escala**

```sql
-- ============================================================
-- 025 - Catálogo de tipos de escala
-- Rode no SQL Editor, depois da 024.
--
-- As TRÊS colunas de escala (dia_calendario.escala, escala_unidade.escala,
-- horario_bloco.escala) continuam `text` livre - não mudou nada nelas.
-- Esta migration acrescenta só o RÓTULO exibido para cada chave: o
-- formato de TDC muda a cada calendário escolar, e travar "TDC
-- Presencial"/"TDC Virtual" no código obrigaria a um deploy toda vez
-- que a Secretaria decidisse chamar a coisa de outro jeito.
--
-- 'normal' nasce semeado e é a única chave que o CÓDIGO depende do
-- valor literal (escolherBlocos/resolverEscala usam a string
-- 'normal' como fallback) - por isso a tela de admin não oferece
-- excluí-la. O rótulo dela, como o de qualquer outra, pode mudar.
-- ============================================================

create table if not exists escala_tipo (
  chave      text primary key,
  rotulo     text not null,
  ordem      int  not null default 0,
  criado_por text,
  criado_em  timestamptz not null default now()
);

insert into escala_tipo (chave, rotulo, ordem) values
  ('normal',         'Normal',         0),
  ('tdc-presencial',  'TDC Presencial', 1),
  ('tdc-virtual',     'TDC Virtual',    2)
on conflict (chave) do nothing;

alter table escala_tipo enable row level security;
alter table escala_tipo force row level security;

drop policy if exists escala_tipo_sel on escala_tipo;
drop policy if exists escala_tipo_wr  on escala_tipo;
create policy escala_tipo_sel on escala_tipo for select using (is_autorizado());
create policy escala_tipo_wr  on escala_tipo for all
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on escala_tipo to authenticated;

drop trigger if exists trg_audit on escala_tipo;
create trigger trg_audit after insert or update or delete on escala_tipo
  for each row execute function fn_audit();

select registrar_migration('025', 'Catalogo de tipos de escala (rotulos editaveis)');
```

Acrescentar `'escala_tipo'` ao array de tabelas auditadas em
`supabase/migrations/019_auditoria_completa.sql`, no mesmo padrão que a 024 já
usou para `escala_unidade`, `cargo_gestao` e `horario_exibicao` - mesma razão:
se a 019 for reexecutada antes da 025, `to_regclass` pula a tabela ausente em
silêncio; depois da 025, os dois convergem para o mesmo `trg_audit`.

Releia comando a comando perguntando "rodar duas vezes dá erro?" - o mesmo
exercício que a Task 1 do B-1 fez para a 024. **Você não tem acesso ao banco.**
Não execute; é passo manual do André, documentado na seção final do relatório.

- [ ] **Step 2: Escrever os testes que falham**

Criar `tests/escalas.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverEscala, escolherBlocos, diaDaSemana, jornadaEm, rotulaEscala }
  from '../src/modules/horarios/horarios.model.js';

// ── resolverEscala ──
test('sem nada, o dia e normal', () => {
  assert.equal(resolverEscala({ rede: null, override: undefined }), 'normal');
});

test('a rede define quando a escola nao remarcou', () => {
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: undefined }), 'tdc-presencial');
});

test('a escola remarcando vence a rede', () => {
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: { escala: 'tdc-virtual' } }), 'tdc-virtual');
});

test('a escola CANCELANDO vence a rede: linha com escala nula e normal', () => {
  // Distinguir "sem linha" (segue a rede) de "linha com null" (a escola
  // decidiu que aqui nao tem TDC) e o motivo de escala_unidade existir.
  assert.equal(resolverEscala({ rede: 'tdc-presencial', override: { escala: null } }), 'normal');
});

test('a escola pode marcar TDC num dia em que a rede nao tem', () => {
  assert.equal(resolverEscala({ rede: null, override: { escala: 'tdc-presencial' } }), 'tdc-presencial');
});

// ── escolherBlocos ──
const B = (escala, inicio) => ({ escala, inicio, fim: '12:00', dia_semana: 3 });

test('blocos da escala pedida sao usados quando existem', () => {
  const blocos = [B('normal', '07:00'), B('tdc-presencial', '08:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-presencial').map(b => b.inicio), ['08:00']);
});

test('sem bloco na escala, cai no normal - o fallback que poupa 140 gestores', () => {
  const blocos = [B('normal', '07:00')];
  assert.deepEqual(escolherBlocos(blocos, 'tdc-virtual').map(b => b.inicio), ['07:00']);
});

test('escala normal nunca cai em outra coisa', () => {
  const blocos = [B('tdc-presencial', '08:00')];
  assert.deepEqual(escolherBlocos(blocos, 'normal'), []);
});

test('lista vazia devolve lista vazia', () => {
  assert.deepEqual(escolherBlocos([], 'tdc-presencial'), []);
  assert.deepEqual(escolherBlocos(undefined, 'normal'), []);
});

// ── diaDaSemana ──
test('le o dia da semana sem passar pelo fuso', () => {
  // 2026-08-26 e uma quarta-feira.
  assert.equal(diaDaSemana('2026-08-26'), 3);
  assert.equal(diaDaSemana('2026-08-24'), 1);   // segunda
  assert.equal(diaDaSemana('2026-08-30'), 0);   // domingo
});

test('a data civil nao volta um dia - o bug classico do toISOString', () => {
  // Se a implementacao usasse new Date('2026-01-01') sem T00:00:00,
  // no fuso do Brasil isso viraria 31/12 e o dia da semana mudaria.
  assert.equal(diaDaSemana('2026-01-01'), 4);   // quinta
});

// ── jornadaEm ──
test('jornadaEm filtra por dia da semana e por escala, com fallback', () => {
  const blocos = [
    { escala: 'normal', dia_semana: 3, inicio: '07:00', fim: '13:00' },
    { escala: 'normal', dia_semana: 1, inicio: '08:00', fim: '14:00' },
    { escala: 'tdc-presencial', dia_semana: 3, inicio: '09:00', fim: '15:00' },
  ];
  // Quarta em TDC presencial: usa o bloco de tdc-presencial.
  assert.deepEqual(jornadaEm(blocos, { escala: 'tdc-presencial', dataISO: '2026-08-26' })
    .map(b => b.inicio), ['09:00']);
  // Quarta em TDC virtual: nao ha bloco tdc-virtual, cai no normal daquela quarta.
  assert.deepEqual(jornadaEm(blocos, { escala: 'tdc-virtual', dataISO: '2026-08-26' })
    .map(b => b.inicio), ['07:00']);
  // Segunda: nao e afetada pela escala.
  assert.deepEqual(jornadaEm(blocos, { escala: 'normal', dataISO: '2026-08-24' })
    .map(b => b.inicio), ['08:00']);
});

test('fim de semana nao tem jornada', () => {
  const blocos = [{ escala: 'normal', dia_semana: 3, inicio: '07:00', fim: '13:00' }];
  assert.deepEqual(jornadaEm(blocos, { escala: 'normal', dataISO: '2026-08-30' }), []);
});

// ── rótulos ──
test('as escalas tem rotulo legivel, pelo catalogo padrao', () => {
  assert.equal(rotulaEscala('normal'), 'Normal');
  assert.equal(rotulaEscala('tdc-presencial'), 'TDC Presencial');
  assert.equal(rotulaEscala('tdc-virtual'), 'TDC Virtual');
  assert.equal(rotulaEscala('inventada'), 'inventada');
});

test('rotulaEscala e pura: aceita um catalogo carregado do banco', () => {
  // O admin renomeou "TDC Presencial" para outro nome este ano - a
  // funcao nao pode depender do array fixo para refletir isso.
  const catalogo = [{ chave: 'tdc-presencial', rotulo: 'Reuniao Geral' }];
  assert.equal(rotulaEscala('tdc-presencial', catalogo), 'Reuniao Geral');
  assert.equal(rotulaEscala('normal', catalogo), 'normal');   // fora do catalogo passado
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
node --test tests/escalas.test.mjs
```

Esperado: FAIL - `resolverEscala` não exportada.

- [ ] **Step 4: Implementar em `horarios.model.js`**

```js
// ── Escalas ──────────────────────────────────────────────────
// ESCALA é o nome de um dia. O horário não é escrito contra datas,
// é escrito contra nomes de dia - e o calendário diz, para cada data
// real, qual nome ela tem. Foi essa inversão que tornou o TDC com
// revezamento uma consulta em vez de uma inferência: "em que fase
// estamos?" não se calcula, se consulta.
// Fallback SEM banco (teste puro, tela que ainda nao carregou o
// catalogo). A fonte de verdade e getEscalas(), que le escala_tipo -
// o admin pode renomear o rotulo ou acrescentar uma chave nova sem
// tocar em codigo, porque o formato de TDC muda a cada calendario
// escolar.
export const ESCALAS_PADRAO = [
  { chave: 'normal', rotulo: 'Normal' },
  { chave: 'tdc-presencial', rotulo: 'TDC Presencial' },
  { chave: 'tdc-virtual',    rotulo: 'TDC Virtual' },
];

// PURA de proposito: recebe o catalogo ja carregado. Sem ele, usa o
// padrao - e por isso os testes deste arquivo nao precisam de banco
// nenhum para continuar valendo.
export function rotulaEscala(chave, catalogo = ESCALAS_PADRAO) {
  return catalogo.find(e => e.chave === chave)?.rotulo || String(chave ?? '');
}

let _escalas = null;
export function limparCacheEscalas() { _escalas = null; }
registrarCache(limparCacheEscalas);

// O catalogo de verdade. Degrada para ESCALAS_PADRAO sem a migration
// 025 (42P01) - a tela continua funcionando com os tres nomes de
// sempre, so nao deixa renomear ate a migration rodar.
export async function getEscalas() {
  if (_escalas) return _escalas;
  if (!hasSupabase()) { _escalas = ESCALAS_PADRAO; return _escalas; }
  const { data, error } = await sb().from('escala_tipo')
    .select('chave, rotulo, ordem').order('ordem');
  if (error) {
    if (error.code === '42P01') { _escalas = ESCALAS_PADRAO; return _escalas; }
    throw error;
  }
  _escalas = data?.length ? data : ESCALAS_PADRAO;
  return _escalas;
}

// Rotulo e ordem sao editaveis; a CHAVE, nao - e o que ja esta
// gravado em horario_bloco.escala/dia_calendario.escala, sem FK e
// sem cascata que renomeie isso. Criar uma chave nova (uma terceira
// variante de TDC, por exemplo) e so uma linha nova - upsert cobre
// os dois casos.
export async function definirEscalaTipo(chave, { rotulo, ordem } = {}) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (!rotulo?.trim()) throw new Error('Informe o rótulo.');
  const row = { chave, rotulo: rotulo.trim() };
  if (ordem !== undefined) row.ordem = ordem;
  const { error } = await sb().from('escala_tipo').upsert(row, { onConflict: 'chave' });
  if (error) throw error;
  _escalas = null;                          // escreveu, invalidou
}

// Três estados, e a diferença entre os dois últimos é o motivo de
// escala_unidade existir:
//   sem linha             → a escola segue o calendário da rede;
//   linha com escala      → a escola remarcou;
//   linha com escala nula → a escola CANCELOU (aqui não há TDC nesta data).
export function resolverEscala({ rede, override } = {}) {
  if (override !== undefined && override !== null) return override.escala || 'normal';
  return rede || 'normal';
}

// Blocos daquela escala. Sem nenhum, cai nos 'normal' - é o fallback
// que faz quem não tem jornada alternativa não precisar de registro
// nenhum. 'normal' nunca cai em outra coisa: seria circular.
export function escolherBlocos(blocos, escala) {
  const lista = blocos || [];
  const daEscala = lista.filter(b => (b.escala || 'normal') === escala);
  if (daEscala.length || escala === 'normal') return daEscala;
  return lista.filter(b => (b.escala || 'normal') === 'normal');
}

// 0=domingo … 6=sábado. O '+ T00:00:00' é obrigatório: sem ele o JS
// lê a string como UTC e no Brasil o dia volta um.
export function diaDaSemana(iso) {
  return new Date(String(iso) + 'T00:00:00').getDay();
}

// A jornada de uma data: o dia da semana filtra, a escala escolhe.
export function jornadaEm(blocos, { escala, dataISO }) {
  const dow = diaDaSemana(dataISO);
  if (dow < 1 || dow > 5) return [];              // fim de semana não tem jornada
  return escolherBlocos((blocos || []).filter(b => b.dia_semana === dow), escala);
}

// A escala de uma data para uma unidade: o override da escola vence o
// calendário da rede.
export async function getEscalaDoDia(unidadeId, dataISO) {
  if (!hasSupabase() || !dataISO) return 'normal';
  const [rede, over] = await Promise.all([
    sb().from('dia_calendario').select('escala').eq('data', dataISO).maybeSingle(),
    unidadeId
      ? sb().from('escala_unidade').select('escala')
          .eq('unidade_id', unidadeId).eq('data', dataISO).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // Coluna ou tabela ausente (migration 024 não rodada) = dia normal.
  if (rede.error && !['42P01', '42703'].includes(rede.error.code)) throw rede.error;
  if (over.error && !['42P01', '42703'].includes(over.error.code)) throw over.error;
  return resolverEscala({
    rede: rede.data?.escala ?? null,
    override: over.data ? { escala: over.data.escala } : undefined,
  });
}
```

`getBlocos` e `getBlocosDoServidor` passam a trazer a coluna: em `SEL`, `'*'` já cobre `escala`. Conferir que sim.

- [ ] **Step 5: Rodar e ver passar**

```bash
node --test tests/escalas.test.mjs
```

Esperado: PASS, 15 testes.

- [ ] **Step 6: Conferir o tamanho do model**

```bash
wc -l src/modules/horarios/horarios.model.js
```

Limite 250. Se passou, extrair as escalas para `src/modules/horarios/escalas.model.js` (segundo model público, como no B-1) e atualizar imports e testes.

- [ ] **Step 7: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): resolucao de escala e de jornada numa data"
```

---

## Task 2: Escalas no Calendário - leitura e escrita

**Files:**
- Modify: `src/modules/calendario/calendario.model.js`
- Modify: `tests/escalas.test.mjs`

**Interfaces:**
- Consumes: `sb()`, `hasSupabase()`, `agoraISO()`.
- Produces:
  - `getEscalasRede(de, ate) => Promise<Array<{ data, escala }>>`;
  - `getEscalasUnidade(unidadeId, de, ate) => Promise<Array<{ data, escala }>>`;
  - `definirEscalaRede(dataISO, escala|null) => Promise<void>`;
  - `definirEscalaUnidade(unidadeId, dataISO, escala|null) => Promise<void>`;
  - `limparEscalaUnidade(unidadeId, dataISO) => Promise<void>` - **apaga a linha**, devolvendo a data ao calendário da rede (diferente de gravar `null`, que cancela);
  - `gerarPropostaTDC(ano, { naoLetivos: Set<string>, chaves?: string[] }) => Array<{ data: string, escala: string }>` - puro. `chaves` default `['tdc-presencial', 'tdc-virtual']`, mas aceita qualquer lista não vazia vinda do catálogo real (`getEscalas()`, Task 1) - se um ano tiver 3 variantes de TDC em vez de 2, o gerador alterna entre as 3 sem mudar de código.

- [ ] **Step 1: Escrever os testes do gerador**

Acrescentar a `tests/escalas.test.mjs`:

```js
import { gerarPropostaTDC } from '../src/modules/calendario/calendario.model.js';

test('propoe as 1as e 3as quartas de cada mes', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  const agosto = p.filter(x => x.data.startsWith('2026-08'));
  // Agosto/2026: quartas em 05, 12, 19, 26. 1a = 05, 3a = 19.
  assert.deepEqual(agosto.map(x => x.data), ['2026-08-05', '2026-08-19']);
});

test('alterna as duas escalas padrao ao longo do ano, sem reiniciar a cada mes', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  assert.deepEqual(p.slice(0, 4).map(x => x.escala),
    ['tdc-presencial', 'tdc-virtual', 'tdc-presencial', 'tdc-virtual']);
});

test('a primeira do ano e sempre a primeira chave', () => {
  assert.equal(gerarPropostaTDC(2026, { naoLetivos: new Set() })[0].escala, 'tdc-presencial');
});

test('aceita um catalogo de chaves diferente, vindo do banco', () => {
  // Um ano com tres variantes de TDC em vez de duas - o gerador nao
  // pode ter 'tdc-presencial'/'tdc-virtual' chumbados.
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set(), chaves: ['x', 'y', 'z'] });
  assert.deepEqual(p.slice(0, 4).map(x => x.escala), ['x', 'y', 'z', 'x']);
});

test('dia nao letivo e pulado, e a alternancia segue na sequencia que sobrou', () => {
  // Pulando a 1a quarta de agosto, a 3a (19/08) assume a vez dela.
  const cheio = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  const vazado = gerarPropostaTDC(2026, { naoLetivos: new Set(['2026-08-05']) });
  assert.equal(vazado.some(x => x.data === '2026-08-05'), false);
  assert.equal(vazado.length, cheio.length - 1);
  const i = cheio.findIndex(x => x.data === '2026-08-05');
  assert.equal(vazado[i].data, '2026-08-19');
  assert.equal(vazado[i].escala, cheio[i].escala);
});

test('so devolve datas do ano pedido, e sempre em ordem', () => {
  const p = gerarPropostaTDC(2026, { naoLetivos: new Set() });
  assert.ok(p.every(x => x.data.startsWith('2026-')));
  const ordenado = [...p].sort((a, b) => a.data.localeCompare(b.data));
  assert.deepEqual(p, ordenado);
});

test('devolve 24 datas num ano sem nenhum nao letivo', () => {
  assert.equal(gerarPropostaTDC(2026, { naoLetivos: new Set() }).length, 24);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/escalas.test.mjs
```

Esperado: FAIL - `gerarPropostaTDC` não exportada.

- [ ] **Step 3: Implementar em `calendario.model.js`**

```js
// ISO de uma data civil, montado a partir dos componentes locais.
// NUNCA toISOString(): ele volta um dia à noite no fuso do Brasil.
const isoDe = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Proposta de TDC do ano: 1ª e 3ª quartas letivas de cada mês, com A e
// B alternando ao longo do ano inteiro (não reiniciando a cada mês).
//
// É PROPOSTA, nunca gravação direta. A alternância é um chute
// razoável, não um fato: feriado, recesso e decisão local mudam a
// sequência, e só uma pessoa sabe qual. O gerador poupa a digitação
// de duas dezenas de datas; a decisão continua sendo humana.
export function gerarPropostaTDC(ano, { naoLetivos = new Set(), chaves = ['tdc-presencial', 'tdc-virtual'] } = {}) {
  if (!chaves.length) return [];
  const datas = [];
  for (let mes = 0; mes < 12; mes++) {
    const quartas = [];
    const d = new Date(ano, mes, 1);
    while (d.getMonth() === mes) {
      if (d.getDay() === 3) quartas.push(isoDe(d));
      d.setDate(d.getDate() + 1);
    }
    for (const iso of [quartas[0], quartas[2]]) {
      if (iso && !naoLetivos.has(iso)) datas.push(iso);
    }
  }
  // A alternância corre sobre a sequência que SOBROU: se a 1ª quarta
  // caiu num não letivo, a 3ª assume a vez dela. É o comportamento
  // que a escola espera - o revezamento não "perde a vez". `chaves`
  // vem do catálogo real (getEscalas(), Task 1) quando quem chama
  // sabe dele - o padrão de 2 é só o fallback deste arquivo.
  return datas.map((data, i) => ({ data, escala: chaves[i % chaves.length] }));
}

// ── Escalas: leitura ─────────────────────────────────────────
export async function getEscalasRede(de, ate) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('dia_calendario')
    .select('data, escala').not('escala', 'is', null)
    .gte('data', de).lte('data', ate).order('data');
  if (error) {
    if (['42P01', '42703'].includes(error.code)) return [];
    throw error;
  }
  return data || [];
}

export async function getEscalasUnidade(unidadeId, de, ate) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('escala_unidade')
    .select('data, escala').eq('unidade_id', unidadeId)
    .gte('data', de).lte('data', ate).order('data');
  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

// ── Escalas: escrita ─────────────────────────────────────────
export async function definirEscalaRede(dataISO, escala) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('dia_calendario')
    .upsert({ data: dataISO, escala: escala || null, atualizado_em: agoraISO() },
            { onConflict: 'data' });
  if (error) throw error;
}

// Gravar `null` aqui NÃO é o mesmo que apagar a linha: a linha com
// escala nula diz "esta escola cancelou o TDC nesta data", e vence o
// calendário da rede. Para devolver a data à rede, use limparEscalaUnidade.
export async function definirEscalaUnidade(unidadeId, dataISO, escala) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('escala_unidade')
    .upsert({ unidade_id: unidadeId, data: dataISO, escala: escala || null },
            { onConflict: 'unidade_id,data' });
  if (error) throw error;
}

export async function limparEscalaUnidade(unidadeId, dataISO) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('escala_unidade')
    .delete().eq('unidade_id', unidadeId).eq('data', dataISO);
  if (error) throw error;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/escalas.test.mjs
```

Esperado: PASS, 21 testes.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(calendario): escalas da rede e da escola, com gerador de proposta de TDC"
```

---

## Task 3: A tela de escalas no Calendário

**Files:**
- Create: `src/modules/calendario/views/escalas.js`
- Modify: `src/modules/calendario/calendario.view.js`
- Modify: `src/modules/calendario/calendario.css`

**Interfaces:**
- Consumes: `gerarPropostaTDC`, `getEscalasRede`, `getEscalasUnidade`, `definirEscalaRede`, `definirEscalaUnidade`, `limparEscalaUnidade`, `getCalendarioMes`; `getEscalas`, `definirEscalaTipo`, `rotulaEscala` (Task 1); `getLocais`; `criarBuscaSelecao`; `confirmar`; `toast`; `ico`.
- Produces: `renderEscalas(box, ctx) => Promise<void>`.

- [ ] **Step 1: Aba de escalas em `calendario.view.js`**

O módulo ganha uma segunda superfície. Se `calendario.view.js` passar de 400 linhas, dividir em `views/` como manda a R11 - a aba nova já nasce em `views/escalas.js`.

```js
    <div class="tabbar" id="cal-abas" role="tablist">
      <button class="tab on" role="tab" aria-selected="true" data-aba="dias">
        ${ico('calendario')} Dias</button>
      <button class="tab" role="tab" aria-selected="false" data-aba="escalas">
        ${ico('horario')} Escalas (TDC)</button>
    </div>
```

- [ ] **Step 2: `views/escalas.js`**

```js
// ============================================================
// FundHub - calendario/views/escalas.js
// Quais datas são TDC e em que fase do revezamento. É esta tela que
// dá sentido às abas de escala do módulo Horários: a jornada é
// escrita contra o NOME do dia, e é aqui que o nome é dado.
//
// Duas visões:
//   Rede   - as datas oficiais, valendo para todas as escolas;
//   Escola - as remarcações daquela unidade sobrepondo a rede.
//
// A geração nunca grava direto: propõe uma tabela que o admin edita
// e da qual pode descartar linhas.
// ============================================================
import { gerarPropostaTDC, getEscalasRede, getEscalasUnidade, definirEscalaRede,
  definirEscalaUnidade, limparEscalaUnidade, getCalendarioMes } from '../calendario.model.js';
import { getEscalas, definirEscalaTipo, rotulaEscala } from '../../horarios/horarios.model.js';
import { getLocais } from '../../escolas/escolas.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, fmtExtenso, hojeISO } from '../../../shared/format.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';

const anoAtual = () => Number(hojeISO().slice(0, 4));

let unidadeId = '';     // '' = visão da rede
let ano = anoAtual();
let proposta = null;    // [{ data, escala }] enquanto está sendo editada
let ctxAtual = null;
let catalogo = [];      // getEscalas() - rótulos vêm daqui, nunca de ESCALAS_PADRAO direto

export async function renderEscalas(box, ctx) {
  ctxAtual = ctx;
  box.innerHTML = `
    <div class="toolbar">
      <div id="cal-esc-uni"></div>
      <label class="search compacta">${ico('calendario')}
        <input type="number" id="cal-esc-ano" min="2020" max="2099" value="${ano}"
               aria-label="Ano" /></label>
      ${ctx.podeEditar ? `<button type="button" class="btn-secundario" id="cal-esc-gerar">
        ${ico('adicionar')} Gerar TDC do ano</button>` : ''}
      ${ctx.podeEditar ? `<button type="button" class="mini-btn" id="cal-esc-tipos">
        ${ico('editar', { tam: 14 })} Tipos de escala</button>` : ''}
    </div>
    <p class="form-hint" id="cal-esc-dica"></p>
    <div id="cal-esc-corpo">${loading()}</div>`;

  // O catálogo é carregado uma vez por abertura da tela; carregar()
  // e pintarProposta() leem `catalogo`, nunca ESCALAS_PADRAO direto -
  // senão um rótulo renomeado pelo admin não apareceria aqui.
  catalogo = await getEscalas().catch(() => []);
  document.getElementById('cal-esc-tipos')?.addEventListener('click', abrirTiposEscala);

  const locais = await getLocais().catch(() => []);
  criarBuscaSelecao(document.getElementById('cal-esc-uni'), {
    opcoes: [{ id: '', rotulo: 'Toda a rede', detalhe: 'calendário oficial' }].concat(
      [...locais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
        .map(l => ({ id: l.id, rotulo: l.nome, busca: l.apelido || '' }))),
    valor: '',
    placeholder: 'Toda a rede',
    onChange: (id) => { unidadeId = id; proposta = null; carregar(); },
  });

  document.getElementById('cal-esc-ano').addEventListener('change', (e) => {
    ano = Number(e.target.value) || anoAtual(); proposta = null; carregar();
  });
  document.getElementById('cal-esc-gerar')?.addEventListener('click', gerar);

  carregar();
}
```

**`carregar()`** monta a tabela de datas do ano com a escala de cada uma:

- na visão **Rede**: `getEscalasRede(`${ano}-01-01`, `${ano}-12-31`)`; cada linha tem um `<select>` com `catalogo` (não `ESCALAS_PADRAO` - é o catálogo real, com os rótulos que o admin já renomeou) mais a opção "sem escala", que grava `null`;
- na visão **Escola**: as mesmas datas da rede, mais as da unidade, com três estados por linha, explicados na própria tela:

| Estado | O que a tela mostra | O que grava |
|---|---|---|
| Segue a rede | `Segue a rede (TDC A)` | `limparEscalaUnidade` |
| Remarcado | o select com a escala escolhida | `definirEscalaUnidade(uni, data, escala)` |
| Cancelado | `Sem TDC nesta escola` | `definirEscalaUnidade(uni, data, null)` |

A dica (`#cal-esc-dica`) muda conforme a visão:
- rede: `As datas abaixo valem para toda a rede. Cada escola pode remarcar ou cancelar as suas.`
- escola: `O que estiver "seguindo a rede" muda junto com o calendário oficial. O que for remarcado ou cancelado vale só para esta escola.`

**`gerar()`** monta a proposta e a exibe **sem gravar**:

```js
async function gerar() {
  const corpo = document.getElementById('cal-esc-corpo');
  corpo.innerHTML = loading('Montando a proposta…');
  try {
    // Um não letivo não pode virar TDC. Buscar os 12 meses e reunir os
    // dias marcados como não letivos.
    const meses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => getCalendarioMes(ano, i + 1)));
    const naoLetivos = new Set(meses.flat().filter(d => !d.letivo).map(d => d.data));
    // As chaves da proposta vêm do catálogo real, não do fallback do
    // gerador - se o admin já tiver acrescentado uma terceira
    // variante de TDC, a alternância passa a considerar as três.
    const chaves = catalogo.filter(e => e.chave !== 'normal').map(e => e.chave);
    proposta = gerarPropostaTDC(ano, { naoLetivos, chaves });
    pintarProposta();
  } catch (err) { corpo.innerHTML = erroBox(err); }
}
```

**`pintarProposta()`** desenha a tabela editável:

```js
function pintarProposta() {
  const corpo = document.getElementById('cal-esc-corpo');
  if (!proposta.length) {
    corpo.innerHTML = emptyState(ico('calendario', { tam: 32 }), 'Nenhuma data proposta',
      'Nenhuma quarta-feira letiva foi encontrada neste ano.');
    return;
  }
  corpo.innerHTML = `
    <div class="cal-prop">
      <p class="form-hint">${proposta.length} datas propostas. Troque a escala de
        qualquer linha ou descarte a que não valer. Nada é gravado até você
        confirmar.</p>
      <div class="cal-prop-linhas">
        ${proposta.map((p, i) => `
          <div class="cal-prop-linha" data-i="${i}">
            <span class="cal-prop-data">${esc(fmtExtenso(p.data))}</span>
            <select class="cal-prop-esc" aria-label="Escala de ${esc(fmtData(p.data))}">
              ${catalogo.filter(e => e.chave !== 'normal').map(e =>
                `<option value="${e.chave}" ${p.escala === e.chave ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}
            </select>
            <button type="button" class="mini-btn no cal-prop-x"
                    aria-label="Descartar ${esc(fmtData(p.data))}">${ico('excluir', { tam: 14 })}</button>
          </div>`).join('')}
      </div>
      <div class="form-foot">
        <button type="button" class="btn-secundario" id="cal-prop-cancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="cal-prop-gravar">Gravar ${proposta.length} datas</button>
      </div>
    </div>`;

  corpo.querySelectorAll('.cal-prop-x').forEach(b => b.addEventListener('click', () => {
    proposta.splice(Number(b.closest('.cal-prop-linha').dataset.i), 1);
    pintarProposta();
  }));
  corpo.querySelectorAll('.cal-prop-esc').forEach(s => s.addEventListener('change', () => {
    proposta[Number(s.closest('.cal-prop-linha').dataset.i)].escala = s.value;
  }));
  document.getElementById('cal-prop-cancelar').addEventListener('click', () => {
    proposta = null; carregar();
  });
  document.getElementById('cal-prop-gravar').addEventListener('click', gravarProposta);
}
```

**`gravarProposta()`** confirma e grava linha a linha, na visão corrente (rede ou escola), com toast de resultado e recarga. Se alguma linha falhar, gravar as demais e dizer no toast quantas não foram - importação que para no meio deixa o calendário pela metade sem ninguém saber.

**`abrirTiposEscala()`** é a gaveta que dá sentido a tudo isto: renomear
"TDC Presencial"/"TDC Virtual" (ou acrescentar uma terceira variante) sem
depender de deploy nenhum. Rótulo é editável; **chave não** - o campo de chave
só existe na criação de um tipo novo e desaparece na edição de um já existente.

```js
function abrirTiposEscala() {
  abrirDrawer(`
    ${drawerHead('Tipos de escala', 'Rótulos usados no calendário e na jornada')}
    <div class="drawer-body">
      <p class="form-hint">O nome muda aqui; o que já foi gravado (as datas do
        calendário, os blocos de jornada) continua apontando para a mesma escala -
        só o rótulo na tela muda.</p>
      <div id="et-lista"></div>
      <form id="et-novo" class="esc-row">
        <input id="et-chave" placeholder="chave (ex.: tdc-c)" required
               pattern="[a-z0-9-]+" title="letras minúsculas, números e hífen" />
        <input id="et-rotulo" placeholder="rótulo (ex.: TDC C)" required />
        <button type="submit" class="mini-btn">${ico('adicionar', { tam: 14 })}</button>
      </form>
    </div>`);
  pintarTipos();
  document.getElementById('et-novo').addEventListener('submit', criarTipo);
}

function pintarTipos() {
  document.getElementById('et-lista').innerHTML = catalogo.map(e => `
    <div class="esc-row" data-chave="${esc(e.chave)}">
      <input class="et-rotulo" value="${esc(e.rotulo)}"
             ${e.chave === 'normal' ? '' : ''} aria-label="Rótulo de ${esc(e.chave)}" />
      <span class="form-hint">${esc(e.chave)}</span>
    </div>`).join('');
  document.getElementById('et-lista').querySelectorAll('.et-rotulo').forEach(inp => {
    inp.addEventListener('change', () => renomear(inp.closest('[data-chave]').dataset.chave, inp.value));
  });
}

async function renomear(chave, rotulo) {
  try {
    await definirEscalaTipo(chave, { rotulo });
    catalogo = await getEscalas();
    toast({ titulo: 'Rótulo atualizado', texto: rotulo, tipo: 'sucesso' });
    pintarProposta.length && pintarProposta();   // se a tabela de proposta estava aberta, reflete o novo rótulo
  } catch (err) {
    toast({ titulo: 'Não foi possível renomear', texto: err.message || String(err), tipo: 'erro' });
    pintarTipos();                                // desfaz visualmente
  }
}

async function criarTipo(e) {
  e.preventDefault();
  const chave = document.getElementById('et-chave').value.trim();
  const rotulo = document.getElementById('et-rotulo').value.trim();
  if (!chave || !rotulo) return;
  try {
    await definirEscalaTipo(chave, { rotulo, ordem: catalogo.length });
    catalogo = await getEscalas();
    document.getElementById('et-chave').value = '';
    document.getElementById('et-rotulo').value = '';
    pintarTipos();
    toast({ titulo: 'Tipo de escala criado', texto: rotulo, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível criar', texto: err.message || String(err), tipo: 'erro' });
  }
}
```

Acrescentar `abrirDrawer, drawerHead` ao import de `shared/ui/drawer.js` no topo do
arquivo (`fecharDrawer` já não é preciso - a gaveta de tipos não fecha sozinha ao
salvar, porque a pessoa pode querer renomear mais de uma).

- [ ] **Step 3: CSS**

```css
.cal-prop-linhas { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.cal-prop-linha { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; }
.cal-prop-data { font-size: 12.5px; }
/* Base = celular (mobile-first, .claude/rules/ui.md): nao criar
   @media (max-width:) - nenhuma existe em todo o src/. */
@media (min-width: 560px) { .cal-prop-data { font-size: 13.5px; } }
```

- [ ] **Step 4: Verificar no navegador**

Com dev-local: gerar a proposta de 2026, conferir 24 datas alternando A e B, descartar duas, trocar a escala de uma, gravar. Recarregar e conferir que gravou o que ficou. Trocar para uma escola, remarcar uma data, cancelar outra, e conferir os três estados. Sem a migration, a tela deve abrir vazia com aviso.

- [ ] **Step 5: Commitar**

```bash
node --test
python .claude/scripts/verificar_arquitetura.py
wc -l src/modules/calendario/*.js src/modules/calendario/views/*.js
git add -A && git diff --cached --stat
git commit -m "feat(calendario): tela de escalas com proposta de TDC editavel"
```

---

## Task 4: Escalas na jornada e na grade

**Files:**
- Modify: `src/modules/horarios/views/jornada.js`
- Modify: `src/modules/horarios/views/por-escola.js`
- Modify: `src/modules/horarios/views/por-servidor.js`

**Interfaces:**
- Consumes: `getEscalas`, `rotulaEscala`, `escolherBlocos`, `getEscalasRede`.
- Produces: nenhuma API nova.

- [ ] **Step 1: Quais abas mostrar**

Uma aba de escala só aparece se a rede tiver **alguma data** marcada com ela. Barra de abas com um item só é ruído; e mostrar "TDC B" numa rede que nunca usou TDC convida a preencher algo que não existe.

Em `horarios.view.js`, ao carregar a casca:

```js
  // Escalas em uso na rede: só elas viram aba na gaveta de jornada.
  const emUso = new Set(['normal']);
  try {
    const ano = hojeISO().slice(0, 4);
    for (const d of await getEscalasRede(`${ano}-01-01`, `${ano}-12-31`)) {
      if (d.escala) emUso.add(d.escala);
    }
  } catch { /* sem migration ou sem rede: só 'normal' */ }
  // O catálogo carregado vai no ctx: rotulaEscala(chave, catalogoEscalas)
  // em vez de rotulaEscala(chave) sozinho - senão um rótulo que o
  // admin renomeou (Task 3) não apareceria aqui.
  const catalogoEscalas = await getEscalas().catch(() => []);
  ctx = { …, escalasEmUso: [...emUso], catalogoEscalas };
```

- [ ] **Step 2: Abas em `jornada.js`**

O estado da gaveta passa a ser `{ servidor, unidadeId, escala, porEscala: { [escala]: { [dia]: linhas[] } }, recarregar }`.

```js
  const abas = escalasEmUso.length > 1 ? `
    <div class="tabbar hj-escalas" role="tablist">
      ${escalasEmUso.map(e => `<button type="button" class="tab ${e === estado.escala ? 'on' : ''}"
        role="tab" aria-selected="${e === estado.escala}" data-escala="${esc(e)}">${esc(rotulaEscala(e, catalogoEscalas))}</button>`).join('')}
    </div>
    <p class="form-hint" id="hj-dica"></p>` : '';
```

A dica da aba não-normal explica o fallback, que é a parte não óbvia:

> Deixe um dia em branco aqui para ele seguir a jornada Normal nesta escala. Só preencha os dias que mudam.

Ao salvar, cada bloco leva `escala: estado.escala`. Blocos de escalas que não foram tocadas não são mexidos.

- [ ] **Step 3: Seletor de escala na grade**

`por-escola.js` ganha, quando `escalasEmUso.length > 1`, um seletor acima da legenda:

```js
`<div class="filters hg-escalas">
  ${ctxAtual.escalasEmUso.map(e => `<button type="button" class="chip ${e === escalaVista ? 'on' : ''}"
    data-escala="${esc(e)}">${esc(rotulaEscala(e, ctxAtual.catalogoEscalas))}</button>`).join('')}
</div>`
```

A grade passa a desenhar `escolherBlocos(blocosDoServidorNoDia, escalaVista)`. Assim dá para ver a semana de TDC A e a de TDC B lado a lado, trocando de chip.

`por-servidor.js` recebe o mesmo seletor.

- [ ] **Step 4: Verificar no navegador**

Com dev-local: marcar duas datas de TDC na rede, abrir a jornada de um gestor, ver as três abas, preencher só a quarta em TDC A, salvar. Voltar à grade, trocar o chip para TDC A e conferir que a quarta mudou e os demais dias continuam iguais aos normais (fallback). Trocar para TDC B e conferir que tudo cai no normal.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): jornada e grade por escala, com fallback para a normal"
```

---

## Task 5: Cartão Hoje na Dashboard

**Files:**
- Create: `src/modules/dashboard/views/hoje.js`
- Modify: `src/modules/dashboard/dashboard.view.js`
- Modify: `src/modules/dashboard/dashboard.css` (criar se não existir, com `@import` em `main.css`)

**Interfaces:**
- Consumes: `getEscalasRede` (Task 2); `resolverEscala`, `rotulaEscala`, `getEscalas`, `diaDaSemana` (Task 1); `getAfastamentos({ vigentesEm, status })` e `CORES_AFASTAMENTO` (`afastamentos.model.js`); `esc`, `vazio`; `fmtExtenso`, `hojeISO`; `ico`; `loading`, `erroBox`.
- Produces: `cartaoHoje(box, ctx) => Promise<void>`.

**Por que na Dashboard:** ela é módulo **agregador** - lê muitos models e não escreve em nenhum. Importar `horarios.model.js` e `afastamentos.model.js` aqui é o padrão que a arquitetura já autoriza.

- [ ] **Step 1: Escrever `views/hoje.js`**

```js
// ============================================================
// FundHub - dashboard/views/hoje.js
// "Nesta data, a rede está em que escala, e quem está fora?"
//
// O campo de data abre em hoje mas aceita qualquer dia: é ele que
// atende também a consulta retroativa ("que horário valia em 12/03"),
// sem exigir uma aba nova em Horários. O passado é estável porque a
// escala é DADO GRAVADO, não conta - corrigir o calendário hoje não
// reescreve o que valia em março.
//
// Quem está afastado aparece marcado, mas a AUSÊNCIA NÃO ALTERA A
// COBERTURA: a jornada cadastrada continua sendo a referência.
// Recalcular geraria alarme falso toda vez que um colega cobre
// informalmente o outro - que é o que acontece na prática.
// ============================================================
import { getEscalasRede } from '../../calendario/calendario.model.js';
import { resolverEscala, rotulaEscala, diaDaSemana, getEscalas } from '../../horarios/horarios.model.js';
import { getAfastamentos, CORES_AFASTAMENTO } from '../../afastamentos/afastamentos.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { fmtExtenso, hojeISO } from '../../../shared/format.js';
import { ico } from '../../../shared/ui/icones.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';

export async function cartaoHoje(box) {
  let data = hojeISO();

  box.innerHTML = `
    <section class="panel hoje">
      <h2>${ico('horario')} Nesta data</h2>
      <label class="search compacta hoje-data">${ico('calendario')}
        <input type="date" id="hoje-dia" value="${esc(data)}" aria-label="Data" /></label>
      <div id="hoje-corpo">${loading()}</div>
    </section>`;

  document.getElementById('hoje-dia').addEventListener('change', (e) => {
    data = e.target.value || hojeISO();
    pintar(data);
  });

  pintar(data);
}

async function pintar(data) {
  const corpo = document.getElementById('hoje-corpo');
  corpo.innerHTML = loading();

  const dow = diaDaSemana(data);
  if (dow === 0 || dow === 6) {
    corpo.innerHTML = `<p class="hoje-linha">${esc(fmtExtenso(data))} -
      ${vazio('fim de semana, sem jornada prevista')}</p>`;
    return;
  }

  try {
    const [escalas, afastados, catalogo] = await Promise.all([
      getEscalasRede(data, data),
      getAfastamentos({ vigentesEm: data, status: 'ativo' }),
      getEscalas(),   // já em cache depois da primeira data escolhida
    ]);
    const escala = resolverEscala({ rede: escalas[0]?.escala ?? null, override: undefined });

    corpo.innerHTML = `
      <p class="hoje-linha">
        <b>${esc(fmtExtenso(data))}</b>
        <span class="tag ${escala === 'normal' ? '' : 'hoje-tdc'}">${esc(rotulaEscala(escala, catalogo))}</span>
      </p>
      ${escala === 'normal'
        ? `<p class="form-hint">Jornada normal em toda a rede. Escolas que tenham remarcado
             o próprio TDC podem estar em outra escala.</p>`
        : `<p class="form-hint">A rede está em ${esc(rotulaEscala(escala, catalogo))}. Quem tiver jornada
             cadastrada nesta escala cumpre a dela; os demais seguem a jornada normal.</p>`}
      ${listaAfastados(afastados)}`;
  } catch (err) { corpo.innerHTML = erroBox(err); }
}

function listaAfastados(lista) {
  if (!lista?.length) {
    return `<p class="hoje-linha">${ico('equipe')} ${vazio('ninguém afastado nesta data')}</p>`;
  }
  return `<div class="hoje-afastados">
    <h3>${lista.length} pessoa(s) afastada(s)</h3>
    ${lista.map(a => `
      <div class="hoje-af" style="--af: ${CORES_AFASTAMENTO[a.tipo] || 'var(--af-outro)'}">
        <span class="hoje-af-nome">${esc(a.servidor?.nome || a.nome || '')}</span>
        <span class="hoje-af-tipo">${esc(a.tipo)}</span>
      </div>`).join('')}
  </div>`;
}
```

**Conferir a forma real do afastamento** antes de escrever `a.servidor?.nome || a.nome`: ler o `select` de `getAfastamentos` em `afastamentos.model.js` e usar os campos que ele de fato traz.

- [ ] **Step 2: Montar na Dashboard**

Em `dashboard.view.js`, inserir o cartão no topo da grade, com `import()` dinâmico:

```js
  const { cartaoHoje } = await import('./views/hoje.js');
  await cartaoHoje(document.getElementById('dash-hoje'));
```

- [ ] **Step 3: CSS**

```css
.hoje-linha { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
.hoje-data { max-width: 220px; margin-bottom: 8px; }
.tag.hoje-tdc { background: var(--accent); color: var(--on-cor); }
.hoje-afastados h3 { margin: 12px 0 6px; font-size: 13px; color: var(--muted); }
.hoje-af {
  display: flex; align-items: baseline; gap: 8px;
  padding: 6px 10px; margin-bottom: 4px;
  border-left: 3px solid var(--af); border-radius: 0 8px 8px 0;
  background: var(--surface-2);
}
.hoje-af-tipo { margin-left: auto; color: var(--muted); font-size: 12px; }
```

- [ ] **Step 4: Verificar no navegador**

Com dev-local: abrir a Dashboard, conferir que o cartão abre em hoje; escolher uma data marcada como TDC A e ver a tag mudar; escolher um sábado e ver a mensagem semântica; escolher uma data com afastamento ativo e ver a pessoa listada com a cor do tipo. Console limpo.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(dashboard): cartao com a escala da data e quem esta afastado"
```

---

## Task 6: Fechamento da entrega

**Files:**
- Modify: `src/core/config.js`, `CHANGELOG.md`, `src/modules/docs/docs.content.js`

- [ ] **Step 1: Rodar tudo**

```bash
node --test
python .claude/scripts/verificar_arquitetura.py
wc -l src/modules/horarios/*.js src/modules/horarios/views/*.js src/modules/calendario/*.js src/modules/calendario/views/*.js
```

- [ ] **Step 2: Atualizar a documentação interna**

`docs.content.js` descreve os módulos para quem usa. Acrescentar ao verbete de Horários a explicação do TDC, em linguagem de usuário:

> Alguns dias do calendário têm jornada diferente - é o caso do TDC. O Calendário Escolar diz quais datas são TDC e em qual das duas escalas (A ou B) cada uma está. No horário do gestor, você preenche só os dias que mudam: o que ficar em branco segue a jornada normal.

- [ ] **Step 3: Subir a versão e escrever o CHANGELOG**

`CONFIG.versao` → `0.14.0` (MINOR: mudança de modelo).

```markdown
## 0.14.0

- O Calendário Escolar passou a registrar os dias de TDC e em qual escala (A ou B)
  cada um está. Um botão gera as 1ªs e 3ªs quartas do ano de uma vez, e você ajusta
  ou descarta o que não valer antes de gravar.
- Cada escola pode remarcar o próprio TDC para outra data, ou dizer que naquela
  data não tem TDC. O que não for remarcado acompanha o calendário da rede.
- No horário do gestor, além da semana normal, dá para cadastrar a jornada dos dias
  de TDC A e de TDC B. Só é preciso preencher os dias que mudam: o que ficar em
  branco segue a jornada normal.
- A Dashboard passou a mostrar, para a data que você escolher, em qual escala a rede
  está e quem está afastado. O campo de data aceita qualquer dia, inclusive passado.
```

- [ ] **Step 4: Teste final**

375px, tema claro e escuro, console limpo. Percorrer Calendário (as duas abas), Horários (as duas abas, com e sem escala) e Dashboard.

- [ ] **Step 5: Commitar**

```bash
git add -A && git diff --cached
git commit -m "chore: versao 0.14.0 e fecha a rodada de escalas de horario"
```

---

## Verificação final

- [ ] `node --test` verde.
- [ ] `python .claude/scripts/verificar_arquitetura.py` sem novas violações - conferir R8 (nenhum `toISOString`, `toLocaleDateString` ou `toLocaleString` fora de `format.js`) e R11 (tamanho dos arquivos).
- [ ] Servidor com blocos em `tdc-presencial` e sem blocos em `tdc-virtual`: o TDC virtual cai no normal.
- [ ] Renomear o rótulo de uma escala (tela de Tipos de escala) e conferir que a jornada, a aba e o cartão Hoje mostram o nome novo sem precisar de deploy.
- [ ] Acrescentar uma terceira chave de escala e gerar a proposta do ano: a alternância passa a considerar as três.
- [ ] Data em que a escola remarcou o TDC, e data em que a escola o cancelou: os três estados se comportam como a tabela da spec.
- [ ] Consulta a uma data passada devolve o que estava gravado, não uma conta refeita.
- [ ] Sem a migration 024, todas as telas abrem e avisam o que falta.
- [ ] Fim de semana, feriado e dia sem escala: mensagens semânticas, nunca travessão.
- [ ] `git diff` da branch lido inteiro à procura de dado real.
