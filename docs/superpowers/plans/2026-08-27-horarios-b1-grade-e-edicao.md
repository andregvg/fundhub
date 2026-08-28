# Horários B-1: Grade e Edição - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a pilha de painéis da aba "Por escola" por uma grade única, manipulável e legível: blocos de todos os servidores exibidos convivendo em faixas, cor por série, seleção por clique, divergência marcada no minuto exato, ordem arrastável e cobertura configurável por escola.

**Architecture:** Toda a matemática nova (empilhar em faixas, achar o intervalo da divergência, ordenar a grade) vai para `horarios.model.js` e é coberta por testes de `node`, porque é onde o erro é silencioso. A view vira desenho puro. A busca por palavras-chave nasce como componente de `shared/ui/`, com quatro consumidores já existentes.

**Tech Stack:** JavaScript ES modules puro, sem build. Postgres via PostgREST (Supabase). Testes `.mjs` com `node:test` e `node:assert/strict`.

**Spec:** [`docs/superpowers/specs/2026-08-27-horarios-escalas-grade-design.md`](../specs/2026-08-27-horarios-escalas-grade-design.md)

**Depende de:** o plano `2026-08-27-sistema-visual.md`, concluído. Este plano usa `ico()`, `toast()`, `vazio()` e `.switch` como se já existissem.

## Global Constraints

- **PT-BR** em código, comentário, commit e interface.
- **Branch `dev`.**
- **Sem npm, sem bundler, sem dependência nova.**
- **Nenhuma cor literal em `src/modules/**`.** Só `var(--token)`, em `tokens.css`, nas duas variantes.
- **Todo valor vindo do banco passa por `esc()`.**
- **Model nunca toca no DOM. View nunca chama `sb()`.** A view recebe `ctx.perfil` do roteador; não chama `getPerfilAtual()`.
- **Só `*.model.js` atravessa a fronteira de um módulo.**
- **Nenhum dado real** em código, comentário, exemplo ou fixture. Nos testes, usar nomes inventados (`Gestor A`, `Escola Exemplo`) e uuids fictícios.
- **Migration idempotente** (`if not exists`, `on conflict do nothing`), com RLS, `grant` para `authenticated`, trigger de auditoria religado e a tabela acrescentada ao array da `019`. Nenhuma policy para `anon`.
- **Degradar sem a migration:** capturar `42P01` (tabela ausente) e `42703` (coluna ausente) e seguir com estado vazio, avisando o que falta.
- **Erro barra, aviso marca.** Sobreposição de blocos do mesmo servidor é **erro** e impede o salvamento. Mais de 8h/dia, mais de 6h contínuas e lacuna de cobertura são **avisos**: deixam salvar e ficam marcados na grade.
- **Limites de arquivo:** view > 400 linhas ou model > 250 linhas → dividir por superfície de UI, em `views/`.
- **Antes de cada commit:** `node --test tests/`, `python .claude/scripts/verificar_arquitetura.py`, e `git diff --cached` lido.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/024_horarios_escalas.sql` | **novo.** As quatro mudanças de dado, escritas inteiras aqui (B-2 só passa a ler as colunas de escala). |
| `src/shared/ui/busca-selecao.js` | **novo.** Combobox por palavras-chave. Tem estado, teclado e foco → componente JS (R12). |
| `src/modules/servidores/vinculos.model.js` | Ganha `cargo_gestao`: leitura, escrita e o predicado `ehGestao`. |
| `src/modules/horarios/horarios.model.js` | Ganha intervalos na validação, empilhamento em faixas e a API de exibição. Vigiar o limite de 250 linhas. |
| `src/modules/horarios/views/por-escola.js` | Reescrita: a grade única. |
| `src/modules/horarios/views/grade.js` | **novo.** O desenho da grade (faixas, eixo, hachura, seleção). Extraído para `por-escola.js` não passar de 400 linhas. |
| `src/modules/horarios/views/jornada.js` | **novo.** A gaveta da semana inteira. Substitui `bloco.js`. |
| `src/modules/horarios/views/cargos.js` | **novo.** Gaveta de admin: quais cargos são equipe gestora. |
| `src/modules/horarios/views/bloco.js` | **removido.** |
| `src/modules/horarios/horarios.css` | Faixas, séries, hachura, legenda arrastável. |
| `src/styles/tokens.css` | `--serie-1` a `--serie-6`, claro e escuro. |
| `tests/horarios.test.mjs` | **novo.** Validação com intervalos, faixas, ordenação da grade. |
| `tests/busca.test.mjs` | **novo.** Filtro por palavras-chave. |

---

## Task 1: Migration 024

**Files:**
- Create: `supabase/migrations/024_horarios_escalas.sql`
- Modify: `supabase/migrations/019_auditoria_completa.sql` (array de tabelas auditadas)

**Interfaces:**
- Consumes: `is_autorizado()`, `is_admin()` (migration 002/021); `unidade_escolar`, `servidor`, `dia_calendario`, `horario_bloco`.
- Produces: colunas `dia_calendario.escala`, `horario_bloco.escala`; tabelas `escala_unidade`, `cargo_gestao`, `horario_exibicao`.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- 024 — Horários: escalas de calendário, cargos de gestão e
-- configuração de exibição por escola.
-- Rode no SQL Editor, depois da 023.
--
-- ESCALA é o nome de um dia. O horário não é escrito contra datas,
-- é escrito contra nomes de dia — e o calendário diz, para cada data
-- real, qual nome ela tem. É isso que resolve o TDC com revezamento
-- sem inferir nada: "em que fase estamos?" vira consulta.
--
-- Vocabulário inicial: 'normal', 'tdc-a', 'tdc-b'. É `text` e não
-- `enum` porque o vocabulário vai crescer (recesso, plantão) e migrar
-- enum no Postgres é caro. O conjunto válido é validado na aplicação.
--
-- As colunas de escala são criadas aqui mas só passam a ser LIDAS no
-- plano B-2. Coluna ociosa com default não afeta nada; migration
-- pela metade, sim.
-- ============================================================

-- ── Escala do dia, na rede ───────────────────────────────────
alter table dia_calendario add column if not exists escala text;

-- ── Escala do dia, remarcada por uma escola ──────────────────
-- Três estados, deliberadamente distintos:
--   sem linha            → a escola segue o calendário da rede;
--   linha com escala     → a escola remarcou;
--   linha com escala nula→ a escola CANCELOU: aqui não há TDC nesta data.
-- Um boolean não distinguiria "não decidiram" de "decidiram que não".
create table if not exists escala_unidade (
  unidade_id uuid not null references unidade_escolar(id) on delete cascade,
  data       date not null,
  escala     text,
  criado_por text,
  criado_em  timestamptz not null default now(),
  primary key (unidade_id, data)
);

-- ── Escala de um bloco de jornada ────────────────────────────
alter table horario_bloco add column if not exists escala text not null default 'normal';
create index if not exists idx_horario_escala
  on horario_bloco(unidade_id, escala, dia_semana);

-- ── Cargos que compõem a equipe gestora ──────────────────────
-- `vinculo.papel` é texto livre e o catálogo É o conjunto dos cargos
-- em uso — então o sistema não sabia responder "esta pessoa é
-- gestora?". Esta tabela é a resposta, e é decidida por gente.
-- Cargo fora da lista NÃO é gestão: ninguém entra na cobertura da
-- escola por acidente.
create table if not exists cargo_gestao (
  cargo      text primary key,
  criado_por text,
  criado_em  timestamptz not null default now()
);

insert into cargo_gestao (cargo) values
  ('Diretor(a)'), ('Vice-diretor(a)'), ('Coordenador(a)'), ('Supervisor(a)')
on conflict (cargo) do nothing;

-- ── Exibição e cobertura por escola ──────────────────────────
-- "O horário da coordenadora conta na cobertura desta escola" é um
-- FATO DA ESCOLA, não preferência de quem está olhando: duas pessoas
-- conferindo a mesma unidade precisam ver a mesma cobertura. Por isso
-- vive no banco e não em localStorage.
-- Sem linha = comportamento padrão (exibe se for cargo de gestão,
-- conta na cobertura, ordem alfabética por cargo e nome).
create table if not exists horario_exibicao (
  unidade_id      uuid not null references unidade_escolar(id) on delete cascade,
  servidor_id     uuid not null references servidor(id)        on delete cascade,
  ordem           int  not null default 0,
  conta_cobertura boolean not null default true,
  atualizado_por  text,
  atualizado_em   timestamptz not null default now(),
  primary key (unidade_id, servidor_id)
);
create index if not exists idx_horario_exibicao_uni on horario_exibicao(unidade_id, ordem);

-- ── RLS ──────────────────────────────────────────────────────
alter table escala_unidade   enable row level security;
alter table escala_unidade   force  row level security;
alter table cargo_gestao     enable row level security;
alter table cargo_gestao     force  row level security;
alter table horario_exibicao enable row level security;
alter table horario_exibicao force  row level security;

drop policy if exists escala_uni_sel on escala_unidade;
drop policy if exists escala_uni_wr  on escala_unidade;
create policy escala_uni_sel on escala_unidade for select using (is_autorizado());
create policy escala_uni_wr  on escala_unidade for all
  using (is_admin()) with check (is_admin());

drop policy if exists cargo_gestao_sel on cargo_gestao;
drop policy if exists cargo_gestao_wr  on cargo_gestao;
create policy cargo_gestao_sel on cargo_gestao for select using (is_autorizado());
create policy cargo_gestao_wr  on cargo_gestao for all
  using (is_admin()) with check (is_admin());

drop policy if exists horario_exib_sel on horario_exibicao;
drop policy if exists horario_exib_wr  on horario_exibicao;
create policy horario_exib_sel on horario_exibicao for select using (is_autorizado());
create policy horario_exib_wr  on horario_exibicao for all
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on escala_unidade   to authenticated;
grant select, insert, update, delete on cargo_gestao     to authenticated;
grant select, insert, update, delete on horario_exibicao to authenticated;

-- ── Auditoria ────────────────────────────────────────────────
drop trigger if exists audit_escala_unidade   on escala_unidade;
drop trigger if exists audit_cargo_gestao     on cargo_gestao;
drop trigger if exists audit_horario_exibicao on horario_exibicao;
create trigger audit_escala_unidade   after insert or update or delete on escala_unidade
  for each row execute function fn_audit();
create trigger audit_cargo_gestao     after insert or update or delete on cargo_gestao
  for each row execute function fn_audit();
create trigger audit_horario_exibicao after insert or update or delete on horario_exibicao
  for each row execute function fn_audit();
```

- [ ] **Step 2: Acrescentar as três tabelas ao array da `019`**

Em `supabase/migrations/019_auditoria_completa.sql`, no array de tabelas auditadas, acrescentar `'escala_unidade','cargo_gestao','horario_exibicao'`.

- [ ] **Step 3: Conferir a idempotência lendo o arquivo**

Todo `create table` tem `if not exists`; todo `create policy` é precedido de `drop policy if exists`; todo `create trigger` é precedido de `drop trigger if exists`; o `insert` de cargos tem `on conflict do nothing`; o `add column` tem `if not exists`. Rodar duas vezes no SQL Editor deve dar o mesmo resultado, sem erro.

- [ ] **Step 4: Rodar no SQL Editor do painel**

Duas vezes. A segunda não pode dar erro.

- [ ] **Step 5: Commitar**

```bash
git add supabase/migrations/024_horarios_escalas.sql supabase/migrations/019_auditoria_completa.sql
git commit -m "feat(db): migration 024 - escalas, cargos de gestao e exibicao por escola"
```

---

## Task 2: Validação com intervalos

**Files:**
- Modify: `src/modules/horarios/horarios.model.js` (`validarDia`)
- Create: `tests/horarios.test.mjs`

**Interfaces:**
- Consumes: `paraMin`, `paraHora`, `duracao`, `MAX_DIA_MIN`, `MAX_CONTINUO_MIN` (já existem).
- Produces: `validarDia(blocosDoDia) => Array<{ nivel: 'erro'|'aviso', codigo: string, texto: string, ini: number, fim: number }>` - `ini` e `fim` em **minutos desde a meia-noite**, delimitando o trecho problemático. `codigo` é `'sobreposicao' | 'carga-dia' | 'continuo'`.

**Mudança de contrato:** hoje `validarDia` devolve `{ nivel, texto }` e a tela imprime o texto embaixo da barra, longe do minuto errado. A partir daqui devolve também **onde**. Quem consome hoje: `views/bloco.js` (some na Task 8) e `views/por-escola.js` (reescrita na Task 6).

**Reclassificação:** "mais de 8h no dia" deixa de ser `erro` e passa a `aviso`. A SME legitimamente precisa registrar isso. Só a sobreposição continua barrando, porque descreve uma situação impossível.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/horarios.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarDia, paraMin } from '../src/modules/horarios/horarios.model.js';

const b = (inicio, fim) => ({ inicio, fim });
const acha = (probs, codigo) => probs.find(p => p.codigo === codigo);

test('dia vazio nao tem problema', () => {
  assert.deepEqual(validarDia([]), []);
});

test('jornada normal de 8h partida em dois blocos nao acusa nada', () => {
  assert.deepEqual(validarDia([b('07:00', '11:00'), b('12:00', '16:00')]), []);
});

test('sobreposicao e ERRO e marca a intersecao', () => {
  const p = acha(validarDia([b('07:00', '12:00'), b('11:00', '15:00')]), 'sobreposicao');
  assert.equal(p.nivel, 'erro');
  assert.equal(p.ini, paraMin('11:00'));
  assert.equal(p.fim, paraMin('12:00'));
});

test('sobreposicao total marca o bloco contido inteiro', () => {
  const p = acha(validarDia([b('07:00', '15:00'), b('09:00', '10:00')]), 'sobreposicao');
  assert.equal(p.ini, paraMin('09:00'));
  assert.equal(p.fim, paraMin('10:00'));
});

test('mais de 8h no dia e AVISO, nao erro', () => {
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:00')]), 'carga-dia');
  assert.equal(p.nivel, 'aviso');
});

test('as 8h marcam os minutos excedentes, contados do fim para tras', () => {
  // 07:00-12:00 (5h) + 13:00-17:00 (4h) = 9h. Excesso: 1h.
  // A ultima hora trabalhada vai das 16:00 as 17:00.
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:00')]), 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('17:00'));
});

test('o excesso de carga atravessa o intervalo quando precisa', () => {
  // 07:00-12:00 (5h) + 13:00-17:30 (4h30) = 9h30. Excesso: 1h30.
  // 17:30 menos 1h30 = 16:00 — cabe no ultimo trecho, sem atravessar.
  const p = acha(validarDia([b('07:00', '12:00'), b('13:00', '17:30')]), 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('17:30'));
});

test('excesso maior que o ultimo trecho continua no trecho anterior', () => {
  // 07:00-12:00 (5h) + 13:00-17:00 (4h) + 18:00-19:00 (1h) = 10h. Excesso: 2h.
  // Ultimo trecho da 1h; falta 1h, que vem do fim do trecho anterior (16:00-17:00).
  const probs = validarDia([b('07:00', '12:00'), b('13:00', '17:00'), b('18:00', '19:00')]);
  const p = acha(probs, 'carga-dia');
  assert.equal(p.ini, paraMin('16:00'));
  assert.equal(p.fim, paraMin('19:00'));
});

test('mais de 6h continuas e AVISO e marca so o que passa das 6h', () => {
  // 07:00-14:00 = 7h continuas. As 6h terminam as 13:00.
  const p = acha(validarDia([b('07:00', '14:00')]), 'continuo');
  assert.equal(p.nivel, 'aviso');
  assert.equal(p.ini, paraMin('13:00'));
  assert.equal(p.fim, paraMin('14:00'));
});

test('blocos encostados contam como um trecho continuo so', () => {
  // 07:00-10:00 + 10:00-14:00 nao tem intervalo: sao 7h continuas.
  const p = acha(validarDia([b('07:00', '10:00'), b('10:00', '14:00')]), 'continuo');
  assert.ok(p, 'blocos colados deveriam acusar trecho continuo');
  assert.equal(p.ini, paraMin('13:00'));
});

test('exatamente 6h continuas nao acusa', () => {
  assert.equal(acha(validarDia([b('07:00', '13:00')]), 'continuo'), undefined);
});

test('exatamente 8h no dia nao acusa', () => {
  assert.equal(acha(validarDia([b('07:00', '11:00'), b('12:00', '16:00')]), 'carga-dia'), undefined);
});

test('todo problema traz intervalo utilizavel', () => {
  const probs = validarDia([b('07:00', '15:00'), b('14:00', '18:00')]);
  assert.ok(probs.length);
  for (const p of probs) {
    assert.equal(typeof p.ini, 'number');
    assert.equal(typeof p.fim, 'number');
    assert.ok(p.fim > p.ini, `intervalo vazio em ${p.codigo}`);
    assert.ok(p.texto.length > 0);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/horarios.test.mjs
```

Esperado: FAIL - os problemas não têm `codigo`, `ini` nem `fim`, e "carga-dia" ainda é `erro`.

- [ ] **Step 3: Reescrever `validarDia` em `horarios.model.js`**

```js
// Problemas da jornada de UM servidor em UM dia, cada um com o
// INTERVALO em que ele acontece — para a grade poder marcar onde
// está o problema em vez de só escrever o que ele é.
//
// Só a sobreposição barra o salvamento: ela descreve algo impossível
// (a pessoa em dois lugares). Carga e trecho contínuo descrevem algo
// indesejável mas às vezes necessário, e a SME precisa poder
// registrar. Ver .claude/rules/dados.md — "erro barra, aviso não".
export function validarDia(blocosDoDia) {
  const problemas = [];
  if (!blocosDoDia?.length) return problemas;

  const ivs = blocosDoDia.map(paraIntervalo).sort((a, b) => a.ini - b.ini);

  // ── Sobreposição (erro) ──
  for (let i = 1; i < ivs.length; i++) {
    if (ivs[i].ini < ivs[i - 1].fim) {
      const ini = ivs[i].ini;
      const fim = Math.min(ivs[i - 1].fim, ivs[i].fim);
      problemas.push({
        nivel: 'erro', codigo: 'sobreposicao', ini, fim,
        texto: `Blocos sobrepostos entre ${paraHora(ini)} e ${paraHora(fim)}.`,
      });
      break;
    }
  }

  const unidos = unir(ivs);

  // ── Carga do dia (aviso) ──
  const total = ivs.reduce((s, iv) => s + (iv.fim - iv.ini), 0);
  if (total > MAX_DIA_MIN) {
    const excesso = total - MAX_DIA_MIN;
    const trecho = ultimosMinutos(unidos, excesso);
    problemas.push({
      nivel: 'aviso', codigo: 'carga-dia', ini: trecho.ini, fim: trecho.fim,
      texto: `${duracao(total)} no dia — ${duracao(excesso)} além do limite de ${duracao(MAX_DIA_MIN)}.`,
    });
  }

  // ── Trecho contínuo (aviso) ──
  for (const run of unidos) {
    if (run.fim - run.ini > MAX_CONTINUO_MIN) {
      problemas.push({
        nivel: 'aviso', codigo: 'continuo',
        ini: run.ini + MAX_CONTINUO_MIN, fim: run.fim,
        texto: `${duracao(run.fim - run.ini)} contínuas a partir de ${paraHora(run.ini)} — o limite é ${duracao(MAX_CONTINUO_MIN)}. Inclua um intervalo.`,
      });
      break;
    }
  }

  return problemas;
}

// Os últimos `minutos` de tempo TRABALHADO, caminhando de trás para
// frente pelos trechos unidos. O intervalo devolvido pode atravessar
// uma pausa: se o excesso é maior que o último trecho, ele continua
// no anterior — e a marcação na grade cobre os dois.
function ultimosMinutos(unidos, minutos) {
  let faltam = minutos;
  let ini = unidos[unidos.length - 1].fim;
  const fim = unidos[unidos.length - 1].fim;
  for (let i = unidos.length - 1; i >= 0 && faltam > 0; i--) {
    const dura = unidos[i].fim - unidos[i].ini;
    if (dura >= faltam) { ini = unidos[i].fim - faltam; faltam = 0; }
    else { ini = unidos[i].ini; faltam -= dura; }
  }
  return { ini, fim };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/horarios.test.mjs
```

Esperado: PASS, 13 testes.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/horarios/horarios.model.js tests/horarios.test.mjs
git commit -m "feat(horarios): validacao devolve o intervalo da divergencia"
```

---

## Task 3: Empilhamento em faixas e ordenação da grade

**Files:**
- Modify: `src/modules/horarios/horarios.model.js`
- Modify: `tests/horarios.test.mjs`

**Interfaces:**
- Consumes: `paraMin`.
- Produces:
  - `empilhar(blocos) => Array<{ bloco, faixa: number }>` - `faixa` é 0-based;
  - `contarFaixas(blocos) => number`;
  - `ordenarParaGrade(servidores, { exibicao, cargosGestao, cargoDe }) => Array<{ servidor, ordem, contaCobertura, exibir, serie }>` - `serie` é 0..5, a posição módulo 6.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/horarios.test.mjs`:

```js
import { empilhar, contarFaixas, ordenarParaGrade } from '../src/modules/horarios/horarios.model.js';

const bl = (inicio, fim, id) => ({ id, inicio, fim });

test('blocos que nao se sobrepoem cabem todos na faixa 0', () => {
  const r = empilhar([bl('07:00', '11:00', 'a'), bl('12:00', '16:00', 'b')]);
  assert.deepEqual(r.map(x => x.faixa), [0, 0]);
  assert.equal(contarFaixas([bl('07:00', '11:00', 'a'), bl('12:00', '16:00', 'b')]), 1);
});

test('blocos sobrepostos vao para faixas diferentes', () => {
  const b = [bl('07:00', '12:00', 'a'), bl('11:00', '15:00', 'b')];
  const r = empilhar(b);
  assert.equal(r.find(x => x.bloco.id === 'a').faixa, 0);
  assert.equal(r.find(x => x.bloco.id === 'b').faixa, 1);
  assert.equal(contarFaixas(b), 2);
});

test('a faixa e reaproveitada assim que ela vaga', () => {
  // a 07-12 (faixa 0), b 11-15 (faixa 1), c 13-18 cabe na faixa 0 de novo.
  const b = [bl('07:00', '12:00', 'a'), bl('11:00', '15:00', 'b'), bl('13:00', '18:00', 'c')];
  const r = empilhar(b);
  assert.equal(r.find(x => x.bloco.id === 'c').faixa, 0);
  assert.equal(contarFaixas(b), 2);
});

test('blocos encostados dividem a mesma faixa', () => {
  const b = [bl('07:00', '11:00', 'a'), bl('11:00', '15:00', 'b')];
  assert.equal(contarFaixas(b), 1);
});

test('tres sobrepostos ocupam tres faixas', () => {
  const b = [bl('07:00', '18:00', 'a'), bl('08:00', '17:00', 'b'), bl('09:00', '16:00', 'c')];
  assert.equal(contarFaixas(b), 3);
});

test('lista vazia tem uma faixa, para a linha do dia nao colapsar', () => {
  assert.equal(contarFaixas([]), 1);
  assert.deepEqual(empilhar([]), []);
});

// ── ordenarParaGrade ──
const CARGOS = new Set(['Diretor(a)', 'Coordenador(a)']);
const cargoDe = (s) => s.cargo;
const S = (id, nome, cargo) => ({ id, nome, cargo });

test('sem configuracao, so cargos de gestao aparecem, em ordem alfabetica de cargo e nome', () => {
  const r = ordenarParaGrade(
    [S('3', 'Gestor C', 'Coordenador(a)'), S('1', 'Gestor A', 'Diretor(a)'),
     S('2', 'Gestor B', 'Coordenador(a)'), S('4', 'Servidor D', 'Agente Escolar')],
    { exibicao: [], cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.filter(x => x.exibir).map(x => x.servidor.id), ['2', '3', '1']);
  assert.equal(r.find(x => x.servidor.id === '4').exibir, false);
});

test('quem tem linha de exibicao aparece mesmo sem cargo de gestao', () => {
  const r = ordenarParaGrade(
    [S('4', 'Servidor D', 'Agente Escolar')],
    { exibicao: [{ servidor_id: '4', ordem: 0, conta_cobertura: true }], cargosGestao: CARGOS, cargoDe });
  assert.equal(r[0].exibir, true);
});

test('a ordem gravada vence a alfabetica', () => {
  const r = ordenarParaGrade(
    [S('1', 'Gestor A', 'Diretor(a)'), S('2', 'Gestor B', 'Coordenador(a)')],
    { exibicao: [{ servidor_id: '2', ordem: 0, conta_cobertura: true },
                 { servidor_id: '1', ordem: 1, conta_cobertura: true }],
      cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.map(x => x.servidor.id), ['2', '1']);
});

test('conta_cobertura false e respeitado; sem linha, o padrao e contar', () => {
  const r = ordenarParaGrade(
    [S('1', 'Gestor A', 'Diretor(a)'), S('2', 'Gestor B', 'Coordenador(a)')],
    { exibicao: [{ servidor_id: '1', ordem: 0, conta_cobertura: false }],
      cargosGestao: CARGOS, cargoDe });
  assert.equal(r.find(x => x.servidor.id === '1').contaCobertura, false);
  assert.equal(r.find(x => x.servidor.id === '2').contaCobertura, true);
});

test('a serie e a posicao modulo 6, para a cor repetir sem confundir', () => {
  const servidores = Array.from({ length: 8 }, (_, i) => S(String(i), `Gestor ${i}`, 'Diretor(a)'));
  const exibicao = servidores.map((s, i) => ({ servidor_id: s.id, ordem: i, conta_cobertura: true }));
  const r = ordenarParaGrade(servidores, { exibicao, cargosGestao: CARGOS, cargoDe });
  assert.deepEqual(r.map(x => x.serie), [0, 1, 2, 3, 4, 5, 0, 1]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/horarios.test.mjs
```

Esperado: FAIL - `empilhar` não exportada.

- [ ] **Step 3: Implementar**

```js
export const SERIES = 6;   // quantidade de cores da paleta (tokens --serie-1..6)

// Distribui os blocos de UM dia em faixas horizontais: cada bloco vai
// para a primeira faixa que já esteja livre naquele horário. Sem isso
// um bloco cobre o outro e a grade mente sobre quem está presente.
//
// Blocos encostados (fim == início) dividem a mesma faixa: não há
// conflito visual entre eles.
export function empilhar(blocos) {
  const ord = [...(blocos || [])]
    .map(b => ({ bloco: b, ini: paraMin(b.inicio), fim: paraMin(b.fim) }))
    .sort((a, b) => a.ini - b.ini || a.fim - b.fim);

  const fimDaFaixa = [];          // fimDaFaixa[i] = onde a faixa i está livre
  const out = [];
  for (const item of ord) {
    let faixa = fimDaFaixa.findIndex(f => f <= item.ini);
    if (faixa === -1) { faixa = fimDaFaixa.length; fimDaFaixa.push(0); }
    fimDaFaixa[faixa] = item.fim;
    out.push({ bloco: item.bloco, faixa });
  }
  return out;
}

// Quantas faixas a linha daquele dia precisa. Nunca menos de 1: a
// linha de um dia sem jornada ainda precisa de altura para dizer isso.
export const contarFaixas = (blocos) =>
  Math.max(1, empilhar(blocos).reduce((m, x) => Math.max(m, x.faixa + 1), 0));

// Quem aparece na grade, em que ordem, com que cor e contando ou não
// na cobertura.
//
// Sem linha em horario_exibicao vale o padrão: aparece se o cargo for
// de gestão, conta na cobertura, ordenado por cargo e depois por nome.
// Quem tem linha aparece de qualquer jeito — foi decisão de alguém.
export function ordenarParaGrade(servidores, { exibicao = [], cargosGestao = new Set(), cargoDe }) {
  const porId = new Map((exibicao || []).map(e => [e.servidor_id, e]));

  const itens = (servidores || []).map(servidor => {
    const cfg = porId.get(servidor.id);
    const cargo = cargoDe(servidor) || '';
    return {
      servidor,
      cargo,
      exibir: Boolean(cfg) || cargosGestao.has(cargo),
      contaCobertura: cfg ? cfg.conta_cobertura : true,
      ordem: cfg ? cfg.ordem : null,
    };
  });

  itens.sort((a, b) => {
    if (a.ordem !== null && b.ordem !== null) return a.ordem - b.ordem;
    if (a.ordem !== null) return -1;
    if (b.ordem !== null) return 1;
    return a.cargo.localeCompare(b.cargo, 'pt')
      || a.servidor.nome.localeCompare(b.servidor.nome, 'pt');
  });

  return itens.map((it, i) => ({ ...it, serie: i % SERIES }));
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/horarios.test.mjs
```

Esperado: PASS, 25 testes ao todo.

- [ ] **Step 5: Conferir o tamanho do model**

```bash
wc -l src/modules/horarios/horarios.model.js
```

Limite: 250 linhas. Se passou, dividir por **superfície**, não por tipo técnico: a matemática de barra e faixa (`posicaoNaBarra`, `marcasDaBarra`, `empilhar`, `contarFaixas`) pode ir para `horarios/grade.model.js` como segundo model público do módulo - o que é legítimo (`sate/` tem dois).

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/horarios/ tests/horarios.test.mjs
git commit -m "feat(horarios): empilhamento em faixas e ordenacao da grade"
```

---

## Task 4: Cargos de equipe gestora

**Files:**
- Modify: `src/modules/servidores/vinculos.model.js`
- Create: `src/modules/horarios/views/cargos.js`
- Modify: `src/modules/horarios/horarios.view.js` (botão de admin na casca)

**Interfaces:**
- Consumes: `sb()`, `hasSupabase()`, `getCargos()` (já existe), `drawer.js`, `toast()`, `ico()`, `.switch`.
- Produces:
  - `getCargosGestao() => Promise<Set<string>>`;
  - `definirCargoGestao(cargo: string, eGestao: boolean) => Promise<void>`;
  - `limparCacheCargosGestao() => void`;
  - `abrirCargos({ recarregar })` de `views/cargos.js`.

- [ ] **Step 1: Model em `vinculos.model.js`**

```js
let _gestao = null;
export function limparCacheCargosGestao() { _gestao = null; }

// Quais cargos compõem a equipe gestora. Vive aqui porque este model
// é o dono do domínio "cargo"; quem consome é o módulo Horários.
//
// Degrada sem a migration 024: sem a tabela, devolve conjunto vazio e
// a grade cai no comportamento "ninguém é gestão por omissão", que a
// tela explica ao usuário em vez de quebrar.
export async function getCargosGestao() {
  if (_gestao) return _gestao;
  if (!hasSupabase()) { _gestao = new Set(); return _gestao; }
  const { data, error } = await sb().from('cargo_gestao').select('cargo');
  if (error) {
    if (error.code === '42P01') { _gestao = new Set(); return _gestao; }
    throw error;
  }
  _gestao = new Set((data || []).map(r => r.cargo));
  return _gestao;
}

export async function definirCargoGestao(cargo, eGestao) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const c = normalizaCargo(cargo);
  if (!c) throw new Error('Informe o cargo.');
  const { error } = eGestao
    ? await sb().from('cargo_gestao').upsert({ cargo: c }, { onConflict: 'cargo' })
    : await sb().from('cargo_gestao').delete().eq('cargo', c);
  if (error) throw error;
  _gestao = null;                          // escreveu, invalidou
}
```

Registrar no barramento de caches (do plano do sistema visual):

```js
import { registrarCache } from '../../shared/cache.js';
registrarCache(limparCacheCargosGestao);
```

- [ ] **Step 2: Gaveta em `src/modules/horarios/views/cargos.js`**

```js
// ============================================================
// FundHub — horarios/views/cargos.js
// Quais cargos compõem a equipe gestora. O `vinculo.papel` é texto
// livre, então sem esta lista o sistema não sabe responder "esta
// pessoa é gestora?" — e é essa resposta que decide quem aparece na
// grade por padrão.
//
// A tela mora aqui, e não em Servidores, porque Horários é o único
// consumidor e Servidores não tem hoje nenhuma superfície de gestão
// de cargos. O MODEL mora em servidores/vinculos.model.js, que é o
// dono do domínio.
// ============================================================
import { getCargos, getCargosGestao, definirCargoGestao } from '../../servidores/vinculos.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { loading, erroBox } from '../../../shared/ui/feedback.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { toast } from '../../../shared/ui/toast.js';

export async function abrirCargos({ recarregar }) {
  abrirDrawer(`
    ${drawerHead('Equipe gestora', 'Quais cargos entram na grade e na cobertura')}
    <div class="drawer-body">
      <p class="form-hint">Cargo que não estiver ligado aqui não aparece por padrão
        na grade da escola nem entra no cálculo da cobertura. Ele continua podendo
        ser acrescentado escola a escola.</p>
      <div id="cg-lista">${loading()}</div>
    </div>`);

  const box = document.getElementById('cg-lista');
  let cargos = [], gestao = new Set();
  try { [cargos, gestao] = await Promise.all([getCargos(), getCargosGestao()]); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  box.innerHTML = cargos.length
    ? `<div class="cg-linhas">${cargos.map(c => `
        <label class="switch cg-linha">
          <input type="checkbox" data-cargo="${esc(c)}" ${gestao.has(c) ? 'checked' : ''} />
          <span class="switch-trilho" aria-hidden="true"></span>
          <span class="switch-txt">${esc(c)}</span>
        </label>`).join('')}</div>`
    : `<p class="form-hint">Nenhum cargo em uso ainda. Cadastre um vínculo em Servidores.</p>`;

  box.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cargo]'); if (!inp) return;
    inp.disabled = true;
    try {
      await definirCargoGestao(inp.dataset.cargo, inp.checked);
      toast({ titulo: 'Equipe gestora atualizada', texto: inp.dataset.cargo, tipo: 'sucesso' });
      await recarregar();
    } catch (err) {
      inp.checked = !inp.checked;      // desfaz o que o banco recusou
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    } finally { inp.disabled = false; }
  });
}
```

- [ ] **Step 3: Botão na casca de Horários**

Em `horarios.view.js`, na `tabbar`, à direita, só quando `podeEditar`:

```js
    ${podeEditar ? `<button type="button" class="mini-btn" id="h-cargos"
        title="Quais cargos são equipe gestora">${ico('equipe')} Equipe gestora</button>` : ''}
```

E o listener, com `import()` dinâmico para a gaveta não pesar em quem nunca a abre:

```js
  document.getElementById('h-cargos')?.addEventListener('click', async () => {
    const { abrirCargos } = await import('./views/cargos.js');
    abrirCargos({ recarregar: renderAba });
  });
```

- [ ] **Step 4: Verificar no navegador**

Com dev-local: abrir a gaveta, ligar e desligar um cargo, conferir o toast e que a grade recarrega. Sem a migration rodada, a lista deve abrir vazia com a dica, sem erro no console.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): cargos de equipe gestora configuraveis"
```

---

## Task 5: Componente de busca por palavras-chave

**Files:**
- Create: `src/shared/ui/busca-selecao.js`
- Create: `tests/busca.test.mjs`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `esc`, `norm` (de `shared/dom.js`), `ico`.
- Produces:
  - `filtrarOpcoes(opcoes, termo) => opcoes[]` - puro, exportado para teste;
  - `criarBuscaSelecao(el, { opcoes, valor, placeholder, vazioTexto, onChange }) => { definirOpcoes(lista), definirValor(id), valorAtual() }`.
  - Formato de opção: `{ id: string, rotulo: string, detalhe?: string, busca?: string }`. `busca` é o texto extra contra o qual casar (apelido, cargo) sem aparecer no rótulo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/busca.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarOpcoes } from '../src/shared/ui/busca-selecao.js';

const OPCOES = [
  { id: '1', rotulo: 'Escola Exemplo Alfa', detalhe: 'EMEF' },
  { id: '2', rotulo: 'Escola Exemplo Beta', detalhe: 'EMEI' },
  { id: '3', rotulo: 'Centro Exemplo Gama', detalhe: 'CEI', busca: 'creche' },
];

test('termo vazio devolve tudo', () => {
  assert.equal(filtrarOpcoes(OPCOES, '').length, 3);
  assert.equal(filtrarOpcoes(OPCOES, '   ').length, 3);
});

test('casa por pedaco do rotulo', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'beta').map(o => o.id), ['2']);
});

test('ignora acento e caixa', () => {
  const lista = [{ id: '1', rotulo: 'Educação Física' }];
  assert.equal(filtrarOpcoes(lista, 'EDUCACAO').length, 1);
  assert.equal(filtrarOpcoes(lista, 'fisica').length, 1);
});

test('todas as palavras precisam casar, em qualquer ordem', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'alfa escola').map(o => o.id), ['1']);
  assert.deepEqual(filtrarOpcoes(OPCOES, 'escola gama').map(o => o.id), []);
});

test('casa tambem contra o detalhe e o campo busca', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'emei').map(o => o.id), ['2']);
  assert.deepEqual(filtrarOpcoes(OPCOES, 'creche').map(o => o.id), ['3']);
});

test('sem resultado devolve lista vazia, nunca undefined', () => {
  assert.deepEqual(filtrarOpcoes(OPCOES, 'zzz'), []);
});

test('lista ausente nao lanca', () => {
  assert.deepEqual(filtrarOpcoes(undefined, 'a'), []);
  assert.deepEqual(filtrarOpcoes(null, ''), []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/busca.test.mjs
```

Esperado: FAIL - módulo não encontrado.

- [ ] **Step 3: Escrever `src/shared/ui/busca-selecao.js`**

```js
// ============================================================
// FundHub — shared/ui/busca-selecao.js
// Escolha por BUSCA, não por rolagem. Um <select> com 144 escolas ou
// com o cadastro inteiro de servidores obriga a pessoa a saber onde o
// item está na lista; um campo que filtra enquanto se digita só
// exige que ela saiba o nome.
//
// É componente JS e não classe CSS (R12) porque tem estado (o termo,
// o item destacado), teclado (setas, Enter, Esc) e gestão de foco.
//
// Opção: { id, rotulo, detalhe?, busca? }
//   rotulo  — o que aparece e o que fica no campo quando escolhido;
//   detalhe — texto secundário na lista (cargo, segmento);
//   busca   — texto extra contra o qual casar sem aparecer (apelido).
// ============================================================
import { esc, norm } from '../dom.js';
import { ico } from './icones.js';

// Todas as palavras do termo precisam casar, em qualquer ordem: quem
// digita "beta exemplo" quer a Escola Exemplo Beta, e a ordem em que
// lembrou das palavras não deve importar.
export function filtrarOpcoes(opcoes, termo) {
  const lista = opcoes || [];
  const palavras = norm(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return [...lista];
  return lista.filter(o => {
    const alvo = norm(`${o.rotulo || ''} ${o.detalhe || ''} ${o.busca || ''}`);
    return palavras.every(p => alvo.includes(p));
  });
}

export function criarBuscaSelecao(el, {
  opcoes = [], valor = '', placeholder = 'Buscar…',
  vazioTexto = 'Nada encontrado', onChange = () => {},
} = {}) {
  let todas = [...opcoes];
  let escolhido = valor || '';
  let destaque = -1;
  let visiveis = [];

  el.innerHTML = `
    <div class="bs">
      <label class="search bs-campo">
        ${ico('buscar')}
        <input type="text" class="bs-input" role="combobox" aria-expanded="false"
               aria-autocomplete="list" autocomplete="off" placeholder="${esc(placeholder)}" />
        <button type="button" class="bs-limpar" aria-label="Limpar" hidden>${ico('fechar', { tam: 14 })}</button>
      </label>
      <ul class="bs-lista" role="listbox" hidden></ul>
    </div>`;

  const input = el.querySelector('.bs-input');
  const lista = el.querySelector('.bs-lista');
  const limpar = el.querySelector('.bs-limpar');

  const rotuloDe = (id) => todas.find(o => o.id === id)?.rotulo || '';

  function pintarCampo() {
    input.value = escolhido ? rotuloDe(escolhido) : '';
    limpar.hidden = !escolhido;
  }

  function abrir(termo) {
    visiveis = filtrarOpcoes(todas, termo);
    destaque = visiveis.length ? 0 : -1;
    lista.innerHTML = visiveis.length
      ? visiveis.map((o, i) => `
          <li class="bs-item ${i === destaque ? 'on' : ''}" role="option"
              aria-selected="${i === destaque}" data-id="${esc(o.id)}">
            <span class="bs-rot">${esc(o.rotulo)}</span>
            ${o.detalhe ? `<span class="bs-det">${esc(o.detalhe)}</span>` : ''}
          </li>`).join('')
      : `<li class="bs-nada">${esc(vazioTexto)}</li>`;
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function fechar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    pintarCampo();
  }

  function escolher(id) {
    escolhido = id;
    fechar();
    onChange(id);
  }

  function mover(passo) {
    if (lista.hidden) { abrir(''); return; }
    if (!visiveis.length) return;
    destaque = (destaque + passo + visiveis.length) % visiveis.length;
    [...lista.querySelectorAll('.bs-item')].forEach((li, i) => {
      li.classList.toggle('on', i === destaque);
      li.setAttribute('aria-selected', String(i === destaque));
    });
    lista.querySelector('.bs-item.on')?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => abrir(''));
  input.addEventListener('input', () => abrir(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Enter') {
      if (!lista.hidden && visiveis[destaque]) { e.preventDefault(); escolher(visiveis[destaque].id); }
    } else if (e.key === 'Escape') { fechar(); input.blur(); }
  });
  lista.addEventListener('mousedown', (e) => {
    // mousedown e não click: o blur do input fecharia a lista antes.
    const li = e.target.closest('.bs-item'); if (!li) return;
    e.preventDefault();
    escolher(li.dataset.id);
  });
  limpar.addEventListener('click', () => escolher(''));
  document.addEventListener('click', (e) => { if (!el.contains(e.target)) fechar(); });

  pintarCampo();

  return {
    definirOpcoes(lst) { todas = [...(lst || [])]; if (!todas.some(o => o.id === escolhido)) escolhido = ''; pintarCampo(); },
    definirValor(id) { escolhido = id || ''; pintarCampo(); },
    valorAtual() { return escolhido; },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/busca.test.mjs
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: CSS em `components.css`**

```css
/* ── Busca com seleção (shared/ui/busca-selecao.js) ────────── */
.bs { position: relative; flex: 1 1 260px; }
.bs-campo { width: 100%; }
.bs-limpar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: 0; border-radius: 6px;
  background: none; color: var(--muted); cursor: pointer;
}
.bs-limpar:hover { background: var(--surface-3); color: var(--text); }
.bs-lista {
  position: absolute; z-index: 60; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 300px; overflow-y: auto; margin: 0; padding: 4px; list-style: none;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 11px; box-shadow: var(--shadow);
}
.bs-item {
  display: flex; align-items: baseline; gap: 8px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
}
.bs-item.on { background: var(--surface-3); }
.bs-rot { font-size: 14px; }
.bs-det { margin-left: auto; color: var(--muted); font-size: 12px; }
.bs-nada { padding: 14px 10px; color: var(--muted); font-size: 13px; text-align: center; }
@media (pointer: coarse) { .bs-item { min-height: var(--toque); align-items: center; } }
```

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/shared/ui/busca-selecao.js tests/busca.test.mjs src/styles/components.css
git commit -m "feat(ui): componente de busca por palavras-chave"
```

---

## Task 6: Model de exibição por escola

**Files:**
- Modify: `src/modules/horarios/horarios.model.js`

**Interfaces:**
- Consumes: `sb()`, `hasSupabase()`, `emailAtual()`.
- Produces:
  - `getExibicao(unidadeId) => Promise<Array<{ servidor_id, ordem, conta_cobertura }>>`;
  - `salvarOrdem(unidadeId, servidorIds: string[]) => Promise<void>`;
  - `definirCobertura(unidadeId, servidorId, conta: boolean) => Promise<void>`;
  - `limparExibicao(unidadeId) => Promise<void>`.

- [ ] **Step 1: Implementar**

```js
// ── Exibição e cobertura por escola ──────────────────────────
// Sem linha = padrão (exibe se for cargo de gestão, conta na
// cobertura, ordem alfabética). Ver ordenarParaGrade.
export async function getExibicao(unidadeId) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_exibicao')
    .select('servidor_id, ordem, conta_cobertura')
    .eq('unidade_id', unidadeId).order('ordem');
  if (error) {
    if (error.code === '42P01') return [];      // migration 024 ainda não rodou
    throw error;
  }
  return data || [];
}

// Grava a ordem inteira de uma vez. As duas armadilhas do upsert em
// lote do PostgREST valem aqui: todas as linhas precisam ter as
// MESMAS chaves (nada de `undefined`, que some do JSON e quebra o
// lote), e onConflict só infere índice único simples.
export async function salvarOrdem(unidadeId, servidorIds) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const cobertura = new Map(atual.map(e => [e.servidor_id, e.conta_cobertura]));
  const quem = await emailAtual();
  const rows = servidorIds.map((servidor_id, ordem) => ({
    unidade_id: unidadeId,
    servidor_id,
    ordem,
    conta_cobertura: cobertura.has(servidor_id) ? cobertura.get(servidor_id) : true,
    atualizado_por: quem,
  }));
  if (!rows.length) return;
  const { error } = await sb().from('horario_exibicao')
    .upsert(rows, { onConflict: 'unidade_id,servidor_id' });
  if (error) throw error;
}

export async function definirCobertura(unidadeId, servidorId, conta) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const linha = atual.find(e => e.servidor_id === servidorId);
  const row = {
    unidade_id: unidadeId,
    servidor_id: servidorId,
    ordem: linha ? linha.ordem : atual.length,
    conta_cobertura: Boolean(conta),
    atualizado_por: await emailAtual(),
  };
  const { error } = await sb().from('horario_exibicao')
    .upsert(row, { onConflict: 'unidade_id,servidor_id' });
  if (error) throw error;
}

// "Voltar à ordem padrão": apaga as linhas da unidade e a grade
// recai no alfabético por cargo e nome.
export async function limparExibicao(unidadeId) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('horario_exibicao').delete().eq('unidade_id', unidadeId);
  if (error) throw error;
}
```

- [ ] **Step 2: Conferir o tamanho do model e dividir se passou de 250**

```bash
wc -l src/modules/horarios/horarios.model.js
```

Se passou, extrair a matemática de grade para `src/modules/horarios/grade.model.js` (segundo model público do módulo, como `sate/atividades.model.js`): `posicaoNaBarra`, `marcasDaBarra`, `empilhar`, `contarFaixas`, `lacunasCobertura`, `SERIES`. Atualizar `tests/horarios.test.mjs` e os imports.

- [ ] **Step 3: Commitar**

```bash
node --test tests/
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): exibicao e cobertura configuraveis por escola"
```

---

## Task 7: A grade única

**Files:**
- Create: `src/modules/horarios/views/grade.js`
- Modify: `src/modules/horarios/views/por-escola.js` (reescrita)
- Modify: `src/modules/horarios/horarios.css`
- Modify: `src/styles/tokens.css` (`--serie-1..6`)

**Interfaces:**
- Consumes: `empilhar`, `contarFaixas`, `ordenarParaGrade`, `validarDia`, `lacunasCobertura`, `posicaoNaBarra`, `marcasDaBarra`, `totalDoDia`, `DIAS`, `getBlocos`, `getExibicao`; `getCargosGestao`, `cargoDe`; `criarBuscaSelecao`; `ico`.
- Produces (de `views/grade.js`):
  - `gradeHtml(dias, { linhas, blocosDe, mostrarCobertura }) => string`;
  - `legendaHtml(linhas, { podeEditar }) => string`;
  - `ligarSelecao(root) => void` - clique numa barra destaca o servidor;
  - `selecionado() => string | null`.

- [ ] **Step 1: Tokens de série**

Em `tokens.css`, no `:root` claro:

```css
  /* Série da grade de horários. Dessaturadas de propósito: em repouso
     a grade é quase monocromática e a cor só aparece quando alguém é
     selecionado. Cor aqui AGRUPA, não identifica — quem identifica é
     a legenda. */
  --serie-1: #6d8fd6;
  --serie-2: #6fb3a4;
  --serie-3: #c9a15f;
  --serie-4: #a98cc4;
  --serie-5: #d18f8f;
  --serie-6: #7fa06b;
```

E no bloco escuro, os mesmos seis um pouco mais claros e ainda dessaturados (`#7f9fe0`, `#7fc4b4`, `#d7b070`, `#b99cd4`, `#dd9f9f`, `#8fb07b`).

- [ ] **Step 2: `views/grade.js` - o desenho**

```js
// ============================================================
// FundHub — horarios/views/grade.js
// O desenho da grade: eixo, faixas, cobertura, hachura de
// divergência e a seleção por clique. Não sabe de onde vêm os dados
// nem como salvá-los — recebe linhas prontas e devolve HTML.
//
// Faixa existe porque dois blocos sobrepostos na mesma trilha se
// cobrem, e a grade passa a mentir sobre quem está presente.
// ============================================================
import { empilhar, contarFaixas, validarDia, lacunasCobertura,
  posicaoNaBarra, marcasDaBarra, totalDoDia, paraHora, duracao } from '../horarios.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);

let sel = null;
export const selecionado = () => sel;

// Posição de um intervalo (em minutos) na barra, em % — reusa a
// mesma janela de posicaoNaBarra passando um pseudo-bloco.
const posDoIntervalo = (ini, fim) =>
  posicaoNaBarra({ inicio: paraHora(ini), fim: paraHora(fim) });

export function legendaHtml(linhas, { podeEditar }) {
  return `<div class="hg-legenda" id="hg-legenda">
    ${linhas.map(l => `
      <div class="hg-chip serie-${l.serie + 1} ${podeEditar ? 'arrastavel' : ''}"
           data-servidor="${esc(l.servidor.id)}" ${podeEditar ? 'draggable="true"' : ''}>
        ${podeEditar ? `<span class="hg-pega" aria-hidden="true">${ico('arrastar', { tam: 14 })}</span>` : ''}
        <span class="hg-cor" aria-hidden="true"></span>
        <span class="hg-nome">${esc(l.servidor.nome)}</span>
        <span class="hg-cargo">${esc(l.cargo)}</span>
        <label class="switch radio hg-cob" title="Conta na cobertura da escola">
          <input type="checkbox" data-cobertura="${esc(l.servidor.id)}"
                 ${l.contaCobertura ? 'checked' : ''} ${podeEditar ? '' : 'disabled'} />
          <span class="switch-trilho" aria-hidden="true"></span>
          <span class="switch-txt">cobertura</span>
        </label>
      </div>`).join('')}
  </div>`;
}

export function gradeHtml(dias, { linhas, blocosDe, mostrarCobertura }) {
  const serieDe = new Map(linhas.map(l => [l.servidor.id, l.serie]));
  const nomeDe = new Map(linhas.map(l => [l.servidor.id, l.servidor.nome]));
  const contam = new Set(linhas.filter(l => l.contaCobertura).map(l => l.servidor.id));

  return `<div class="hg-grade">${dias.map(d => {
    const doDia = linhas.flatMap(l => blocosDe(l.servidor.id, d.n));
    const faixas = contarFaixas(doDia);

    const barras = empilhar(doDia).map(({ bloco, faixa }) => {
      const p = posicaoNaBarra(bloco);
      const serie = (serieDe.get(bloco.servidor_id) ?? 0) + 1;
      const nome = nomeDe.get(bloco.servidor_id) || '';
      return `<button type="button" class="hg-bloco serie-${serie}"
        style="left:${p.esquerda}%;width:${p.largura}%;top:${faixa * 26}px"
        data-bloco="${esc(bloco.id)}" data-servidor="${esc(bloco.servidor_id)}"
        title="${esc(nome)} · ${esc(hhmm(bloco.inicio))} às ${esc(hhmm(bloco.fim))}${bloco.obs ? ' · ' + esc(bloco.obs) : ''}">
        <span>${esc(hhmm(bloco.inicio))}–${esc(hhmm(bloco.fim))}</span>
      </button>`;
    }).join('');

    // Hachura por servidor: cada um é validado sozinho, porque a
    // regra de 8h e a de 6h contínuas são da PESSOA, não do dia.
    const marcas = linhas.flatMap(l => {
      const meus = blocosDe(l.servidor.id, d.n);
      return validarDia(meus).map(p => {
        const pos = posDoIntervalo(p.ini, p.fim);
        return `<span class="hg-falha n-${p.nivel}"
          style="left:${pos.esquerda}%;width:${pos.largura}%"
          title="${esc(l.servidor.nome)}: ${esc(p.texto)}"></span>`;
      });
    }).join('');

    const lacunas = mostrarCobertura
      ? lacunasCobertura(doDia.filter(b => contam.has(b.servidor_id)))
      : [];
    const tira = mostrarCobertura
      ? `<div class="hg-cobertura">${lacunas.map(l => {
          const pos = posDoIntervalo(l.ini, l.fim);
          return `<span class="hg-lacuna" style="left:${pos.esquerda}%;width:${pos.largura}%"
            title="Sem ninguém entre ${paraHora(l.ini)} e ${paraHora(l.fim)}"></span>`;
        }).join('')}</div>`
      : '';

    return `<div class="hg-linha" data-dia="${d.n}">
      <div class="hg-dia">${esc(d.curto)}</div>
      <div class="hg-track" style="height:${faixas * 26 + 4}px">
        ${eixo()}${barras}${marcas}
      </div>
      ${tira}
      <div class="hg-info">${
        doDia.length ? `<b>${duracao(totalDoDia(doDia))}</b>` : vazio('sem jornada')
      }</div>
    </div>`;
  }).join('')}</div>`;
}

function eixo() {
  return marcasDaBarra().map(m =>
    `<span class="hg-marca" style="left:${m.pos}%"><i></i><em>${esc(m.hora.slice(0, 2))}</em></span>`).join('');
}

// Clicar numa barra destaca o servidor dela e esmaece o resto. É o
// que permite a cor ficar dessaturada em repouso: ela só precisa
// distinguir quando alguém está procurando alguém.
export function ligarSelecao(root) {
  root.addEventListener('click', (e) => {
    const barra = e.target.closest('.hg-bloco');
    const chip = e.target.closest('.hg-chip');
    const alvo = barra?.dataset.servidor || chip?.dataset.servidor || null;
    if (!alvo && !e.target.closest('.hg-grade, .hg-legenda')) { aplicar(root, null); return; }
    if (!alvo) return;
    aplicar(root, sel === alvo ? null : alvo);
  });
}

function aplicar(root, id) {
  sel = id;
  root.classList.toggle('tem-selecao', Boolean(id));
  root.querySelectorAll('[data-servidor]').forEach(el =>
    el.classList.toggle('sel', el.dataset.servidor === id));
}
```

- [ ] **Step 3: Reescrever `views/por-escola.js`**

A view fica responsável só por: escolher a escola (agora por busca), carregar, montar, ligar eventos. O desenho está em `grade.js`, a matemática no model.

```js
// ============================================================
// FundHub — horarios/views/por-escola.js
// Aba "Por escola": escolhida a unidade, UMA grade com a semana de
// todos os servidores exibidos, faixas para os blocos que se
// sobrepõem, tira de cobertura sob cada dia e a divergência marcada
// no minuto exato.
//
// A cobertura é regra de ESCOLA — a sede da SME não entra nela.
// ============================================================
import { DIAS, getBlocos, getExibicao, salvarOrdem, definirCobertura,
  limparExibicao, ordenarParaGrade, COBERTURA_INICIO, COBERTURA_FIM } from '../horarios.model.js';
import { getServidoresDaUnidade } from '../../servidores/servidores.model.js';
import { getCargosGestao, rotulaCargo } from '../../servidores/vinculos.model.js';
import { vinculosAbertos } from '../../servidores/servidores.model.js';
import { getUnidades } from '../../escolas/escolas.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';
import { gradeHtml, legendaHtml, ligarSelecao } from './grade.js';
import { abrirJornada } from './jornada.js';

// … estado de módulo como hoje (unidades, idxUnidades, seg, servidores,
// blocos, exibicao, cargosGestao, unidadeId, ultimoParam, ctxAtual) …
```

Pontos obrigatórios da reescrita:

1. **O `<select id="h-uni">` sai**; entra `criarBuscaSelecao` no mesmo lugar, alimentado com `{ id, rotulo: l.nome, detalhe: l.tipo === 'sede' ? 'SME' : '', busca: l.apelido }`, respeitando o filtro de segmento como hoje.
2. **`cargoDe(servidor)`** para esta unidade: `rotulaCargo(vinculosAbertos(s).find(v => v.unidade_id === unidadeId)?.papel || '')`.
3. **`linhas`** vem de `ordenarParaGrade(servidores, { exibicao, cargosGestao, cargoDe })`, filtrado por `exibir`.
4. **Servidor vinculado mas não exibido** vira uma lista recolhida abaixo da grade, com botão de acrescentar - é o item "inserir a grade de usuários vinculados à escola":

```js
function naoExibidosHtml(fora) {
  if (!fora.length) return '';
  return `<details class="hg-fora">
    <summary>${fora.length} servidor(es) vinculado(s) fora da grade</summary>
    ${fora.map(l => `<div class="hg-fora-item">
      <span>${esc(l.servidor.nome)}</span>
      <span class="hg-cargo">${esc(l.cargo)}</span>
      <button type="button" class="mini-btn" data-incluir="${esc(l.servidor.id)}">
        ${ico('adicionar')} Incluir na grade</button>
    </div>`).join('')}
  </details>`;
}
```

`data-incluir` chama `definirCobertura(unidadeId, id, true)` (que cria a linha e portanto passa a exibir) e recarrega.

5. **`mostrarCobertura`** é `local?.tipo !== 'sede'`, como hoje.
6. **Clicar numa barra** abre a seleção (`ligarSelecao`); **clicar no lápis do chip** ou num botão "editar jornada" abre `abrirJornada`. Barra e edição não podem ser o mesmo clique - hoje a barra abre o formulário; a partir daqui a barra **seleciona**, e a edição vem de um botão explícito por servidor no chip da legenda. Isso é o que torna o item 4 do pedido possível.

- [ ] **Step 4: CSS em `horarios.css`**

```css
/* ── Grade única (views/grade.js) ─────────────────────────── */
.hg-legenda { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.hg-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 999px;
  background: var(--surface-2); font-size: 13px;
}
.hg-chip.arrastavel { cursor: grab; }
.hg-chip.arrastando { opacity: .4; }
.hg-chip .hg-cor { width: 10px; height: 10px; border-radius: 50%; background: var(--serie); }
.hg-chip .hg-cargo { color: var(--muted); font-size: 12px; }
.hg-chip.sel { border-color: var(--serie); box-shadow: 0 0 0 2px color-mix(in srgb, var(--serie) 30%, transparent); }

.serie-1 { --serie: var(--serie-1); }
.serie-2 { --serie: var(--serie-2); }
.serie-3 { --serie: var(--serie-3); }
.serie-4 { --serie: var(--serie-4); }
.serie-5 { --serie: var(--serie-5); }
.serie-6 { --serie: var(--serie-6); }

.hg-grade { display: flex; flex-direction: column; gap: 10px; }
.hg-linha { display: grid; grid-template-columns: 38px 1fr 92px; align-items: start; gap: 8px; }
.hg-dia { padding-top: 4px; color: var(--muted); font-size: 12px; font-weight: 700; }
.hg-track { position: relative; border-radius: 8px; background: var(--surface-2); }
.hg-bloco {
  position: absolute; height: 22px; padding: 0 6px;
  border: 0; border-radius: 6px;
  /* Em repouso a cor é fraca: a grade fica quase monocromática e só
     ganha cor quando alguém é selecionado. */
  background: color-mix(in srgb, var(--serie) 45%, var(--surface));
  color: var(--text); font-size: 11px; line-height: 22px;
  overflow: hidden; white-space: nowrap; text-align: left; cursor: pointer;
}
.hg-bloco:hover { background: color-mix(in srgb, var(--serie) 65%, var(--surface)); }
.tem-selecao .hg-bloco { opacity: .25; }
.tem-selecao .hg-bloco.sel { opacity: 1; background: var(--serie); color: var(--on-cor); }
.tem-selecao .hg-chip { opacity: .45; }
.tem-selecao .hg-chip.sel { opacity: 1; }

/* Divergência: hachura sobre os minutos exatos, não texto embaixo. */
.hg-falha {
  position: absolute; top: 0; bottom: 0; pointer-events: none; border-radius: 4px;
}
.hg-falha.n-aviso {
  background: repeating-linear-gradient(45deg,
    color-mix(in srgb, var(--accent) 40%, transparent) 0 5px, transparent 5px 10px);
  border-top: 2px solid var(--accent);
}
.hg-falha.n-erro {
  background: repeating-linear-gradient(45deg,
    color-mix(in srgb, var(--danger) 45%, transparent) 0 5px, transparent 5px 10px);
  border-top: 2px solid var(--danger);
}

.hg-cobertura { grid-column: 2; position: relative; height: 6px; margin-top: 2px;
  border-radius: 3px; background: color-mix(in srgb, var(--ok) 45%, var(--surface-3)); }
.hg-lacuna { position: absolute; top: 0; bottom: 0; background: var(--danger); border-radius: 3px; }
.hg-info { text-align: right; font-size: 12px; }

.hg-marca { position: absolute; top: 0; bottom: 0; }
.hg-marca i { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--border); }
.hg-marca em { position: absolute; top: -14px; color: var(--muted); font-size: 10px; font-style: normal; }

@media (max-width: 719px) {
  .hg-linha { grid-template-columns: 30px 1fr; }
  .hg-info { grid-column: 2; text-align: left; }
  .hg-grade { overflow-x: auto; }
}
```

**Cuidado:** `.hg-track` precisa de `padding-top` suficiente para as marcas de hora (`em` em `top: -14px`) não serem cortadas - dar `margin-top: 16px` à `.hg-grade`.

- [ ] **Step 5: Verificar no navegador**

Com dev-local e fixtures de blocos (inventar 3 servidores e blocos que se sobreponham). Conferir:
- escola escolhida por busca (digitar parte do nome);
- dias com 1, 2 e 3 faixas;
- clicar numa barra destaca só aquele servidor, o resto esmaece, o chip dele ganha borda;
- clicar de novo desfaz;
- hachura amarela exatamente sobre o trecho que passa das 6h;
- tira de cobertura com lacuna vermelha;
- em 375px, a grade rola na horizontal sem o corpo da página rolar junto.

- [ ] **Step 6: Commitar**

```bash
node --test tests/
python .claude/scripts/verificar_arquitetura.py
wc -l src/modules/horarios/views/*.js
git add -A && git diff --cached --stat
git commit -m "feat(horarios): grade unica por escola com faixas, series e divergencia marcada"
```

---

## Task 8: Gaveta da jornada semanal

**Files:**
- Create: `src/modules/horarios/views/jornada.js`
- Delete: `src/modules/horarios/views/bloco.js`
- Modify: `src/modules/horarios/views/por-servidor.js` (usa a gaveta nova)

**Interfaces:**
- Consumes: `DIAS`, `getBlocos`, `criarBloco`, `atualizarBloco`, `excluirBloco`, `validarDia`, `totalDoDia`, `duracao`; `drawer.js`; `confirmar`; `toast`; `ico`.
- Produces: `abrirJornada({ servidor, unidadeId, blocos, recarregar }) => void`.

**Mudança de comportamento:** a gaveta deixa de editar um bloco e passa a editar a **semana inteira** daquele servidor naquela escola. Início e fim nascem **vazios**. Sobreposição impede o salvamento; o resto marca.

- [ ] **Step 1: Escrever `views/jornada.js`**

```js
// ============================================================
// FundHub — horarios/views/jornada.js
// A semana inteira de UM servidor em UMA escola, numa gaveta só.
// Antes era um bloco por vez (views/bloco.js), e montar a jornada de
// um gestor do zero custava cinco aberturas e dez cliques.
//
// Os campos de hora nascem VAZIOS. Antes vinham com 07:00/13:00
// chumbados, o que induzia a pessoa a aceitar um horário que não era
// o dela — pior que campo vazio, porque parece uma resposta.
//
// Sobreposição impede o salvamento; carga acima de 8h e mais de 6h
// contínuas ficam marcados e deixam salvar. Ver .claude/rules/dados.md.
// ============================================================
import { DIAS, criarBloco, atualizarBloco, excluirBloco, getBlocos,
  validarDia, totalDoDia, duracao } from '../horarios.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);
let estado = null;   // { servidor, unidadeId, dias: { [n]: linhas[] }, recarregar }

// Uma linha é { id?, inicio, fim, obs, excluir? }. `id` ausente = nova.
export function abrirJornada({ servidor, unidadeId, blocos, recarregar }) {
  const dias = {};
  for (const d of DIAS) {
    dias[d.n] = blocos
      .filter(b => b.servidor_id === servidor.id && b.dia_semana === d.n)
      .map(b => ({ id: b.id, inicio: hhmm(b.inicio), fim: hhmm(b.fim), obs: b.obs || '' }));
  }
  estado = { servidor, unidadeId, dias, recarregar };

  abrirDrawer(`
    ${drawerHead('Jornada da semana', esc(servidor.nome))}
    <div class="drawer-body">
      <form id="hj-form" class="esc-form">
        <div id="hj-dias"></div>
        <div class="form-foot">
          <span id="hj-msg" class="auth-msg"></span>
          <button type="submit" id="hj-save" class="btn-primary">Salvar jornada</button>
        </div>
      </form>
    </div>`);

  pintar();
  document.getElementById('hj-form').addEventListener('submit', salvar);
}

function pintar() {
  const box = document.getElementById('hj-dias');
  box.innerHTML = DIAS.map(d => {
    const linhas = estado.dias[d.n].filter(l => !l.excluir);
    const problemas = validarDia(linhas.filter(l => l.inicio && l.fim));
    const total = totalDoDia(linhas.filter(l => l.inicio && l.fim));
    return `<fieldset class="form-grupo hj-dia">
      <legend>${esc(d.nome)} ${total ? `<span class="hj-total">${esc(duracao(total))}</span>` : ''}</legend>
      <div class="hj-linhas">
        ${linhas.map((l, i) => `
          <div class="hj-linha" data-dia="${d.n}" data-i="${i}">
            <input type="time" class="hj-ini" value="${esc(l.inicio)}" aria-label="Início" />
            <span class="hj-ate">às</span>
            <input type="time" class="hj-fim" value="${esc(l.fim)}" aria-label="Fim" />
            <input type="text" class="hj-obs" value="${esc(l.obs)}" placeholder="observação (opcional)" />
            <button type="button" class="mini-btn no hj-del" aria-label="Remover bloco">${ico('excluir', { tam: 14 })}</button>
          </div>`).join('')
          || `<p class="form-hint">Sem jornada nesta ${esc(d.nome.toLowerCase())}.</p>`}
      </div>
      <button type="button" class="mini-btn hj-add" data-dia="${d.n}">${ico('adicionar', { tam: 14 })} bloco</button>
      ${problemas.map(p => `<p class="hj-prob n-${p.nivel}">
        ${ico(p.nivel === 'erro' ? 'erro' : 'atencao', { tam: 14 })} ${esc(p.texto)}</p>`).join('')}
    </fieldset>`;
  }).join('');

  box.querySelectorAll('.hj-add').forEach(b => b.addEventListener('click', () => {
    // Campos vazios de propósito — ver o cabeçalho deste arquivo.
    estado.dias[Number(b.dataset.dia)].push({ inicio: '', fim: '', obs: '' });
    pintar();
  }));
  box.querySelectorAll('.hj-del').forEach(b => b.addEventListener('click', () => {
    const linha = b.closest('.hj-linha');
    const dia = Number(linha.dataset.dia);
    const alvo = estado.dias[dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
    if (alvo.id) alvo.excluir = true;               // já existe no banco
    else estado.dias[dia] = estado.dias[dia].filter(l => l !== alvo);
    pintar();
  }));
  // Redesenha ao mudar a hora para os avisos acompanharem o que se digita.
  box.addEventListener('change', (e) => {
    const linha = e.target.closest('.hj-linha'); if (!linha) return;
    const dia = Number(linha.dataset.dia);
    const alvo = estado.dias[dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
    alvo.inicio = linha.querySelector('.hj-ini').value;
    alvo.fim = linha.querySelector('.hj-fim').value;
    alvo.obs = linha.querySelector('.hj-obs').value;
    pintar();
  });
}

async function salvar(e) {
  e.preventDefault();
  const msg = document.getElementById('hj-msg');
  msg.className = 'auth-msg'; msg.textContent = '';

  // Validação de campo: inline, junto do formulário.
  for (const d of DIAS) {
    const linhas = estado.dias[d.n].filter(l => !l.excluir);
    for (const l of linhas) {
      if (!l.inicio || !l.fim) {
        msg.classList.add('err');
        msg.textContent = `${d.nome}: informe início e fim de todos os blocos.`;
        return;
      }
      if (l.fim <= l.inicio) {
        msg.classList.add('err');
        msg.textContent = `${d.nome}: o fim precisa ser depois do início.`;
        return;
      }
    }
    const erro = validarDia(linhas).find(p => p.nivel === 'erro');
    if (erro) { msg.classList.add('err'); msg.textContent = `${d.nome}: ${erro.texto}`; return; }
  }

  const btn = document.getElementById('hj-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    for (const d of DIAS) {
      for (const l of estado.dias[d.n]) {
        const payload = {
          servidor_id: estado.servidor.id,
          unidade_id: estado.unidadeId,
          dia_semana: d.n,
          inicio: l.inicio,
          fim: l.fim,
          obs: l.obs.trim() || null,
        };
        if (l.excluir && l.id) await excluirBloco(l.id);
        else if (l.id) await atualizarBloco(l.id, payload);
        else if (!l.excluir) await criarBloco(payload);
      }
    }
    fecharDrawer();
    await estado.recarregar();
    toast({ titulo: 'Jornada salva', texto: estado.servidor.nome, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível salvar a jornada', texto: err.message || String(err), tipo: 'erro' });
    btn.disabled = false; btn.textContent = 'Salvar jornada';
  }
}
```

**Nota sobre o `ano`:** `bloco.js` gravava `ano: new Date().getFullYear()`. A coluna continua no banco como carimbo e tem `default 2026`; deixar o banco preencher, e não construir data na view (R8 - a view não faz aritmética de data para persistir).

- [ ] **Step 2: Apagar `views/bloco.js` e trocar os chamadores**

```bash
git rm src/modules/horarios/views/bloco.js
grep -rn "bloco.js\|formBloco" src/
```

`por-escola.js` (Task 7) e `por-servidor.js` passam a chamar `abrirJornada`.

- [ ] **Step 3: CSS**

```css
.hj-dia legend { display: flex; align-items: baseline; gap: 8px; }
.hj-total { color: var(--muted); font-size: 12px; font-weight: 400; }
.hj-linhas { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.hj-linha { display: grid; grid-template-columns: auto auto auto 1fr auto; align-items: center; gap: 6px; }
.hj-ate { color: var(--muted); font-size: 12px; }
.hj-prob { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; }
.hj-prob.n-erro { color: var(--danger); }
.hj-prob.n-aviso { color: var(--accent); }
@media (max-width: 559px) {
  .hj-linha { grid-template-columns: 1fr 1fr auto; }
  .hj-ate { display: none; }
  .hj-obs { grid-column: 1 / -1; }
}
```

- [ ] **Step 4: Verificar no navegador**

Com dev-local: abrir a jornada de um servidor, acrescentar blocos em três dias, conferir que os campos de hora **nascem vazios**, que o total do dia acompanha a digitação, que sobrepor dois blocos no mesmo dia impede o salvamento com mensagem inline, que passar de 8h deixa salvar e mostra o aviso, que remover um bloco existente e salvar o apaga.

- [ ] **Step 5: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): gaveta edita a semana inteira, com campos de hora vazios"
```

---

## Task 9: Arrastar para reordenar

**Files:**
- Modify: `src/modules/horarios/views/por-escola.js`
- Modify: `src/modules/horarios/horarios.css`

**Interfaces:**
- Consumes: `salvarOrdem`, `limparExibicao`, `definirCobertura`; `toast`; `confirmar`.
- Produces: nenhuma API nova.

- [ ] **Step 1: Arrasto na legenda**

O arrasto é na **legenda**, não nas barras: arrastar uma barra significaria mover o horário, que é outra coisa. Reordenar a legenda reordena as faixas e as cores.

```js
function ligarArrasto(box) {
  if (!ctxAtual.podeEditar) return;
  const legenda = box.querySelector('#hg-legenda');
  if (!legenda) return;
  let origem = null;

  legenda.addEventListener('dragstart', (e) => {
    origem = e.target.closest('.hg-chip'); if (!origem) return;
    origem.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox só inicia o arrasto se houver dado no dataTransfer.
    e.dataTransfer.setData('text/plain', origem.dataset.servidor);
  });
  legenda.addEventListener('dragend', () => {
    origem?.classList.remove('arrastando'); origem = null;
  });
  legenda.addEventListener('dragover', (e) => {
    if (!origem) return;
    e.preventDefault();
    const alvo = e.target.closest('.hg-chip');
    if (!alvo || alvo === origem) return;
    const r = alvo.getBoundingClientRect();
    const depois = (e.clientX - r.left) > r.width / 2;
    legenda.insertBefore(origem, depois ? alvo.nextSibling : alvo);
  });
  legenda.addEventListener('drop', async (e) => {
    e.preventDefault();
    const ids = [...legenda.querySelectorAll('.hg-chip')].map(c => c.dataset.servidor);
    try {
      await salvarOrdem(unidadeId, ids);
      toast({ titulo: 'Ordem salva', tipo: 'sucesso' });
      await carregar();
    } catch (err) {
      toast({ titulo: 'Não foi possível salvar a ordem', texto: err.message || String(err), tipo: 'erro' });
      await carregar();      // desfaz o que o banco recusou
    }
  });
}
```

- [ ] **Step 2: Toggle de cobertura**

```js
  box.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cobertura]'); if (!inp) return;
    inp.disabled = true;
    try {
      await definirCobertura(unidadeId, inp.dataset.cobertura, inp.checked);
      await carregar();
    } catch (err) {
      inp.checked = !inp.checked;
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    } finally { inp.disabled = false; }
  });
```

- [ ] **Step 3: Botão "Voltar à ordem padrão"**

Na barra acima da legenda, só quando `podeEditar` e quando houver alguma linha de exibição:

```js
`<button type="button" class="mini-btn" id="hg-reset">${ico('atualizar', { tam: 14 })} Voltar à ordem padrão</button>`
```

```js
  document.getElementById('hg-reset')?.addEventListener('click', async () => {
    const ok = await confirmar('Voltar à ordem padrão desta escola?', {
      detalhe: 'A grade volta a mostrar só os cargos de equipe gestora, em ordem alfabética, todos contando na cobertura.',
      textoOk: 'Voltar ao padrão',
    });
    if (!ok) return;
    try {
      await limparExibicao(unidadeId);
      toast({ titulo: 'Ordem restaurada', tipo: 'sucesso' });
      await carregar();
    } catch (err) {
      toast({ titulo: 'Não foi possível restaurar', texto: err.message || String(err), tipo: 'erro' });
    }
  });
```

- [ ] **Step 4: Alternativa por teclado**

Arrasto não é acessível por teclado. Cada chip ganha, quando `podeEditar`, dois botões pequenos:

```js
`<button type="button" class="hg-mover" data-mover="${esc(l.servidor.id)}:-1" aria-label="Mover ${esc(l.servidor.nome)} para a esquerda">${ico('chevron', { tam: 12, classe: 'gira-90' })}</button>`
```

O handler reordena o array de ids e chama `salvarOrdem`. `.gira-90 { transform: rotate(90deg); }` e `-90` para o outro lado.

- [ ] **Step 5: Verificar no navegador**

Arrastar um chip e soltar: a ordem muda, o toast aparece, as cores acompanham a nova posição e recarregar a página mantém a ordem. Desligar a cobertura de um servidor: a tira de cobertura recalcula. "Voltar à ordem padrão": some quem não é gestão. Setas do teclado funcionam sem mouse.

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add -A && git diff --cached --stat
git commit -m "feat(horarios): ordem arrastavel e cobertura por servidor, gravadas na escola"
```

---

## Task 10: Adoção da busca e fechamento

**Files:**
- Modify: `src/modules/usuarios/views/lista.js` (select de servidor)
- Modify: `src/modules/servidores/views/vinculo.js` (select de escola)
- Modify: `src/modules/horarios/views/por-servidor.js` (select de servidor)
- Modify: `src/core/config.js`, `CHANGELOG.md`

- [ ] **Step 1: `usuarios/views/lista.js`**

O `<select id="f-servidor">` com o cadastro inteiro da rede vira busca. Trocar o `optsServidor` por uma `<div id="f-servidor-box"></div>` e, depois de `abrirDrawer`:

```js
  const buscaServidor = criarBuscaSelecao(document.getElementById('f-servidor-box'), {
    opcoes: [...servidores]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(s => ({ id: s.id, rotulo: s.nome, detalhe: s.cargo || '', busca: s.apelido || '' })),
    valor: p?.servidor_id || '',
    placeholder: 'Buscar servidor pelo nome…',
    vazioTexto: 'Nenhum servidor com esse nome',
  });
```

Em `salvar()`, `servidor_id: document.getElementById('f-servidor').value || null` vira `servidor_id: buscaServidor.valorAtual() || null` - passar `buscaServidor` para `salvar` do mesmo jeito que `lerSegs` e `lerExcecoes` já são passados.

O `<option>` "— sem vínculo com cadastro funcional —" some: o campo vazio já significa isso, e o botão de limpar do componente devolve a ele.

- [ ] **Step 2: `servidores/views/vinculo.js` e `horarios/views/por-servidor.js`**

Mesmo padrão. Em `por-servidor.js`, **o rótulo é o nome completo**, nunca o apelido - é o que consta do ofício. O apelido vai no campo `busca`, para continuar encontrando quem só é conhecido por ele.

- [ ] **Step 3: Rodar tudo**

```bash
node --test tests/
python .claude/scripts/verificar_arquitetura.py
wc -l src/modules/horarios/*.js src/modules/horarios/views/*.js
```

- [ ] **Step 4: Subir a versão e escrever o CHANGELOG**

`CONFIG.versao` → `0.13.0` (MINOR: mudança de modelo).

```markdown
## 0.13.0

- A tela de horários por escola foi refeita. Agora a semana inteira aparece numa
  grade só, com os horários de todos os servidores lado a lado. Quando dois
  horários acontecem ao mesmo tempo, eles ficam em linhas separadas em vez de um
  cobrir o outro.
- Clicando num horário, o sistema destaca todos os blocos daquela pessoa no dia
  e mostra o nome dela.
- Quando um horário passa dos limites, o pedaço problemático fica marcado sobre
  o próprio horário, em vez de um aviso solto embaixo.
- Passar de 8 horas num dia deixou de impedir o lançamento: agora fica marcado
  como aviso. Horários sobrepostos da mesma pessoa continuam bloqueados.
- É possível escolher quais servidores aparecem na grade da escola e quais
  entram no cálculo da cobertura, e arrastar para mudar a ordem. A escolha vale
  para todo mundo que abrir aquela escola.
- Ao cadastrar horários, a semana inteira é editada de uma vez, e os campos de
  hora não vêm mais preenchidos.
- Escolher escola ou servidor passou a ser por busca: digite parte do nome.
- Uma tela de administração define quais cargos compõem a equipe gestora.
```

- [ ] **Step 5: Teste final em tela estreita e console**

375px em todas as abas de Horários, mais Usuários e Servidores (por causa da busca). Tema claro e escuro.

- [ ] **Step 6: Commitar**

```bash
git add -A && git diff --cached
git commit -m "chore: versao 0.13.0 e fecha a rodada da grade de horarios"
```

---

## Verificação final

- [ ] `node --test tests/` verde (icones, toast, cache, horarios, busca).
- [ ] `python .claude/scripts/verificar_arquitetura.py` sem novas violações - conferir R4 (o import Horários → Servidores é novo) e R11 (tamanho de `horarios.model.js` e `por-escola.js`).
- [ ] Migration 024 rodada duas vezes sem erro.
- [ ] RLS conferida nas três tabelas novas; nenhuma policy para `anon`.
- [ ] Sem a migration, a tela abre e avisa o que falta.
- [ ] Escola sem bloco nenhum; escola só com gestores; escola com 8 exibidos (cores repetem sem confundir).
- [ ] Console limpo, tema claro e escuro, 375px.
- [ ] `git diff` da branch lido inteiro à procura de dado real.
