# SATE - Solicitação simplificada: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplificar o modal de nova solicitação do SATE (destino por local, período calculado, responsável e acessibilidade), dar à página Locais um CRUD com mapa Leaflet e permitir à SME conferir o local digitado pela escola.

**Architecture:** SPA estática sem build (ES modules servidos direto) + Supabase. Regra de domínio em `*.model.js` (puras testáveis com `node --test`); telas em `views/`; o banco é espelho e barreira (migration 044). Nenhuma view chama `sb()`.

**Tech Stack:** JavaScript ES modules, Postgres/Supabase (SQL aplicado à mão no SQL Editor), `node:test`, Leaflet 1.9.4 via jsDelivr (carregado sob demanda).

**Spec:** `docs/superpowers/specs/2026-09-27-sate-solicitacao-simplificada-design.md` - ler inteira antes de qualquer tarefa.

## Global Constraints

- PT-BR em código, comentário, commit e interface. Commits na branch `dev`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nenhum dado real no repositório (repo público): exemplos usam "Escola Exemplo", "Rua Exemplo", `(00) 00000-0000`.
- Todo valor do banco ou do usuário interpolado em HTML passa por `esc()` (`src/shared/dom.js`), inclusive em atributos.
- View nunca importa `core/supabase.js`; só `*.model.js` atravessa fronteira de módulo; zero ciclos de import.
- Nenhuma cor literal em `src/modules/**` - só `var(--token)`.
- Sem `confirm()/alert()/prompt()`; modais só por `shared/ui/modal.js`, confirmação por `shared/ui/confirmar.js`.
- Data/hora: nada de `toISOString`/`toLocale*` fora de `shared/format.js`.
- View > 400 linhas ou model > 250 linhas precisa ser dividida por superfície (R11).
- Campos de formulário dentro de `.esc-form` (altura e fonte vêm de lá).
- Única dependência nova permitida: Leaflet **1.9.4**, de `https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/`, com SRI, carregado só quando o modal de local abre.
- Rodar antes de cada commit: `node --test tests/*.test.mjs` e `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes).
- Migration idempotente, termina com `select religar_auditoria();` e `select registrar_migration('044', '...');`.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/044_sate_solicitacao_simplificada.sql` | criar | colunas novas, período `integral`, `_sate_periodo`, trajeto provisório, guarda |
| `src/modules/sate/regras.model.js` | modificar | `PERIODOS.integral`, `periodoDe`, `tituloDoPedido`, `responsavelDoPedido`, ordem de fichas |
| `src/modules/sate/sate.model.js` | modificar | reexporta `PERIODOS`; `vincularLocal` |
| `src/modules/sate/disponibilidade.model.js` | modificar | janela/típico `integral`; `trajetoParaVaga`; provisório em `faltaParaConfirmar` |
| `src/modules/sate/sate.config.js` | modificar | `trajeto_provisorio_min` (padrão 60) |
| `src/modules/locais/locais.model.js` | modificar | `numero`/`bairro`; `enderecoCompleto`; `locaisParecidos`; degradação 42703 |
| `src/modules/sate/views/formulario.js` | reescrever | o modal novo |
| `src/modules/sate/views/formulario-destino.js` | criar | grupo DESTINO (busca de local × local livre) |
| `src/modules/sate/views/detalhe.js` | modificar | título, destino, responsável, acessibilidade, "Conferir local", aviso ao confirmar |
| `src/modules/sate/views/conferir-local.js` | criar | modal "Conferir local" |
| `src/modules/sate/views/locais.js` | reescrever | página Locais em cards + modal de local |
| `src/modules/sate/views/mapa-local.js` | criar | carregar Leaflet + mapa com pino arrastável |
| `src/modules/sate/views/fichas.js`, `solicitacoes.js`, `remanejar.js`, `participantes.js` | modificar | exibição e período derivado |
| `src/modules/viagens/viagens.view.js`, `src/modules/dashboard/views/paineis.js` | modificar | título, destino, período `integral` |
| `src/modules/sate/sate.css` | modificar | classes novas (mapa, destino, sugestões) |
| `tests/sate-solicitacao.test.mjs` | criar | testes das funções puras novas |
| `docs/modulos/sate.md`, `CHANGELOG.md`, `CLAUDE.md`, `src/core/config.js` | modificar | entrega |

---

### Task 1: Migration 044

**Files:**
- Create: `supabase/migrations/044_sate_solicitacao_simplificada.sql`
- Reference (copiar e alterar): `supabase/migrations/042_sate_frota_e_disponibilidade.sql` - `_sate_intervalo` (linhas 92-112), `ocupacao_transporte` (173-230), `criar_viagem` (244-331), `fn_sate_guarda_escola` (~395-435)

**Interfaces:**
- Produces (banco): colunas `solicitacao_transporte.destino_numero|destino_bairro|professor_nome|professor_telefone` (text); `solicitacao_participacao.qtd_surdo int not null default 0`, `necessidade_especifica boolean not null default false`; `local.numero|bairro` (text); `periodo` aceita `'integral'`; função `_sate_periodo(int, int) returns text`; config `sate.trajeto_provisorio_min` (padrão 60).

- [ ] **Step 1: Escrever o cabeçalho e as colunas**

```sql
-- ============================================================
-- 044 - SATE: solicitação simplificada (spec 2026-09-27)
-- Destino em partes, responsável pela visita, acessibilidade por
-- escola, período derivado dos horários (com 'integral' = manhã e
-- tarde) e tempo de viagem provisório para local a conferir.
-- Pré-requisito: 042 e 043. Idempotente.
-- ============================================================

alter table solicitacao_transporte
  add column if not exists destino_numero     text,
  add column if not exists destino_bairro     text,
  add column if not exists professor_nome     text,
  add column if not exists professor_telefone text;

alter table solicitacao_participacao
  add column if not exists qtd_surdo              int     not null default 0,
  add column if not exists necessidade_especifica boolean not null default false;

alter table local
  add column if not exists numero text,
  add column if not exists bairro text;

-- O CHECK de periodo nasceu inline na 004 (nome gerado pelo Postgres).
-- Derruba qualquer CHECK de solicitacao_transporte que fale de periodo e
-- recria com 'integral'.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'solicitacao_transporte'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%periodo%' loop
    execute format('alter table solicitacao_transporte drop constraint %I', c);
  end loop;
end $$;
alter table solicitacao_transporte
  add constraint solicitacao_transporte_periodo_check
  check (periodo in ('manha', 'tarde', 'noite', 'integral'));
```

- [ ] **Step 2: `_sate_periodo` e a janela de `integral`**

Regra da spec D4 (minutos desde 00:00): embarque ≥ 1080 → `noite`; ≥ 720 → `tarde`; senão retorno > 720 → `integral`; senão `manha`.

```sql
-- ESPELHO de periodoDe() (regras.model.js). Mudou aqui, mude lá.
create or replace function _sate_periodo(p_emb int, p_ret int) returns text
  language sql immutable set search_path = public as $$
    select case
      when p_emb is null  then null
      when p_emb >= 1080  then 'noite'
      when p_emb >= 720   then 'tarde'
      when p_ret is not null and p_ret > 720 then 'integral'
      else 'manha' end
  $$;
grant execute on function _sate_periodo(int, int) to authenticated;
```

Copiar `_sate_intervalo` da 042 **inteira** (`create or replace`) trocando só as duas linhas de janela:

```sql
  j_ini int := case p_periodo when 'manha' then 0   when 'integral' then 0    when 'tarde' then 720  else 1080 end;
  j_fim int := case p_periodo when 'manha' then 720 when 'integral' then 1080 when 'tarde' then 1080 else 2160 end;
```

- [ ] **Step 3: Gatilho que deriva o período**

```sql
-- O período é CALCULADO (spec D4): a escola não informa, e quem aprova
-- não consegue gravar um período que contradiga os horários. Sem
-- embarque (pedido antigo), fica o que estava.
create or replace function fn_sate_periodo() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.horario_embarque is not null then
    new.periodo := _sate_periodo(_sate_min(new.horario_embarque), _sate_min(new.horario_retorno));
  end if;
  return new;
end $$;

drop trigger if exists trg_sate_periodo on solicitacao_transporte;
create trigger trg_sate_periodo
  before insert or update of horario_embarque, horario_retorno, periodo on solicitacao_transporte
  for each row execute function fn_sate_periodo();
```

(Gatilhos BEFORE disparam em ordem alfabética: `trg_sate_guarda_escola` roda antes de `trg_sate_periodo`. A escola não altera horários, então a guarda não é afetada.)

- [ ] **Step 4: `ocupacao_transporte` com trajeto provisório**

Copiar a função da 042 inteira (`create or replace`, mesmo `grant`) com três mudanças:
1. no CTE `cfg`: `select _sate_conf_int('intervalo_min_periodos', 120) as intervalo, _sate_conf_int('trajeto_provisorio_min', 60) as provisorio`;
2. no CTE `viagens`, trocar `s.trajeto_min,` por:
```sql
             -- Local a conferir (sem local_id) e sem trajeto: tempo de
             -- viagem provisório, cauteloso (spec D6) - a vaga fica
             -- superestimada até a SME conferir o local.
             coalesce(s.trajeto_min,
                      case when s.local_id is null then (select provisorio from cfg) end) as trajeto_min,
```
3. nada mais muda (o `cross join lateral _sate_intervalo(v.periodo, ...)` já usa `v.trajeto_min`).

- [ ] **Step 5: `criar_viagem` deriva o período e usa o provisório**

Copiar `criar_viagem` da 042 inteira com estas mudanças, e só elas:
1. trocar `v_per  := p_viagem->>'periodo';` por (depois do cálculo de `v_emb`/`v_ret`, antes do `least`):
```sql
    v_per := _sate_periodo(v_emb, v_ret);
```
   (mover a atribuição para logo após o `if v_emb is null or v_ret is null ... end if;`).
2. no `_sate_intervalo(v_per, v_emb, v_ret, ...)`, trocar `(p_viagem->>'trajeto_min')::int` por
```sql
coalesce((p_viagem->>'trajeto_min')::int,
         case when p_viagem->>'local_id' is null then _sate_conf_int('trajeto_provisorio_min', 60) end)
```
O período gravado vem do gatilho do Step 3 (vale também para quem escreve no SATE, que não entra no `if not pode_escrever`).

- [ ] **Step 6: Guarda da escola cobre o destino em partes**

Copiar `fn_sate_guarda_escola` da 042 inteira; nas duas tuplas do `is distinct from` acrescentar `new.destino_numero, new.destino_bairro` / `old.destino_numero, old.destino_bairro` logo após `destino_endereco`. Recriar o trigger igual à 042.

- [ ] **Step 7: Fechar a migration**

```sql
select religar_auditoria();

select registrar_migration('044',
  'SATE: destino em partes, responsavel, acessibilidade por escola, periodo derivado (integral) e trajeto provisorio');
```

- [ ] **Step 8: Verificar e commitar**

Run: `python .claude/scripts/verificar_arquitetura.py` → 0 bloqueantes (checagem 13 exige o `religar_auditoria`).
Reler o arquivo inteiro procurando: vírgula sobrando nos `alter table`, `$$` fechados, `grant` presentes.

```bash
git add supabase/migrations/044_sate_solicitacao_simplificada.sql
git commit -m "feat(sate): migration 044 - destino em partes, responsavel, acessibilidade e periodo derivado"
```

---

### Task 2: Regras puras (período, título, responsável, endereço, parecidos, trajeto provisório)

**Files:**
- Create: `tests/sate-solicitacao.test.mjs`
- Modify: `src/modules/sate/regras.model.js`, `src/modules/sate/sate.model.js:29`, `src/modules/sate/disponibilidade.model.js`, `src/modules/sate/sate.config.js`, `src/modules/locais/locais.model.js`

**Interfaces:**
- Produces:
  - `regras.model.js`: `PERIODOS` com `integral: 'Manhã e tarde'`; `periodoDe(embarque: string, retorno: string): 'manha'|'tarde'|'noite'|'integral'|null`; `tituloDoPedido(s): string`; `responsavelDoPedido(s): string`.
  - `sate.model.js`: `export { PERIODOS } from './regras.model.js';` (remove a cópia local).
  - `disponibilidade.model.js`: `JANELA.integral = [0, 1080]`, `TIPICO.integral = [420, 1080]`; `trajetoParaVaga(s: {trajeto_min, local_id}, provisorioMin: number): number|null`.
  - `sate.config.js`: `trajetoProvisorioMin(): number` (padrão 60) e item de declaração.
  - `locais.model.js`: `enderecoCompleto({ endereco, numero, bairro }): string`; `locaisParecidos(alvo: {nome, bairro}, locais: Local[], max = 5): Local[]`; `numero`/`bairro` em `COLS` e `CAMPOS`.

- [ ] **Step 1: Escrever os testes**

```js
// tests/sate-solicitacao.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDe, tituloDoPedido, responsavelDoPedido, PERIODOS, alocarFichas } from '../src/modules/sate/regras.model.js';
import { JANELA, TIPICO, trajetoParaVaga, intervaloDaViagem } from '../src/modules/sate/disponibilidade.model.js';
import { enderecoCompleto, locaisParecidos } from '../src/modules/locais/locais.model.js';

test('periodoDe: manhã, integral, tarde, noite', () => {
  assert.equal(periodoDe('07:30', '11:00'), 'manha');
  assert.equal(periodoDe('07:30', '12:00'), 'manha');
  assert.equal(periodoDe('08:00', '15:00'), 'integral');
  assert.equal(periodoDe('12:00', '17:00'), 'tarde');
  assert.equal(periodoDe('13:00', '19:30'), 'tarde');
  assert.equal(periodoDe('18:00', '22:00'), 'noite');
  assert.equal(periodoDe('19:00', '00:30'), 'noite');
});

test('periodoDe: sem embarque não há período', () => {
  assert.equal(periodoDe('', '10:00'), null);
  assert.equal(periodoDe(null, null), null);
  assert.equal(periodoDe('07:00', ''), 'manha');
});

test('PERIODOS tem rótulo para integral', () => {
  assert.equal(PERIODOS.integral, 'Manhã e tarde');
});

test('integral ocupa manhã e tarde', () => {
  assert.deepEqual(JANELA.integral, [0, 1080]);
  assert.deepEqual(TIPICO.integral, [420, 1080]);
  const iv = intervaloDaViagem({ periodo: 'integral', embarque: '08:00', retorno: '15:00', trajetoMin: 30, intervaloMin: 0 });
  assert.deepEqual(iv, { ini: 480, fim: 930 });
});

test('trajetoParaVaga: gravado vence; sem local usa o provisório; com local sem trajeto, nada', () => {
  assert.equal(trajetoParaVaga({ trajeto_min: 25, local_id: null }, 60), 25);
  assert.equal(trajetoParaVaga({ trajeto_min: null, local_id: null }, 60), 60);
  assert.equal(trajetoParaVaga({ trajeto_min: null, local_id: 'x' }, 60), null);
});

test('tituloDoPedido: atividade, livre, destino, padrão', () => {
  assert.equal(tituloDoPedido({ atividade: { nome: 'Visita' } }), 'Visita');
  assert.equal(tituloDoPedido({ atividade_livre: 'Teatro' }), 'Teatro');
  assert.equal(tituloDoPedido({ destino_nome: 'Museu Exemplo' }), 'Museu Exemplo');
  assert.equal(tituloDoPedido({}), 'Solicitação de transporte');
});

test('responsavelDoPedido: campos novos, com queda no contato antigo', () => {
  assert.equal(responsavelDoPedido({ professor_nome: 'Prof. Exemplo', professor_telefone: '+5500000000000' }).startsWith('Prof. Exemplo · '), true);
  assert.equal(responsavelDoPedido({ professor_nome: 'Prof. Exemplo' }), 'Prof. Exemplo');
  assert.equal(responsavelDoPedido({ contato_professor: 'Fulano (00) 0000-0000' }), 'Fulano (00) 0000-0000');
  assert.equal(responsavelDoPedido({}), '');
});

test('enderecoCompleto junta e omite o que falta', () => {
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo', numero: '123', bairro: 'Centro' }), 'Rua Exemplo, 123 - Centro');
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo', bairro: 'Centro' }), 'Rua Exemplo - Centro');
  assert.equal(enderecoCompleto({ endereco: 'Rua Exemplo, 10 - Centro' }), 'Rua Exemplo, 10 - Centro');
  assert.equal(enderecoCompleto({ endereco: '  ', numero: '', bairro: null }), '');
  assert.equal(enderecoCompleto(null), '');
});

test('locaisParecidos: nome sem acento e sem artigo casa; bairro igual casa', () => {
  const locais = [
    { id: '1', nome: 'Theatro Exemplo', bairro: 'Centro', ativo: true },
    { id: '2', nome: 'Museu Exemplo', bairro: 'Jardim', ativo: true },
    { id: '3', nome: 'Parque Alfa', bairro: 'Centro', ativo: true },
    { id: '4', nome: 'Teatro Exemplo Antigo', bairro: 'Vila', ativo: false },
  ];
  const r = locaisParecidos({ nome: 'teatro exemplo', bairro: 'centro' }, locais).map(l => l.id);
  assert.equal(r[0], '1');                 // nome + bairro vem primeiro
  assert.ok(r.includes('3'));              // só bairro
  assert.ok(!r.includes('4'));             // inativo fica de fora
  assert.deepEqual(locaisParecidos({ nome: '', bairro: '' }, locais), []);
});

test('alocarFichas ordena integral junto da manhã', () => {
  const f = alocarFichas([
    { id: 'a', periodo: 'tarde', horario_embarque: '13:00', qtd_onibus: 1, qtd_alunos: 10 },
    { id: 'b', periodo: 'integral', horario_embarque: '08:00', qtd_onibus: 1, qtd_alunos: 10 },
  ], { capacidade: 44 });
  assert.equal(f[0].solicitacao.id, 'b');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/sate-solicitacao.test.mjs`
Expected: FAIL - `periodoDe` / `enderecoCompleto` não exportados.

- [ ] **Step 3: Implementar em `regras.model.js`**

Trocar a linha de `PERIODOS` e acrescentar, logo depois de `paraHora`:

```js
export const PERIODOS = Object.freeze({
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Manhã e tarde',
});

// O período é CALCULADO pelos horários (spec 2026-09-27, D4) - a escola
// não informa. `integral` é quem sai de manhã e volta depois do meio-dia:
// ocupa os dois períodos. ESPELHO de _sate_periodo (migration 044).
export function periodoDe(embarque, retorno) {
  const e = paraMin(embarque);
  if (e == null) return null;
  if (e >= 1080) return 'noite';
  if (e >= 720) return 'tarde';
  const r = paraMin(retorno);
  return r != null && r > 720 ? 'integral' : 'manha';
}

// Como um pedido se chama numa lista. Desde a 0.38.0 a escola não dá
// nome à atividade: o destino é o nome (spec D2). Os antigos mantêm o seu.
export const tituloDoPedido = (s) =>
  s?.atividade?.nome || s?.atividade_livre || s?.destino_nome || 'Solicitação de transporte';

// Responsável pela visita: os campos novos (spec D8), e o texto livre
// antigo para os pedidos feitos antes deles.
export function responsavelDoPedido(s) {
  const nome = s?.professor_nome || '';
  const tel = s?.professor_telefone ? exibirTelefone(s.professor_telefone) : '';
  if (nome || tel) return [nome, tel].filter(Boolean).join(' · ');
  return s?.contato_professor || '';
}
```

No topo: `import { exibirTelefone } from '../../shared/ui/phones.js';` (conferir que `phones.js` não toca `document` no nível do módulo - só dentro de funções).
Em `alocarFichas`: `const ORDEM_PERIODO = { manha: 0, integral: 0, tarde: 1, noite: 2 };`

- [ ] **Step 4: `sate.model.js` reexporta**

Trocar `export const PERIODOS = Object.freeze({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' });` por:

```js
// Um lugar só para os rótulos (regras.model.js); reexportado porque as
// telas e os agregadores já importam daqui.
export { PERIODOS } from './regras.model.js';
```

- [ ] **Step 5: `disponibilidade.model.js`**

```js
export const JANELA = Object.freeze({ manha: [0, 720], tarde: [720, 1080], noite: [1080, 2160], integral: [0, 1080] });
export const TIPICO = Object.freeze({ manha: [420, 720], tarde: [720, 1080], noite: [1140, 2160], integral: [420, 1080] });

// Tempo de viagem que entra na conta da vaga. O gravado vence; sem ele,
// um pedido de LOCAL A CONFERIR (sem local_id) usa o provisório - a vaga
// fica superestimada até a SME conferir (spec 2026-09-27, D6). ESPELHO do
// coalesce em ocupacao_transporte e criar_viagem (044).
export function trajetoParaVaga(s, provisorioMin) {
  if (s?.trajeto_min != null) return Number(s.trajeto_min);
  return s?.local_id ? null : provisorioMin;
}
```

Em `faltaParaConfirmar`: `trajetoMin: trajetoParaVaga(s, trajetoProvisorioMin()),` com `import { trajetoProvisorioMin } from './sate.config.js';`.
Em `aproximarPorPeriodo`: trocar `for (const p of Object.keys(JANELA))` por `for (const p of ['manha', 'tarde', 'noite'])` - o `saldo_transporte` antigo só conhece os três, e `integral` duplicaria a ocupação.
Em `proximoHorario` nada muda (`JANELA[periodo]` já cobre `integral`).

- [ ] **Step 6: `sate.config.js`**

Em `PADRAO`: `trajeto_provisorio_min: 60,`. Depois de `margemParadaMin`:

```js
export const trajetoProvisorioMin = () => num('trajeto_provisorio_min', PADRAO.trajeto_provisorio_min);
```

Em `DECLARACAO.itens`, depois de `margem_parada_min`:

```js
    {
      chave: 'trajeto_provisorio_min', escopo: 'rede', grupo: 'regras',
      tipo: 'numero', padrao: PADRAO.trajeto_provisorio_min, min: 0, max: 240,
      rotulo: 'Tempo de viagem provisório (minutos)',
      dica: 'Usado na contagem de vagas enquanto o local digitado pela escola não é conferido. Prefira um número folgado: a vaga fica reservada a mais, nunca a menos.',
    },
```

- [ ] **Step 7: `locais.model.js`**

`const COLS = 'id, nome, endereco, numero, bairro, desembarque, latitude, longitude, maps_url, ativo, obs';`
`const COLS_ANTIGAS = 'id, nome, endereco, desembarque, latitude, longitude, maps_url, ativo, obs';`
`CAMPOS` ganha `'numero', 'bairro'` depois de `'endereco'`.

Em `getLocais`, degradar sem a 044:

```js
  let { data, error } = await sb().from('local').select(COLS).order('nome');
  // Sem a migration 044 as colunas numero/bairro não existem (42703):
  // lê do jeito antigo em vez de quebrar a página.
  if (error?.code === '42703') ({ data, error } = await sb().from('local').select(COLS_ANTIGAS).order('nome'));
```

Acrescentar:

```js
// A linha única de endereço, a partir das três partes (spec 2026-09-27,
// D3): "Rua Exemplo, 123 - Centro". Registros antigos têm o endereço
// inteiro em `endereco` e as outras duas vazias - saem como estavam.
// TODA exibição e uso da linha única passam por aqui.
export function enderecoCompleto(x) {
  const t = (v) => String(v ?? '').trim();
  const rua = t(x?.endereco), num = t(x?.numero), bairro = t(x?.bairro);
  const linha = [rua, num].filter(Boolean).join(', ');
  return [linha, bairro].filter(Boolean).join(' - ');
}

// Locais ativos parecidos com o que a escola digitou - para a SME
// apontar para um existente em vez de cadastrar duplicata (spec D6).
// Nome parecido = alguma palavra significativa (4+ letras, sem acento)
// em comum; bairro igual também conta. Nome + bairro vem primeiro.
export function locaisParecidos(alvo, locais, max = 5) {
  const palavras = (s) => norm(s).split(/[^a-z0-9]+/).filter(p => p.length >= 4);
  const nomeAlvo = new Set(palavras(alvo?.nome));
  const bairroAlvo = norm(alvo?.bairro).trim();
  if (!nomeAlvo.size && !bairroAlvo) return [];
  return (locais || [])
    .filter(l => l.ativo)
    .map(l => {
      const nome = palavras(l.nome).some(p => nomeAlvo.has(p) || [...nomeAlvo].some(a => a.startsWith(p.slice(0, 5)) || p.startsWith(a.slice(0, 5))));
      const bairro = !!bairroAlvo && norm(l.bairro).trim() === bairroAlvo;
      return { l, pontos: (nome ? 2 : 0) + (bairro ? 1 : 0) };
    })
    .filter(x => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.l.nome.localeCompare(b.l.nome, 'pt'))
    .slice(0, max)
    .map(x => x.l);
}
```

com `import { norm } from '../../shared/dom.js';` (se ainda não importado). O prefixo de 5 letras faz "teatro" casar "theatro"? Não - "teat" × "thea". Por isso o teste usa `Theatro Exemplo` casando por "exemplo". Não ampliar a heurística além do teste.

- [ ] **Step 8: Rodar tudo**

Run: `node --test tests/*.test.mjs` → todos PASS (215 anteriores + novos).
Run: `python .claude/scripts/verificar_arquitetura.py` → 0 bloqueantes.

- [ ] **Step 9: Commit**

```bash
git add tests/sate-solicitacao.test.mjs src/modules/sate/regras.model.js src/modules/sate/sate.model.js src/modules/sate/disponibilidade.model.js src/modules/sate/sate.config.js src/modules/locais/locais.model.js
git commit -m "feat(sate): periodo derivado, integral, trajeto provisorio e endereco em partes (regras puras)"
```

---

### Task 3: O modal novo de solicitação

**Files:**
- Create: `src/modules/sate/views/formulario-destino.js`
- Rewrite: `src/modules/sate/views/formulario.js`
- Modify: `src/modules/sate/sate.css`

**Interfaces:**
- Consumes: `periodoDe`, `PERIODOS` (regras.model), `enderecoCompleto` (locais.model), `trajetoParaVaga`, `trajetoProvisorioMin`, `criarBuscaSelecao(el, { opcoes, valor, placeholder, vazioTexto, onChange })` de `shared/ui/busca-selecao.js` (ler o arquivo inteiro para ver o retorno - `definirValor`, `valor()` etc.), `paraE164`/`formatarTelefone` de `shared/ui/phones.js`.
- Produces: `formulario-destino.js` exporta
  - `destinoHtml(): string` - o `<fieldset>` DESTINO;
  - `ligarDestino(locais: Local[], aoMudar: () => void): void`;
  - `lerDestino(): { localId: string|null, local: Local|null, nome, endereco, numero, bairro }`;
  - `validarDestino(d): string|null` - mensagem de erro ou null.
  - `formulario.js` mantém `abrirFormulario(contexto)` com o mesmo `contexto` de hoje.

- [ ] **Step 1: `formulario-destino.js`**

Comportamento (spec D2):
- Um campo "Local" com `criarBuscaSelecao` sobre `locais.filter(l => l.ativo)` (`{ id, rotulo: l.nome, detalhe: enderecoCompleto(l) , busca: l.bairro }`).
- Escolheu: mostra Endereço/Número/Bairro preenchidos com `readonly` e a classe `campo-derivado`? Não - usar `<input readonly>` dentro do `.esc-form`, para herdar altura.
- Link-botão `Local não está na lista` (`button type="button" class="mini-btn"`) alterna para o modo livre: Nome do local, Endereço, Número, Bairro editáveis e obrigatórios; `Escolher da lista` volta.
- Esconder/mostrar por `hidden` (ver comentário de `aplicarModo` no formulário antigo: `[hidden]` vence as regras de `.form-grupo .campos`).

```js
// ============================================================
// FundHub - sate/views/formulario-destino.js
// O grupo DESTINO do modal de solicitação (spec 2026-09-27, D2).
// Separado de formulario.js por ter estado e contrato próprios: o modo
// (local da lista × local digitado) e a busca - o formulário só pergunta
// "qual é o destino?" e "está válido?".
// ============================================================
import { enderecoCompleto } from '../../locais/locais.model.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { val } from '../../../shared/dom.js';

let locaisAtivos = [];
let escolhido = null;   // Local da lista, ou null
let livre = false;      // true = a escola digita o local

export const destinoHtml = () => `
  <fieldset class="form-grupo">
    <legend>Destino</legend>
    <div class="campos duas">
      <div class="col-2 dest-lista">
        <label for="f-local-busca">Local</label>
        <div id="f-local-busca"></div>
        <button type="button" class="mini-btn dest-alternar" id="f-dest-livre">Local não está na lista</button>
      </div>
      <label class="col-2 dest-livre" hidden>Nome do local
        <input id="f-dest-nome" type="text" placeholder="Ex.: Museu Exemplo" /></label>
      <label class="col-2">Endereço <input id="f-dest-end" type="text" placeholder="Ex.: Rua Exemplo" readonly /></label>
      <label>Número <input id="f-dest-num" type="text" inputmode="numeric" placeholder="Ex.: 123" readonly /></label>
      <label>Bairro <input id="f-dest-bairro" type="text" placeholder="Ex.: Centro" readonly /></label>
      <button type="button" class="mini-btn dest-alternar col-2 dest-livre" id="f-dest-lista" hidden>Escolher da lista</button>
    </div>
  </fieldset>`;

const campo = (id) => document.getElementById(id);

function preencher(l) {
  campo('f-dest-end').value = l?.endereco || '';
  campo('f-dest-num').value = l?.numero || '';
  campo('f-dest-bairro').value = l?.bairro || '';
}

function aplicarModo() {
  document.querySelectorAll('.dest-livre').forEach(el => { el.hidden = !livre; });
  document.querySelector('.dest-lista').hidden = livre;
  for (const id of ['f-dest-end', 'f-dest-num', 'f-dest-bairro']) campo(id).readOnly = !livre;
  if (livre) { escolhido = null; preencher(null); campo('f-dest-nome').focus(); }
}

export function ligarDestino(locais, aoMudar) {
  locaisAtivos = (locais || []).filter(l => l.ativo);
  escolhido = null; livre = false;
  criarBuscaSelecao(campo('f-local-busca'), {
    opcoes: locaisAtivos.map(l => ({ id: l.id, rotulo: l.nome, detalhe: enderecoCompleto(l), busca: l.bairro || '' })),
    placeholder: 'Digite para buscar o local…',
    vazioTexto: 'Nenhum local com esse nome - use “Local não está na lista”',
    onChange: (id) => { escolhido = locaisAtivos.find(l => l.id === id) || null; preencher(escolhido); aoMudar(); },
  });
  campo('f-dest-livre').addEventListener('click', () => { livre = true; aplicarModo(); aoMudar(); });
  campo('f-dest-lista').addEventListener('click', () => { livre = false; aplicarModo(); aoMudar(); });
  campo('f-dest-nome').addEventListener('change', aoMudar);
}

export function lerDestino() {
  if (!livre) {
    const l = escolhido;
    return { localId: l?.id || null, local: l, nome: l?.nome || '', endereco: l?.endereco || '', numero: l?.numero || '', bairro: l?.bairro || '' };
  }
  return { localId: null, local: null, nome: val('f-dest-nome'), endereco: val('f-dest-end'), numero: val('f-dest-num'), bairro: val('f-dest-bairro') };
}

// Local da lista: basta tê-lo escolhido. Local digitado: as quatro partes
// são obrigatórias - é o que a empresa de transporte vai ler na ficha.
export function validarDestino(d) {
  if (d.localId) return null;
  if (!livre) return 'Escolha o local na lista (ou use “Local não está na lista”).';
  if (!d.nome || !d.endereco || !d.numero || !d.bairro) return 'Informe nome, endereço, número e bairro do local.';
  return null;
}
```

Conferir a assinatura real de `criarBuscaSelecao` (o `onChange` recebe o `id`? a opção?) e ajustar. Se o `<label for>` não puder apontar para o input interno da busca, usar `<div class="lbl">Local</div>`.

- [ ] **Step 2: Reescrever `formulario.js`**

Manter do arquivo atual: o cabeçalho de contexto (atualizar a descrição), `opcoesEscola`, `pintarTrajeto` (adaptado), `revisar`/`pintarSaldo`/`avaliar` (adaptados), o tratamento de erro do envio (`P0001`, `23502`). Remover: `modo`, catálogo, `f-ativ`, `f-ativ-livre`, `f-local`, `f-per`, `f-contato`.

Markup (ordem da spec D2):

```js
  abrirModal(`
    ${modalHead('Nova solicitação', 'Transporte para atividade extraclasse')}
    <div class="modal-body">
      <form id="sol-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Origem</legend>
          <div class="campos duas">
            <label class="col-2">Escola
              <select id="f-esc" required>${opcoesEscola(unidades, perfil, aprovador)}</select></label>
            <label>Turma(s) <input id="f-turmas" type="text" placeholder="Ex.: 5º A, 5º B" /></label>
            <label>Nº de estudantes <input id="f-alunos" type="number" inputmode="numeric" min="1" placeholder="0" required /></label>
          </div>
        </fieldset>

        ${destinoHtml()}

        <fieldset class="form-grupo">
          <legend>Quando</legend>
          <div class="campos duas">
            <label class="col-2">Data <input id="f-data" type="date" min="${minData}" required /></label>
            <label>Horário de embarque <input id="f-emb" type="time" required /></label>
            <label>Horário de retorno <input id="f-ret" type="time" required /></label>
            <p class="form-hint col-2" id="f-periodo" aria-live="polite"></p>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Responsável pela visita</legend>
          <div class="campos duas">
            <label>Professor(a) responsável <input id="f-prof" type="text" required /></label>
            <label>Telefone / WhatsApp <input id="f-tel" type="tel" inputmode="tel" placeholder="(00) 00000-0000" required /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Acessibilidade</legend>
          <div class="campos duas">
            <label>Nº de cadeirantes <input id="f-cadeira" type="number" inputmode="numeric" min="0" value="0" /></label>
            <label>Nº de estudantes surdos <input id="f-surdo" type="number" inputmode="numeric" min="0" value="0" /></label>
            <label class="inline col-2"><input type="checkbox" id="f-nec" /> Outra necessidade específica (descreva nas observações)</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Observações da escola</legend>
          <div class="campos">
            <label>Observações <textarea id="f-obs" rows="2" placeholder="Informações adicionais relevantes…"></textarea></label>
          </div>
        </fieldset>

        <div id="f-trajeto" class="sol-trajeto" aria-live="polite"></div>
        <div id="f-saldo" class="sol-saldo" aria-live="polite"></div>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-submit" class="btn-primary" ${ctx.somenteLeitura ? 'disabled' : ''}>${ctx.somenteLeitura ? 'Envio desativado nesta visualização' : 'Enviar solicitação'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo' });
```

Ligação:
- `ligarDestino(ctx.locais, () => { pintarTrajeto(); })`; `f-esc` change → `pintarTrajeto`.
- `f-emb`/`f-ret` change → `pintarPeriodo()` + `revisar()`; `f-data`, `f-alunos` (input e change), `f-cadeira` change → `revisar()`.
- `f-tel` blur → `el.value = formatarTelefone(el.value)`.

```js
// O período é calculado (spec D4): a escola vê o resultado, não escolhe.
function pintarPeriodo() {
  const p = periodoDe(val('f-emb'), val('f-ret'));
  document.getElementById('f-periodo').textContent = p ? `Período: ${PERIODOS[p]}` : '';
}
```

`destinoEscolhido()` passa a ser `lerDestino().local` (só local da lista tem coordenada). Em `pintarTrajeto`, `temDestino = !!(d.localId || d.nome)` com `const d = lerDestino();`.

`pintarSaldo`: `const periodo = periodoDe(val('f-emb'), val('f-ret'));` no lugar do select; sem período (embarque vazio) não há saldo. No `intervaloDaViagem`, `trajetoMin: trajetoParaVaga({ trajeto_min: trajeto?.min ?? null, local_id: lerDestino().localId }, trajetoProvisorioMin())`.

`avaliar`: `usaOnibus = true` sempre (sem catálogo); remover a busca de atividade.

`enviar`:

```js
  const escId = document.getElementById('f-esc').value;
  const data = val('f-data');
  const emb = val('f-emb'), ret = val('f-ret');
  const periodo = periodoDe(emb, ret);
  const qtd = parseInt(val('f-alunos'), 10);
  const cadeira = parseInt(val('f-cadeira'), 10) || 0;
  const surdo = parseInt(val('f-surdo'), 10) || 0;
  const d = lerDestino();

  if (!escId) return falha(msg, 'Escolha a escola.');
  if (!qtd) return falha(msg, 'Informe o nº de estudantes.');
  const erroDestino = validarDestino(d);
  if (erroDestino) return falha(msg, erroDestino);
  if (!data || !emb || !ret) return falha(msg, 'Informe a data e os horários de embarque e de retorno.');
  if (periodo !== 'noite' && ret <= emb) return falha(msg, 'O retorno precisa ser depois do embarque.');
  if (data < hojeISO()) return falha(msg, 'A data não pode ser no passado.');
  if (!val('f-prof') || !val('f-tel')) return falha(msg, 'Informe o professor(a) responsável e o telefone.');
  // (bloqueio do calendário escolar: manter o bloco atual, sem mudança)

  const viagem = {
    unidade_id: unidadeId,
    data, periodo,                       // o banco recalcula (044); vai para o caso de a 044 não ter rodado
    qtd_onibus: onibusPara(qtd, capacidadeOnibus()),
    qtd_vans: vansPara(cadeira, capacidadeVan()),
    turmas: val('f-turmas') || null,
    local_id: d.localId,
    destino_nome: d.nome || null,
    destino_endereco: d.endereco || null,
    destino_numero: d.numero || null,
    destino_bairro: d.bairro || null,
    horario_embarque: emb,
    horario_retorno: ret,
    professor_nome: val('f-prof'),
    professor_telefone: paraE164(val('f-tel')) || val('f-tel'),
    observacao: val('f-obs') || null,
    ...(trajeto ? retratoTrajeto(trajeto) : {}),
  };
  const participacao = {
    unidade_id: unidadeId, qtd_alunos: qtd, qtd_cadeirante: cadeira,
    qtd_surdo: surdo, necessidade_especifica: document.getElementById('f-nec').checked,
    horario: emb,
  };
```

Conferir o que `paraE164` devolve para entrada inválida (ler `phones.js`) e manter o fallback. No `catch`, acrescentar: `err.code === '23514'` (CHECK de período sem a 044 e pedido `integral`) → `falha(msg, 'O banco ainda não aceita pedidos de manhã e tarde. Avise a Gerência.')`.

Imports que saem: `getDiaCalendario` fica; `atividades` sai do contexto usado; remover imports não usados (o verificador e o console acusam).

O arquivo deve ficar ≤ 400 linhas (`wc -l`). Se passar, mover `pintarSaldo`+`avaliar` para `views/formulario-saldo.js` (superfície própria: o painel de saldo), exportando `pintarSaldo(ctx, { lerPedido })`.

- [ ] **Step 3: CSS**

Em `sate.css`, apenas o que faltar (conferir `components.css` antes):

```css
/* Grupo DESTINO: o botão "Local não está na lista" fica sob a busca,
   alinhado à esquerda, sem esticar. */
.dest-lista { display: flex; flex-direction: column; gap: 6px; }
.dest-alternar { align-self: start; }
```

- [ ] **Step 4: Verificar no navegador (dev-local)**

Seguir a memória `fundhub-teste-devlocal` (patch temporário em `config.js`/`perfil.js`, `preview_start` nome `fundhub`). Em `sate.html`, via `javascript_tool`:

```js
const f = await import('/src/modules/sate/views/formulario.js?x=' + Date.now());
f.abrirFormulario({ perfil:{unidades:[]}, atividades:[], aprovador:true,
  unidades:[{numero:'1',nome:'Escola Exemplo'}],
  locais:[{id:'l1',nome:'Museu Exemplo',endereco:'Rua Exemplo',numero:'10',bairro:'Centro',ativo:true}] });
```

Conferir: ordem dos grupos; buscar "museu" e escolher preenche endereço/número/bairro só leitura; "Local não está na lista" libera os quatro campos; embarque 08:00 + retorno 15:00 mostra "Período: Manhã e tarde"; enviar sem responsável mostra a mensagem; console sem erros; tela 375px sem rolagem lateral. **Reverter o patch de dev-local.**

- [ ] **Step 5: Commit**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/sate/views/formulario.js src/modules/sate/views/formulario-destino.js src/modules/sate/sate.css
git commit -m "feat(sate): modal de solicitacao simplificado - destino por local, periodo calculado, responsavel e acessibilidade"
```

---

### Task 4: Exibição nas outras telas

**Files:**
- Modify: `src/modules/sate/views/detalhe.js`, `fichas.js`, `solicitacoes.js`, `remanejar.js`, `participantes.js`; `src/modules/viagens/viagens.view.js`; `src/modules/dashboard/views/paineis.js`

**Interfaces:**
- Consumes: `tituloDoPedido`, `responsavelDoPedido`, `periodoDe` (regras.model - `viagens` e `dashboard` importam de `../sate/regras.model.js`, que é model: fronteira permitida); `enderecoCompleto` (locais.model); `trajetoParaVaga` + `trajetoProvisorioMin`.

Uma função auxiliar local em cada view que precisa do endereço do destino (duas linhas, não vale abstração - R13):

```js
const enderecoDestino = (s) => enderecoCompleto({ endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro })
  || s.atividade?.local_endereco || '';
```

- [ ] **Step 1: `detalhe.js`**
  - título do modal: `tituloDoPedido(s)` no lugar de `nomeAtividade(s)` (remover `nomeAtividade` se ficar sem uso);
  - campo Destino: `esc(destino(s))` + `enderecoDestino(s)` numa segunda linha (`<div class="di-meta">`);
  - campo "Responsável": `responsavelDoPedido(s)` (substitui o campo "Contato");
  - campo "Acessibilidade" a partir das `paradas` ativas: soma de `qtd_surdo` ("N estudante(s) surdo(s)") e "outra necessidade específica" se alguma tem `necessidade_especifica` - omitido quando nada;
  - `intervaloDaViagem` do badge: `trajetoMin: trajetoParaVaga(s, trajetoProvisorioMin())`.
- [ ] **Step 2: `fichas.js`** - `destEnd = enderecoDestino(s)`; linha "Atividade" usa `tituloDoPedido(s)`; linha "Contato" vira "Responsável" com `responsavelDoPedido(s)`; linha "Acessibilidade" quando alguma parada tem surdos ou necessidade (mesmo texto do detalhe). O filtro de período (select) já lista `integral` pelo `PERIODOS`.
- [ ] **Step 3: `solicitacoes.js`** - coluna da atividade: `valor: s => tituloDoPedido(s)`.
- [ ] **Step 4: `remanejar.js`** - remover o select de período; calcular `periodo: periodoDe(emb, ret) || s.periodo` no `patch`; a validação `ret <= emb` usa esse período; ao trocar de local, o patch leva `destino_endereco: local.endereco || null, destino_numero: local.numero || null, destino_bairro: local.bairro || null`.
- [ ] **Step 5: `participantes.js:80`** - após os cadeirantes: `${p.qtd_surdo ? ` · ${p.qtd_surdo} surdo(s)` : ''}${p.necessidade_especifica ? ' · outra necessidade' : ''}`.
- [ ] **Step 6: `viagens.view.js`** - `porPeriodo` ganha `integral: []`; a ordem de exibição segue `Object.keys(PERIODOS)` (manha, tarde, noite, integral) - aceitável; nome com `tituloDoPedido(s)`; destino com `enderecoDestino(s)`; contato com `responsavelDoPedido(s)`.
- [ ] **Step 7: `paineis.js:65`** - `tituloDoPedido(s)`.
- [ ] **Step 8: Verificar e commitar**

Run: `node --test tests/*.test.mjs` e `python .claude/scripts/verificar_arquitetura.py` (sem ciclo novo: `viagens`/`dashboard` → `sate/regras.model.js` é model→model).
No navegador (dev-local), abrir `detalhe.js` com uma solicitação sintética (`abrirDetalhe({ id:'x', status:'solicitado', data:'2026-10-10', periodo:'integral', horario_embarque:'08:00', horario_retorno:'15:00', destino_nome:'Museu Exemplo', destino_endereco:'Rua Exemplo', destino_numero:'10', destino_bairro:'Centro', professor_nome:'Prof. Exemplo', professor_telefone:'+5500000000000' }, { locais: [], aprovador: true })`) e conferir os campos. Reverter o patch.

```bash
git add src/modules/sate/views src/modules/viagens/viagens.view.js src/modules/dashboard/views/paineis.js
git commit -m "feat(sate): destino em partes, responsavel e acessibilidade nas fichas, no detalhe e nos paineis"
```

---

### Task 5: Página Locais com modal e mapa Leaflet

**Files:**
- Create: `src/modules/sate/views/mapa-local.js`
- Rewrite: `src/modules/sate/views/locais.js`
- Modify: `src/modules/sate/sate.css`, `CLAUDE.md` (seção "Sem build")

**Interfaces:**
- Consumes: `criarLocal`, `atualizarLocal`, `excluirLocal`, `geocodificar`, `linkMaps`, `enderecoCompleto`, `temCoordenada` (locais.model); `abrirModal`, `modalHead`, `fecharModal`; `confirmar`; `ctx.aprovador`, `ctx.somenteLeitura`, `ctx.recarregarLocais()`.
- Produces:
  - `mapa-local.js`: `montarMapaLocal(el: HTMLElement, { lat, lng, aoMover: (lat, lng) => void }): Promise<{ mover(lat, lng): void } | null>` - `null` quando o Leaflet não carrega.
  - `locais.js`: `render(contexto)` (mesma assinatura) e `abrirLocal(local|null, { preenchido, aoSalvar }): void` - exportada para a Task 6 reusar ("Cadastrar novo" abre este modal preenchido).

- [ ] **Step 1: Obter o SRI do Leaflet 1.9.4**

```bash
curl -s https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js | openssl dgst -sha256 -binary | openssl base64 -A
curl -s https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css | openssl dgst -sha256 -binary | openssl base64 -A
```

Usar os valores obtidos como `sha256-<valor>` nas constantes abaixo.

- [ ] **Step 2: `mapa-local.js`**

```js
// ============================================================
// FundHub - sate/views/mapa-local.js
// Mapa com pino arrastável para acertar a coordenada de um local
// (spec 2026-09-27, D7) - como o "Editar local" do agendamentos-fil.
//
// Leaflet é EXCEÇÃO NOMEADA à regra "sem dependência nova" (CLAUDE.md):
// versão fixa, jsDelivr, SRI, e carregado SÓ quando este mapa é pedido -
// nenhuma outra tela paga por ele. Sem rede ou com o CDN fora, devolve
// null e a tela segue com os campos de coordenada. Degrada, não quebra.
// ============================================================
const BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const SRI_JS = 'sha256-<do Step 1>';
const SRI_CSS = 'sha256-<do Step 1>';
// Centro de Ribeirão Preto - onde o mapa abre quando o local não tem ponto.
const CENTRO = [-21.1775, -47.8103];

let carregando = null;

function carregarLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    Object.assign(css, { rel: 'stylesheet', href: BASE + 'leaflet.css', integrity: SRI_CSS, crossOrigin: 'anonymous' });
    document.head.appendChild(css);
    const js = document.createElement('script');
    Object.assign(js, { src: BASE + 'leaflet.js', integrity: SRI_JS, crossOrigin: 'anonymous' });
    js.onload = () => resolve(window.L);
    js.onerror = () => { carregando = null; reject(new Error('Leaflet indisponível')); };
    document.head.appendChild(js);
  });
  return carregando;
}

export async function montarMapaLocal(el, { lat = null, lng = null, aoMover = () => {} } = {}) {
  let L;
  try { L = await carregarLeaflet(); } catch (_) { return null; }
  if (!el.isConnected) return null;   // o modal fechou enquanto carregava
  const tem = Number.isFinite(lat) && Number.isFinite(lng);
  const mapa = L.map(el).setView(tem ? [lat, lng] : CENTRO, tem ? 17 : 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(mapa);
  const pino = L.marker(tem ? [lat, lng] : CENTRO, { draggable: true, opacity: tem ? 1 : 0.5 }).addTo(mapa);
  const mover = (a, b) => { pino.setLatLng([a, b]).setOpacity(1); mapa.setView([a, b], Math.max(mapa.getZoom(), 16)); };
  pino.on('dragend', () => { const p = pino.getLatLng(); pino.setOpacity(1); aoMover(p.lat, p.lng); });
  mapa.on('click', (e) => { mover(e.latlng.lat, e.latlng.lng); aoMover(e.latlng.lat, e.latlng.lng); });
  // O modal acabou de abrir: o Leaflet mediu o contêiner antes do layout.
  setTimeout(() => mapa.invalidateSize(), 60);
  return { mover };
}
```

Conferir a coordenada de `CENTRO` (centro de Ribeirão Preto, dado público; não é PII).

- [ ] **Step 3: Reescrever `locais.js`**

- Lista em `.cards` (manter o `card()` atual) com endereço por `enderecoCompleto(l)`. Botões de editar/excluir e "Novo local" só quando `ctx.aprovador && !ctx.somenteLeitura` (substitui `perfil?.isAdmin`).
- `abrirLocal(l, { preenchido = {}, aoSalvar = null } = {})`: `abrirModal(..., { tamanho: 'largo' })` com `<form id="local-form" class="esc-form">` e grupos:
  - **Identificação**: Nome (obrigatório) · Ponto de desembarque · Ativo (`label.inline` + checkbox);
  - **Endereço**: Endereço · Número · Bairro;
  - **Localização**: `<div id="l-mapa" class="local-mapa"></div>` · Latitude · Longitude · `Localizar pelo endereço` (usa `geocodificar(enderecoCompleto({...}))` e chama `mapa?.mover`) · link `Abrir no Google Maps` (`linkMaps`, atualizado quando a coordenada muda) · dica "Clique no mapa ou arraste o pino para acertar o ponto de desembarque.";
  - **Observação**.
  - Valores iniciais: `{ ...l, ...preenchido }`.
- `montarMapaLocal(document.getElementById('l-mapa'), { lat, lng, aoMover })`: `aoMover` escreve `toFixed(6)` em `l-lat`/`l-lng`. Se devolver `null`, esconder `#l-mapa` (`hidden`).
- Mudar latitude/longitude à mão (`change`) chama `mapa?.mover`.
- `salvar`: payload `{ nome, endereco, numero, bairro, desembarque, latitude, longitude, obs, ativo }`; depois `await ctx.recarregarLocais()`; `fecharModal()`; se `aoSalvar`, `await aoSalvar(salvo)` (o `criarLocal`/`atualizarLocal` devolve a linha), senão `render(ctx)`. Erro `42703` → `falha(msg, 'O banco ainda não tem os campos número e bairro. Avise a Gerência.')`.
- `remover`: igual ao atual (confirmar → excluir → recarregar).
- Manter o comentário sobre a duplicação com o formulário de Escolas (R13).

- [ ] **Step 4: CSS**

```css
/* Mapa do local (Leaflet). Altura fixa: o Leaflet precisa de um
   contêiner medido. */
.local-mapa { height: 280px; border: 1px solid var(--border); border-radius: var(--radius-btn); }
@media (min-width: 720px) { .local-mapa { height: 340px; } }
```

- [ ] **Step 5: `CLAUDE.md`**

Na seção "Sem build", depois do parágrafo do `versao.json`:

```markdown
**Segunda exceção: Leaflet** (mapa com pino do cadastro de locais do SATE). Versão fixa
(`leaflet@1.9.4`), do jsDelivr, com SRI, carregado **só** quando o modal de um local abre -
nenhuma outra tela baixa nada. Sem ele, o modal segue com latitude, longitude e "Localizar pelo
endereço". Ver `src/modules/sate/views/mapa-local.js`. Um segundo uso de mapa reusa esse arquivo
(movendo-o para `shared/ui/` no terceiro, R13) - não traz outra biblioteca.
```

- [ ] **Step 6: Verificar e commitar**

Dev-local: `#/locais` no `sate.html` com `ctx.locais` sintético (via `recarregarLocais` ou chamando `abrirLocal(null, { preenchido: { nome: 'Museu Exemplo', endereco: 'Rua Exemplo', numero: '10', bairro: 'Centro' } })` pelo `javascript_tool`). Conferir: mapa carrega, clique move o pino e preenche lat/lng, link do Google Maps muda, tela estreita sem rolagem lateral, console limpo. Simular Leaflet ausente (bloquear `cdn.jsdelivr.net` ou trocar `BASE` temporariamente) → mapa some, resto funciona. Reverter patches.

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/sate/views/locais.js src/modules/sate/views/mapa-local.js src/modules/sate/sate.css CLAUDE.md
git commit -m "feat(sate): pagina Locais com modal, endereco em partes e mapa Leaflet com pino arrastavel"
```

---

### Task 6: Conferir local + aviso na confirmação

**Files:**
- Create: `src/modules/sate/views/conferir-local.js`
- Modify: `src/modules/sate/sate.model.js`, `src/modules/sate/views/detalhe.js`

**Interfaces:**
- Consumes: `locaisParecidos`, `enderecoCompleto` (locais.model); `abrirLocal` (views/locais.js - mesma pasta, import interno permitido); `atualizarTrajeto`, `retratoTrajeto` (rota.model); `velocidadeOnibusKmh`, `margemParadaMin`.
- Produces:
  - `sate.model.js`: `vincularLocal(solicitacaoId: string, local: Local): Promise<object>` - grava `local_id`, `destino_nome`, `destino_endereco`, `destino_numero`, `destino_bairro` via `editarSolicitacao`, devolve o patch.
  - `sate.model.js`: `localAConferir(s): boolean` = `!s.local_id && !!s.destino_nome`.
  - `conferir-local.js`: `abrirConferirLocal(s, ctx, reabrir): void`.

- [ ] **Step 1: Teste de `localAConferir`**

Acrescentar em `tests/sate-solicitacao.test.mjs`:

```js
import { localAConferir } from '../src/modules/sate/sate.model.js';

test('localAConferir: destino digitado sem local cadastrado', () => {
  assert.equal(localAConferir({ destino_nome: 'Museu Exemplo', local_id: null }), true);
  assert.equal(localAConferir({ destino_nome: 'Museu Exemplo', local_id: 'x' }), false);
  assert.equal(localAConferir({ atividade_id: 'a' }), false);
});
```

Run: `node --test tests/sate-solicitacao.test.mjs` → FAIL (não exportada).

- [ ] **Step 2: `sate.model.js`**

```js
// Destino digitado pela escola, ainda sem local do cadastro (spec
// 2026-09-27, D6). Derivado, não guardado: não tem como dessincronizar.
export const localAConferir = (s) => !s?.local_id && !!s?.destino_nome;

// A SME apontou o pedido para um local do cadastro ("É este" ou
// "Cadastrar novo"). Troca SÓ o destino - data, horários, escolas e
// veículos ficam. O texto da escola fica no audit_log.
export async function vincularLocal(solicitacaoId, local) {
  const patch = {
    local_id: local.id,
    destino_nome: local.nome,
    destino_endereco: local.endereco || null,
    destino_numero: local.numero || null,
    destino_bairro: local.bairro || null,
  };
  await editarSolicitacao(solicitacaoId, patch);
  return patch;
}
```

Run o teste → PASS. Conferir que `sate.model.js` continua ≤ 250 linhas.

- [ ] **Step 3: `conferir-local.js`**

```js
// ============================================================
// FundHub - sate/views/conferir-local.js
// "Conferir local" (spec 2026-09-27, D6): o destino que a escola digitou
// vira um local do cadastro - um existente ("É este") ou um novo,
// conferido no mapa ("Cadastrar novo"). Nos dois casos o pedido só troca
// de destino; o trajeto é recalculado.
// ============================================================
import { vincularLocal } from '../sate.model.js';
import { locaisParecidos, enderecoCompleto } from '../../locais/locais.model.js';
import { atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { abrirLocal } from './locais.js';
import { esc } from '../../../shared/dom.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

export function abrirConferirLocal(s, ctx, reabrir) {
  const digitado = { nome: s.destino_nome, endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro };
  const parecidos = locaisParecidos(digitado, ctx.locais || []);

  abrirModal(`
    ${modalHead('Conferir local', 'O destino que a escola digitou')}
    <div class="modal-body">
      <div class="conf-digitado">
        <b>${esc(digitado.nome)}</b>
        <div class="di-meta">${esc(enderecoCompleto(digitado)) || 'sem endereço'}</div>
      </div>
      <h3 class="conf-titulo">${parecidos.length ? 'Já cadastrado? Escolha o mesmo lugar:' : 'Nenhum local parecido no cadastro.'}</h3>
      ${parecidos.map(l => `
        <div class="solic">
          <div class="solic-main"><b>${esc(l.nome)}</b><div class="di-meta">${esc(enderecoCompleto(l))}</div></div>
          <div class="solic-acoes"><button type="button" class="mini-btn ok" data-local="${esc(l.id)}">É este</button></div>
        </div>`).join('')}
      <div class="form-foot">
        <span id="conf-msg" class="auth-msg"></span>
        <button type="button" class="btn-primary" id="conf-novo">Nenhum destes: cadastrar novo</button>
      </div>
    </div>`, { tamanho: 'medio', voltar: reabrir });

  const corpo = document.querySelector('.modal-body');
  corpo.querySelectorAll('[data-local]').forEach(b => b.addEventListener('click', () =>
    vincular(s, ctx, (ctx.locais || []).find(l => l.id === b.dataset.local), reabrir)));
  document.getElementById('conf-novo').addEventListener('click', () =>
    abrirLocal(null, { preenchido: digitado, aoSalvar: (novo) => vincular(s, ctx, novo, reabrir) }));
}

async function vincular(s, ctx, local, reabrir) {
  if (!local) return;
  try {
    Object.assign(s, await vincularLocal(s.id, local));
    const r = await atualizarTrajeto(s, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() }).catch(() => null);
    if (r) Object.assign(s, retratoTrajeto(r));
    ctx.recarregar?.();
    toast({ titulo: 'Local conferido', texto: local.nome, tipo: 'sucesso' });
    await reabrir();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível vincular o local' });
  }
}
```

Conferir: `abrirLocal` precisa do `ctx` da página Locais (`recarregarLocais`). Se `locais.js` guarda `ctx` só no `render`, adaptar `abrirLocal` para receber `ctx` como terceiro parâmetro opcional e usá-lo quando vier (`abrirLocal(null, { preenchido, aoSalvar }, ctx)`). Ajustar a assinatura na Task 5 se necessário e usar a mesma aqui. `querySelector('.modal-body')` pega o modal do topo? Conferir em `modal.js` (pilha) e, se não, dar `id="conf-corpo"` ao corpo e buscar por id.

CSS (sate.css): `.conf-digitado { padding: 10px 12px; border: 1px dashed var(--border); border-radius: var(--radius-btn); } .conf-titulo { margin: 16px 0 8px; font-size: 14px; }`.

- [ ] **Step 4: `detalhe.js` - botão e aviso**
  - No campo Destino, quando `localAConferir(s)`: tag `<span class="tag">Local a conferir</span>` e, se `ctx.aprovador && !ctx.somenteLeitura`, botão `<button type="button" class="mini-btn" id="det-conferir">Conferir local</button>` que chama `abrirConferirLocal(s, ctx, () => abrirDetalhe(s, ctx))`.
  - Em `confirmar(btn)`: antes de confirmar, se `localAConferir(atual)`:
```js
    const ok = await confirmar('O local deste pedido ainda não foi conferido. A vaga está contada com o tempo de viagem provisório. Confirmar mesmo assim?',
      { textoOk: 'Confirmar mesmo assim' });
    if (!ok) return;
```
    (import `confirmar` de `shared/ui/confirmar.js`; conferir o nome da função local `confirmar(btn)` - renomear a local para `confirmarPedido` para não colidir.)
  - Se `detalhe.js` passar de 400 linhas, mover o bloco de trajeto (`trajetoHtml` + `recalcular`) para `views/detalhe-trajeto.js`.

- [ ] **Step 5: Verificar e commitar**

`node --test tests/*.test.mjs`, verificador, e no navegador (dev-local) abrir o detalhe sintético da Task 4 sem `local_id`, com `ctx.locais` contendo um "Museu Exemplo" no mesmo bairro: aparece "Local a conferir"; "Conferir local" lista o parecido; "Cadastrar novo" abre o modal do local preenchido. (Sem banco, gravar falha - conferir só a navegação.) Reverter patches.

```bash
git add src/modules/sate/sate.model.js src/modules/sate/views/conferir-local.js src/modules/sate/views/detalhe.js src/modules/sate/views/locais.js src/modules/sate/sate.css tests/sate-solicitacao.test.mjs
git commit -m "feat(sate): conferir local digitado pela escola e aviso ao confirmar pedido com local a conferir"
```

---

### Task 7: Entrega - tutorial, versões, changelog

**Files:**
- Modify: `docs/modulos/sate.md`, `CHANGELOG.md`, `src/core/config.js`

- [ ] **Step 1: Tutorial** - usar a skill `atualizar-ajuda` para `docs/modulos/sate.md`: passo a passo "Pedir transporte" na ordem nova dos grupos; período calculado (tabela da regra em linguagem de quem usa); "Local não está na lista"; "Conferir local" em "Quem pode o quê"/passo a passo da Gerência; página Locais com mapa; regras que bloqueiam (os quatro campos do local digitado; responsável e telefone) × avisam (confirmar com local a conferir). Carimbo: `> Atualizado na versão 0.38.0.`
- [ ] **Step 2: Versões** - `src/core/config.js`: `versao: '0.38.0'`, `versaoSate: '0.17.0'`.
- [ ] **Step 3: CHANGELOG** - entrada `## [0.38.0] - <data>` com `> SATE 0.17.0.` e `> **Rodar a migration 044 no Supabase** (depois da 042 e da 043).`; itens em negrito para quem usa (sem nome de arquivo): pedido mais simples; período calculado com "manhã e tarde"; local da lista ou digitado; responsável pela visita; acessibilidade (surdos, outra necessidade); página Locais com mapa; conferir local; tempo de viagem provisório nas configurações. Linha nova no topo da tabela "Versões do SATE": `| 0.17.0 | 0.38.0 | pedido simplificado, locais com mapa, conferência de local |`.
- [ ] **Step 4: Verificação final**

Run: `node --test tests/*.test.mjs` → PASS.
Run: `python .claude/scripts/verificar_arquitetura.py` → 0 bloqueantes; checagem 11 sem aviso para `sate.md`; checagem 14 quieta após o commit.
`git diff --cached` procurando dado real.

```bash
git add docs/modulos/sate.md CHANGELOG.md src/core/config.js
git commit -m "docs(sate): tutorial e changelog da 0.38.0 (SATE 0.17.0)"
```
