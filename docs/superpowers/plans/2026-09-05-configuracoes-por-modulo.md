# Configurações por módulo (Bloco A) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada módulo pode declarar configurações; o kernel guarda e devolve os valores; a engrenagem do módulo e o módulo Configurações as apresentam.

**Architecture:** Duas tabelas (`config_modulo` = rede, `preferencia_usuario` = pessoa) atrás de RLS. Um mapa carregado no boot em `core/configuracoes.js`, lido síncrono por `conf()`/`pref()` (análogo a `core/permissoes.js`). O manifesto ganha `config: () => import('./x.config.js')` opcional. O roteador monta uma barra de ações irmã da view (`.mod-acoes` + `#mod-view`) e a engrenagem abre uma gaveta com o painel do módulo. Módulo agregador `configuracoes` reúne todos. Renderizador único (`painel.js`) para campo (switch/número/opção) e para painel (função do módulo).

**Tech Stack:** JS ES modules puro, sem build. Supabase (Postgres+RLS). `node --test`. Migrations aplicadas à mão no SQL Editor.

**Spec:** `docs/superpowers/specs/2026-09-05-configuracoes-por-modulo-design.md`

## Global Constraints

- PT-BR em código, comentário, commit e interface.
- Branch `dev`. Commits frequentes. Push ao fechar o bloco.
- **Invioláveis:** nenhum dado real/segredo; RLS default-deny, nenhuma policy para `anon`; todo valor do banco passa por `esc()` antes de template literal; nenhuma cor literal em `src/modules/**`.
- Kernel (`core/`+`shared/`) nunca importa `modules/` nem `shell/`. Exceção existente: `registry.js` importa `module.js`.
- Model nunca toca no DOM; view nunca chama `sb()`. `<x>.config.js` **não** é model: não fala com o banco (quem fala é o kernel) e não é API pública.
- View recebe o elemento onde desenhar e `ctx.perfil` do roteador - não chama `getPerfilAtual()` de novo.
- Migration **idempotente** (`if not exists`, `on conflict do nothing`, `create or replace`), roda duas vezes sem estrago. Fecha com `select registrar_migration('026', '...')`.
- Degradação sem a migration: `42P01`/`42703` → mapa vazio → todo consumidor no padrão declarado.
- Ao fechar: `CONFIG.versao` MINOR (mudança de modelo) em `src/core/config.js` + `CHANGELOG.md` (texto para quem usa).
- `python .claude/scripts/verificar_arquitetura.py` sem violações; `node --test tests/*.mjs` sem falhas.

---

## Contexto verificado

- `core/permissoes.js` é o modelo a espelhar: `let _mapa = {}` preenchido no boot por `perfil.js` via `definirMapa`, lido síncrono por `nivel()`. `OCULTO`/`PROPRIOS`/`LEITURA`/`ESCRITA` exportados; `podeEscrever(m)`, `podeVer(m)`.
- `perfil.js` chama `definirMapa(mapa || {})` dentro de `getPerfilAtual()` (linha ~45). O boot (`main.js` → `montarApp`) faz `await getPerfilAtual()` antes de `startRouter`.
- `main.js`: `montarApp(user)` monta perfil → `setChrome` → `montarNav()` → `startRouter(app, {onRoute})` → `iniciarServicos()`. `desmontarApp()` faz `limparCaches()` + `limparPerfil()`.
- `router.js` `route()`: `outlet.innerHTML = loading()`; nos ramos de erro escreve `emptyState(...)` direto em `outlet`; no ramo feliz: `const view = await mod.load(); await view.render(outlet, { perfil, nivel: nivel(chavePerm(mod)), params })`.
- Nenhum `*.view.js` usa `getElementById('app')` - todos usam o elemento recebido. Podem receber `#mod-view` sem alteração.
- `registry.js`: `import <id> from '../modules/<id>/module.js'` + entrada no array `MODULOS`. `GRUPOS` tem `conta` (onde entra `meus_dados`). `chavePerm(m) = m.perm || m.id`.
- `meu_mapa_permissoes()` (migration 021, linhas 512-530): monta o mapa do admin a partir de `select distinct modulo from papel_permissao` + `|| '{"usuarios":"escrita","modulos":"escrita","meus_dados":"escrita"}'`; para não-admin, join `papel_permissao` + override de `perfil.permissoes` + `|| '{"meus_dados":"escrita","modulos":"leitura"}'`. **É `create or replace` - a 026 redefine acrescentando `configuracoes`.**
- Funções SQL existentes: `auth_email()`, `is_autorizado()`, `is_admin()`, `pode_escrever(text)` (SECURITY DEFINER stable - pode ser usada em policy lendo a coluna da linha), `registrar_migration(text, text)`.
- `019` audita por um `array[...]` de nomes de tabela num `foreach` com guarda `to_regclass` - a 026 acrescenta `config_modulo` a esse array (redefinindo o bloco `do $$`).
- `shared/ui/drawer.js`: `drawerHtml()` (markup), `montarDrawer()` (liga fundo+Esc), `abrirDrawer(html,{voltar})` faz `const d = getElementById('drawer'); if (!d) return;`. `drawerHead(titulo, sub)`. O `←` de voltar é `btn.textContent = '←'` (fora do escopo deste bloco).
- `icones.js`: `ico(nome,{tam,classe})`; `TRACOS` é um objeto de miolos de SVG; `NOMES`, `TEM_ICONE`. Teste em `tests/icones.test.mjs`.
- `feedback.js` exporta `loading`, `emptyState`, `erroBox`, `reportarErro`. `toast.js` exporta `toast`.
- `CONFIG.versao` atual: `0.14.6`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/026_configuracoes.sql` | duas tabelas + policies + grants + `config_modulo` na auditoria da 019 + `configuracoes` no `meu_mapa_permissoes` |
| `src/core/configuracoes.js` | mapa carregado no boot; `conf`/`pref` síncronos; `definirConf`/`definirPref`; `limparConfiguracoes`; `GRUPOS` |
| `src/main.js` | `carregarConfiguracoes()` no boot; `limparConfiguracoes()` no logout |
| `src/core/router.js` | monta `.mod-acoes` + `#mod-view`; botão de engrenagem conforme `mod.config`; entrega `#mod-view` à view |
| `src/shared/ui/drawer.js` | `abrirDrawer` passa a garantir o markup do drawer se ausente (`garantirDrawer`) |
| `src/shared/ui/icones.js` | traçado `config` (engrenagem) |
| `src/modules/configuracoes/module.js` | manifesto do agregador |
| `src/modules/configuracoes/configuracoes.view.js` | tela: um bloco por módulo, na ordem do registro |
| `src/modules/configuracoes/painel.js` | renderizador compartilhado (tela + gaveta da engrenagem); campo (switch/número/opção) e painel (função) |
| `src/modules/configuracoes/configuracoes.css` | `.cfg-*`; `@import` em `styles/main.css` |
| `src/modules/escolas/escolas.config.js` | declaração + acesso de `telefones_no_card` (prova real do mecanismo) |
| `src/modules/servidores/servidores.config.js` | idem |
| `src/modules/{escolas,servidores}/module.js` | campo `config` |
| `src/modules/{escolas,servidores}/*.view.js` | honra `telefones_no_card` no card |
| `src/styles/components.css` | `.mod-acoes` + reserva no `.page-head` |
| `src/styles/main.css` | `@import` do css novo |
| `tests/configuracoes.test.mjs` | `conf`/`pref`/padrão; filtro/merge; `GRUPOS` |

**Fronteira com E/F/G:** este bloco declara e consome **só** `telefones_no_card` (escolas e servidores) como prova. `cards_por_linha`, `servidores_no_card`, os painéis de Horários e a ordenação da Dashboard entram nas specs E/F/G, cada uma acrescentando ao `<x>.config.js` o que ela mesma consome.

---

## Task 1: Migration 026

**Files:**
- Create: `supabase/migrations/026_configuracoes.sql`

**Interfaces:**
- Produces (para o resto do plano): tabelas `config_modulo(modulo, chave, valor jsonb, atualizado_por, atualizado_em)` e `preferencia_usuario(email, modulo, chave, valor jsonb, atualizado_em)`; `meu_mapa_permissoes()` passa a incluir `"configuracoes":"escrita"` para todos.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/026_configuracoes.sql`:

```sql
-- ============================================================
-- 026 - Configurações por módulo
-- Rode no SQL Editor, depois da 025.
--
-- Duas naturezas, duas tabelas:
--   config_modulo       - decisão da REDE (janela de cobertura, dia do
--                          TDC). Quem pode: pode_escrever(modulo).
--   preferencia_usuario  - escolha da PESSOA (ordem dos cards, exibir
--                          telefone). Quem pode: só o dono do e-mail.
--
-- Sem esta migration o app funciona: 42P01 nas leituras devolve mapa
-- vazio e todo consumidor cai no padrão declarado no <x>.config.js.
-- ============================================================

-- ── Rede ─────────────────────────────────────────────────────
create table if not exists config_modulo (
  modulo         text not null,
  chave          text not null,
  valor          jsonb not null,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  primary key (modulo, chave)
);
alter table config_modulo enable row level security;
alter table config_modulo force  row level security;

drop policy if exists config_modulo_sel on config_modulo;
drop policy if exists config_modulo_ins on config_modulo;
drop policy if exists config_modulo_upd on config_modulo;
drop policy if exists config_modulo_del on config_modulo;
-- A policy lê a COLUNA da própria linha: a permissão de uma
-- configuração é, literalmente, a permissão do módulo dela.
create policy config_modulo_sel on config_modulo for select using (is_autorizado());
create policy config_modulo_ins on config_modulo for insert with check (pode_escrever(modulo));
create policy config_modulo_upd on config_modulo for update using (pode_escrever(modulo))
                                                    with check (pode_escrever(modulo));
create policy config_modulo_del on config_modulo for delete using (pode_escrever(modulo));
grant select, insert, update, delete on config_modulo to authenticated;

-- ── Pessoa ───────────────────────────────────────────────────
create table if not exists preferencia_usuario (
  email         text not null,
  modulo        text not null,
  chave         text not null,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (email, modulo, chave)
);
alter table preferencia_usuario enable row level security;
alter table preferencia_usuario force  row level security;

drop policy if exists pref_sel on preferencia_usuario;
drop policy if exists pref_ins on preferencia_usuario;
drop policy if exists pref_upd on preferencia_usuario;
drop policy if exists pref_del on preferencia_usuario;
create policy pref_sel on preferencia_usuario for select using (email = auth_email());
create policy pref_ins on preferencia_usuario for insert with check (email = auth_email());
create policy pref_upd on preferencia_usuario for update using (email = auth_email())
                                                 with check (email = auth_email());
create policy pref_del on preferencia_usuario for delete using (email = auth_email());
grant select, insert, update, delete on preferencia_usuario to authenticated;

-- ── Auditoria (só config_modulo; preferência pessoal não vira log) ──
drop trigger if exists trg_audit on config_modulo;
create trigger trg_audit after insert or update or delete on config_modulo
  for each row execute function fn_audit();

-- Religa o array da 019 com config_modulo dentro (idempotente).
do $$
declare t text;
begin
  foreach t in array array[
    'unidade_escolar','regional','servidor','vinculo','perfil','telefone',
    'atividade_extraclasse','solicitacao_transporte','oferta_onibus','local',
    'dia_calendario','afastamento','horario_bloco','ocorrencia',
    'relatorio_visita','ata_atendimento','projeto','projeto_interesse',
    'escala_unidade','cargo_gestao','horario_exibicao','escala_tipo',
    'config_modulo'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on %I', t);
      execute format(
        'create trigger trg_audit after insert or update or delete on %I
           for each row execute function fn_audit()', t);
    end if;
  end loop;
end $$;

-- ── Permissão: Configurações é de todo mundo (como Meus dados) ──
create or replace function meu_mapa_permissoes() returns jsonb
  language sql stable security definer set search_path = public as $$
    select case
      when is_admin() then
        (select jsonb_object_agg(m, 'escrita')
           from (select distinct modulo as m from papel_permissao) x)
        || '{"usuarios":"escrita","modulos":"escrita","meus_dados":"escrita","configuracoes":"escrita"}'::jsonb
      else
        coalesce(
          (select jsonb_object_agg(pp.modulo, pp.nivel::text)
             from papel_permissao pp
             join perfil p on p.papel = pp.papel
            where p.email = auth_email() and p.ativo),
          '{}'::jsonb)
        || coalesce((select permissoes from perfil where email = auth_email() and ativo), '{}'::jsonb)
        || '{"meus_dados":"escrita","modulos":"leitura","configuracoes":"escrita"}'::jsonb
    end
  $$;
grant execute on function meu_mapa_permissoes() to authenticated;

select registrar_migration('026', 'Configuracoes por modulo (config_modulo, preferencia_usuario)');
```

- [ ] **Step 2: Conferência de sanidade do SQL (leitura)**

Reler contra `019` (o array) e `021` (o corpo de `meu_mapa_permissoes`) - os dois blocos redefinidos devem ser cópia fiel do atual + a linha nova. Confirmar que `pode_escrever` e `auth_email` existem (021 § 7 os concede a `authenticated`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_configuracoes.sql
git commit -m "feat(db): migration 026 - config_modulo e preferencia_usuario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

A migration é aplicada pelo André no SQL Editor - registrar isso na lista de pendências do fecho.

---

## Task 2: `core/configuracoes.js`

**Files:**
- Create: `src/core/configuracoes.js`
- Test: `tests/configuracoes.test.mjs`

**Interfaces:**
- Consumes: `sb`, `hasSupabase` de `./supabase.js`.
- Produces:
  - `carregarConfiguracoes(): Promise<void>` - 2 queries, preenche o mapa interno.
  - `conf(modulo: string, chave: string): any | undefined` - síncrono, valor de rede.
  - `pref(modulo: string, chave: string): any | undefined` - síncrono, preferência do usuário.
  - `definirConf(modulo, chave, valor): Promise<void>` - upsert em `config_modulo`.
  - `definirPref(modulo, chave, valor): Promise<void>` - upsert em `preferencia_usuario`.
  - `limparConfiguracoes(): void` - zera os mapas (logout).
  - `GRUPOS: Array<{id, rotulo}>` - vocabulário fechado.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/configuracoes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conf, pref, limparConfiguracoes, GRUPOS, _semearParaTeste } from '../src/core/configuracoes.js';

test('conf e pref devolvem undefined quando nada foi carregado', () => {
  limparConfiguracoes();
  assert.equal(conf('escolas', 'x'), undefined);
  assert.equal(pref('escolas', 'x'), undefined);
});

test('depois de semear, conf e pref devolvem o valor gravado', () => {
  _semearParaTeste(
    { 'horarios/cobertura': { a: 1 } },
    { 'escolas/telefones_no_card': true },
  );
  assert.deepEqual(conf('horarios', 'cobertura'), { a: 1 });
  assert.equal(pref('escolas', 'telefones_no_card'), true);
  assert.equal(conf('escolas', 'telefones_no_card'), undefined); // rede ≠ pessoa
});

test('limparConfiguracoes zera os dois mapas', () => {
  _semearParaTeste({ 'a/b': 1 }, { 'a/b': 2 });
  limparConfiguracoes();
  assert.equal(conf('a', 'b'), undefined);
  assert.equal(pref('a', 'b'), undefined);
});

test('GRUPOS é um vocabulário fechado com id e rótulo', () => {
  assert.ok(GRUPOS.length >= 3);
  for (const g of GRUPOS) { assert.equal(typeof g.id, 'string'); assert.equal(typeof g.rotulo, 'string'); }
  assert.ok(GRUPOS.some(g => g.id === 'exibicao'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/configuracoes.test.mjs`
Expected: FAIL (`Cannot find module` / exports ausentes).

- [ ] **Step 3: Escrever `src/core/configuracoes.js`**

```js
// ============================================================
// FundHub - core/configuracoes.js  (configurações por módulo)
// Espelha core/permissoes.js: dois mapas carregados uma vez no boot,
// lidos SÍNCRONO por todo mundo, sem tela própria.
//
//   config_modulo       → conf(modulo, chave)  → decisão da REDE
//   preferencia_usuario → pref(modulo, chave)  → escolha da PESSOA
//
// O PADRÃO de cada configuração NÃO mora aqui - mora no <x>.config.js
// do módulo, no acesso (`?? valor`). Aqui só há "o que foi gravado".
//
// Sem a migration 026: 42P01 nas leituras → mapas vazios → todo
// consumidor cai no padrão. Mesma degradação de telefones/locais.
// ============================================================
import { sb, hasSupabase } from './supabase.js';

// Chave composta "modulo/chave" → valor jsonb já desserializado.
let _rede = {};
let _pessoa = {};

const k = (modulo, chave) => `${modulo}/${chave}`;

export const GRUPOS = Object.freeze([
  { id: 'exibicao',      rotulo: 'Exibição' },
  { id: 'regras',        rotulo: 'Regras e limites' },
  { id: 'calendario',    rotulo: 'Calendário e escalas' },
  { id: 'notificacoes',  rotulo: 'Notificações' },
]);

export async function carregarConfiguracoes() {
  if (!hasSupabase()) { _rede = {}; _pessoa = {}; return; }
  const [rede, pessoa] = await Promise.all([
    sb().from('config_modulo').select('modulo, chave, valor'),
    sb().from('preferencia_usuario').select('modulo, chave, valor'),
  ]);
  _rede = indexar(rede);
  _pessoa = indexar(pessoa);
}

// 42P01 (tabela ausente) e qualquer outra falha → mapa vazio: a tela
// abre no padrão em vez de quebrar.
function indexar({ data, error }) {
  if (error || !data) return {};
  const out = {};
  for (const r of data) out[k(r.modulo, r.chave)] = r.valor;
  return out;
}

export const conf = (modulo, chave) => _rede[k(modulo, chave)];
export const pref = (modulo, chave) => _pessoa[k(modulo, chave)];

export async function definirConf(modulo, chave, valor) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: u } = await sb().auth.getUser();
  const { error } = await sb().from('config_modulo').upsert(
    { modulo, chave, valor, atualizado_por: u?.user?.email || null, atualizado_em: new Date().toISOString() },
    { onConflict: 'modulo,chave' });
  if (error) throw error;
  _rede[k(modulo, chave)] = valor;   // gravou, atualiza o mapa em memória
}

export async function definirPref(modulo, chave, valor) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data: u } = await sb().auth.getUser();
  const email = u?.user?.email;
  if (!email) throw new Error('Sessão expirada.');
  const { error } = await sb().from('preferencia_usuario').upsert(
    { email, modulo, chave, valor, atualizado_em: new Date().toISOString() },
    { onConflict: 'email,modulo,chave' });
  if (error) throw error;
  _pessoa[k(modulo, chave)] = valor;
}

export function limparConfiguracoes() { _rede = {}; _pessoa = {}; }

// Só para teste: injeta os mapas sem tocar no banco.
export function _semearParaTeste(rede = {}, pessoa = {}) { _rede = { ...rede }; _pessoa = { ...pessoa }; }
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/configuracoes.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/configuracoes.js tests/configuracoes.test.mjs
git commit -m "feat(core): configuracoes.js - mapa de config de rede e preferencia pessoal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Boot e logout

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `carregarConfiguracoes`, `limparConfiguracoes` de `./core/configuracoes.js`.

- [ ] **Step 1: Importar**

No topo de `src/main.js`, junto dos outros imports de `core/`:

```js
import { carregarConfiguracoes, limparConfiguracoes } from './core/configuracoes.js';
```

- [ ] **Step 2: Carregar no boot**

Em `montarApp(user)`, a primeira linha é `const perfil = await getPerfilAtual().catch(() => null);`. Trocar por carga paralela:

```js
  const [perfil] = await Promise.all([
    getPerfilAtual().catch(() => null),
    carregarConfiguracoes().catch(() => {}),
  ]);
```

- [ ] **Step 3: Limpar no logout**

Em `desmontarApp()`, junto de `limparCaches()` e `limparPerfil()`:

```js
  limparCaches();
  limparConfiguracoes();
  limparPerfil();
```

- [ ] **Step 4: Sanidade**

Run: `node --test tests/*.mjs` → PASS.
Run: `python .claude/scripts/verificar_arquitetura.py` → sem violações (kernel não importou módulo).

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat(boot): carrega configuracoes no login, limpa no logout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Ícone `config` + `garantirDrawer`

**Files:**
- Modify: `src/shared/ui/icones.js`
- Modify: `src/shared/ui/drawer.js`
- Test: `tests/icones.test.mjs`

**Interfaces:**
- Produces: `ico('config')` devolve um `<svg>`; `abrirDrawer(html)` funciona mesmo sem `#drawer` no DOM (cria em `document.body`).

- [ ] **Step 1: Teste do ícone**

Acrescentar a `tests/icones.test.mjs`:

```js
test('tem o traçado de configuração (engrenagem)', () => {
  assert.ok(TEM_ICONE('config'));
  assert.match(ico('config'), /^<svg /);
});
```

Run: `node --test tests/icones.test.mjs` → FAIL.

- [ ] **Step 2: Acrescentar o traçado**

Em `src/shared/ui/icones.js`, dentro de `TRACOS`, uma entrada nova (engrenagem do Feather, `settings`):

```js
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
```

Run: `node --test tests/icones.test.mjs` → PASS.

- [ ] **Step 3: `garantirDrawer` em `drawer.js`**

Em `src/shared/ui/drawer.js`, acrescentar após `drawerHtml`:

```js
// Garante que o markup do drawer existe. As views que montam a própria
// página já incluem `${drawerHtml()}` + `montarDrawer()`; a barra de
// ações do módulo (roteador) não tem página própria, então a engrenagem
// precisa poder abrir a gaveta sem depender do que a view fez.
export function garantirDrawer() {
  if (document.getElementById('drawer')) return;
  document.body.insertAdjacentHTML('beforeend', drawerHtml());
  montarDrawer();
}
```

e, na primeira linha de `abrirDrawer`, trocar:

```js
export function abrirDrawer(html, { voltar = null } = {}) {
  const d = document.getElementById('drawer');
  if (!d) return;
```

por:

```js
export function abrirDrawer(html, { voltar = null } = {}) {
  garantirDrawer();
  const d = document.getElementById('drawer');
  if (!d) return;
```

- [ ] **Step 4: Sanidade**

Run: `node --test tests/*.mjs` → PASS. `python .claude/scripts/verificar_arquitetura.py` → sem violações.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/icones.js src/shared/ui/drawer.js tests/icones.test.mjs
git commit -m "feat(ui): icone config; abrirDrawer garante o markup do drawer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: A barra de ações do módulo no roteador

**Files:**
- Modify: `src/core/router.js`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `mod.config` (função `import()` opcional no manifesto).
- Produces: no ramo feliz, o roteador cria `<div class="mod-acoes" id="mod-acoes"></div><div id="mod-view"></div>` dentro do `outlet`, monta a engrenagem se `mod.config` existe e `nivel !== OCULTO`, e chama `view.render(document.getElementById('mod-view'), ctx)`.

- [ ] **Step 1: Reescrever o ramo feliz de `route()`**

Em `src/core/router.js`, o bloco:

```js
    } else {
      const view = await mod.load();   // import() dinâmico: só agora a view é baixada
      await view.render(outlet, { perfil, nivel: nivel(chavePerm(mod)), params });
    }
```

vira:

```js
    } else {
      const nv = nivel(chavePerm(mod));
      // Estrutura estável: a barra de ações é IRMÃ da view, não mãe. A
      // view continua recebendo um elemento e escrevendo o innerHTML nele;
      // .mod-wrap é o pai posicionado que ancora a barra no canto.
      outlet.innerHTML = `<div class="mod-wrap"><div class="mod-acoes" id="mod-acoes"></div><div id="mod-view"></div></div>`;
      await montarAcoesModulo(mod, nv);
      const view = await mod.load();   // import() dinâmico: só agora a view é baixada
      await view.render(document.getElementById('mod-view'), { perfil, nivel: nv, params });
    }
```

- [ ] **Step 2: A função `montarAcoesModulo`**

Acrescentar ao fim de `router.js` (antes não há import de `modules/` - `mod.config` é uma função do manifesto, que o roteador já conhece; a implementação entra por `import()` dinâmico, exatamente como `mod.load()`):

```js
// A engrenagem (e, no Bloco B, o botão de ajuda) da barra de ações.
// `import()` dinâmico do painel: o kernel dispara, o módulo responde -
// mesma inversão de mod.load(). Módulo sem `config` não ganha botão, e
// sem botão a barra fica vazia (invisível).
async function montarAcoesModulo(mod, nv) {
  const barra = document.getElementById('mod-acoes');
  if (!barra || nv === OCULTO || typeof mod.config !== 'function') return;
  barra.insertAdjacentHTML('beforeend',
    `<button type="button" class="mod-acao" id="mod-cfg" aria-label="Configurações de ${esc(mod.nome)}">${ico('config')}</button>`);
  document.getElementById('mod-cfg').addEventListener('click', async () => {
    const { abrirPainelConfig } = await import('../modules/configuracoes/painel.js');
    abrirPainelConfig(mod);
  });
}
```

- [ ] **Step 3: CSS da barra**

Em `src/styles/components.css`, acrescentar (perto de `.page-head`):

```css
/* Barra de ações do módulo - irmã da view (a view faz innerHTML no
   #mod-view e apagaria qualquer coisa colocada dentro). .mod-wrap é o
   pai posicionado; a barra fica sobre o canto superior direito. */
.mod-wrap { position: relative; }
.mod-acoes {
  position: absolute; top: 0; right: 0; z-index: 5;
  display: flex; gap: 6px;
}
.mod-acoes:empty { display: none; }
.mod-acao {
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--controle); height: var(--controle);
  border: 1px solid var(--border); border-radius: 9px;
  background: var(--surface-2); color: var(--muted); cursor: pointer;
  box-shadow: var(--shadow-btn);
}
.mod-acao:hover { color: var(--text); border-color: var(--border-forte); }
/* Reserva à direita no título para os botões não cobrirem o texto. */
#mod-view > .page-head { padding-right: calc(var(--controle) + 12px); }
@media (pointer: coarse) { .mod-acao { width: var(--toque); height: var(--toque); } }
```

- [ ] **Step 4: Verificação no browser (controlador)**

Patch de dev-local ([[fundhub-teste-devlocal]]): `config.js` `supabaseAnonKey: ''`, `perfil.js` ramo dev-local devolvendo admin + `definirMapa(new Proxy({}, { get: () => 'escrita' }))`. `preview_start` name `fundhub`, `resize_window` 1200×860. Navegar `#/escolas` - a engrenagem aparece no topo direito? Navegar `#/dashboard` (sem `config` no manifesto ainda) - **não** aparece. Reverter o patch.

(Nesta task nenhum módulo declara `config` ainda; a barra fica vazia/invisível em todos. A verificação real de "aparece" é na Task 8.)

- [ ] **Step 5: Sanidade + commit**

Run: `node --test tests/*.mjs` e `python .claude/scripts/verificar_arquitetura.py`.

```bash
git add src/core/router.js src/styles/components.css
git commit -m "feat(router): barra de acoes do modulo (engrenagem) irma da view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `painel.js` - o renderizador compartilhado

**Files:**
- Create: `src/modules/configuracoes/painel.js`
- Create: `src/modules/configuracoes/configuracoes.css`
- Modify: `src/styles/main.css` (`@import`)

**Interfaces:**
- Consumes: `conf`/`pref`/`definirConf`/`definirPref`/`GRUPOS` de `core/configuracoes.js`; `nivel`/`OCULTO`/`podeEscrever` de `core/permissoes.js`; `esc` de `shared/dom.js`; `abrirDrawer`/`drawerHead` de `shared/ui/drawer.js`; `toast`; `ico`.
- Produces:
  - `abrirPainelConfig(mod): void` - abre a gaveta com o painel daquele módulo.
  - `pintarConfigDoModulo(box, mod, { perfil }): Promise<void>` - desenha os grupos/itens de um módulo num elemento (usado pela tela agregadora).
  - Formato de `DECLARACAO` que cada `<x>.config.js` exporta: `{ itens: Array<Item> }` onde `Item` = `{ chave, escopo: 'usuario'|'rede', grupo: string, tipo?: 'switch'|'numero'|'opcao', rotulo, dica?, padrao?, min?, max?, opcoes?: [{valor,rotulo}], painel?: (box, ctx) => void }`.

- [ ] **Step 1: Escrever `painel.js`**

```js
// ============================================================
// FundHub - modules/configuracoes/painel.js
// Renderizador ÚNICO das configurações: usado pela engrenagem (gaveta)
// e pela tela do módulo Configurações. Um item é um CAMPO
// (switch/número/opção, renderizador genérico) ou um PAINEL (função
// que o próprio módulo fornece - ex.: a tela de cargos de Horários).
//
// Regra de visibilidade (spec A, D10):
//   item 'usuario' → aparece se nivel(modulo) !== oculto; sempre editável.
//   item 'rede'    → aparece igual; editável só se podeEscrever(modulo).
// Config de rede não editável aparece DESABILITADA, com o valor à vista.
// ============================================================
import { conf, pref, definirConf, definirPref, GRUPOS } from '../../core/configuracoes.js';
import { nivel, OCULTO, podeEscrever } from '../../core/permissoes.js';
import { chavePerm } from '../../core/registry.js';
import { esc } from '../../shared/dom.js';
import { abrirDrawer, drawerHead } from '../../shared/ui/drawer.js';
import { toast } from '../../shared/ui/toast.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';

export async function abrirPainelConfig(mod) {
  abrirDrawer(`
    ${drawerHead('Configurações', esc(mod.nome))}
    <div class="drawer-body" id="cfg-drawer-body">${loading()}</div>`);
  await pintarConfigDoModulo(document.getElementById('cfg-drawer-body'), mod, {});
}

// Desenha os grupos e itens de UM módulo dentro de `box`.
export async function pintarConfigDoModulo(box, mod, ctx) {
  if (!box) return;
  const perm = chavePerm(mod);
  if (nivel(perm) === OCULTO) { box.innerHTML = ''; return; }

  let declaracao;
  try {
    ({ DECLARACAO: declaracao } = await mod.config());
  } catch (err) { box.innerHTML = erroBox(err); return; }

  const podeRede = podeEscrever(perm);
  const itens = declaracao?.itens || [];
  const porGrupo = GRUPOS
    .map(g => ({ ...g, itens: itens.filter(i => i.grupo === g.id) }))
    .filter(g => g.itens.length);

  if (!porGrupo.length) { box.innerHTML = '<p class="form-hint">Nada a configurar aqui.</p>'; return; }

  box.innerHTML = porGrupo.map(g => `
    <fieldset class="cfg-grupo">
      <legend>${esc(g.rotulo)}</legend>
      ${g.itens.map(i => itemHtml(i, mod.id, podeRede)).join('')}
    </fieldset>`).join('');

  // Painéis (função do módulo) são desenhados depois, no elemento reservado.
  for (const i of itens.filter(x => typeof x.painel === 'function')) {
    const alvo = box.querySelector(`[data-painel="${cssEscape(i.chave)}"]`);
    if (alvo) { try { await i.painel(alvo, ctx); } catch (err) { alvo.innerHTML = erroBox(err); } }
  }

  ligar(box, mod.id, podeRede);
}

function itemHtml(i, modId, podeRede) {
  const rede = i.escopo === 'rede';
  const desabilita = rede && !podeRede;
  const val = rede ? conf(modId, i.chave) : pref(modId, i.chave);
  const atual = val ?? i.padrao;

  if (typeof i.painel === 'function') {
    return `<div class="cfg-item cfg-painel">
      <div class="cfg-rot">${esc(i.rotulo)}${dicaHtml(i)}</div>
      <div data-painel="${esc(i.chave)}">${loading()}</div>
    </div>`;
  }

  const nome = `cfg-${esc(modId)}-${esc(i.chave)}`;
  let controle = '';
  if (i.tipo === 'switch') {
    controle = `<label class="switch">
      <input type="checkbox" id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}"
             ${atual ? 'checked' : ''} ${desabilita ? 'disabled' : ''} />
      <span class="switch-trilho" aria-hidden="true"></span></label>`;
  } else if (i.tipo === 'numero') {
    controle = `<input type="number" id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}"
      value="${esc(String(atual ?? ''))}" min="${esc(String(i.min ?? ''))}" max="${esc(String(i.max ?? ''))}"
      ${desabilita ? 'disabled' : ''} />`;
  } else if (i.tipo === 'opcao') {
    controle = `<select id="${nome}" data-chave="${esc(i.chave)}" data-escopo="${esc(i.escopo)}" ${desabilita ? 'disabled' : ''}>
      ${(i.opcoes || []).map(o => `<option value="${esc(String(o.valor))}" ${String(o.valor) === String(atual) ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}
    </select>`;
  }

  return `<div class="cfg-item">
    <label class="cfg-rot" for="${nome}">${esc(i.rotulo)}${rede ? ' <span class="cfg-rede" title="Vale para a rede toda">rede</span>' : ''}${dicaHtml(i)}</label>
    ${controle}
    ${desabilita ? '<span class="form-hint">Só quem tem permissão de escrita neste módulo muda isto.</span>' : ''}
  </div>`;
}

const dicaHtml = (i) => i.dica ? `<span class="form-hint cfg-dica">${esc(i.dica)}</span>` : '';
const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');

function ligar(box, modId, podeRede) {
  box.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-chave]');
    if (!el) return;
    const chave = el.dataset.chave;
    const escopo = el.dataset.escopo;
    let valor;
    if (el.type === 'checkbox') valor = el.checked;
    else if (el.type === 'number') valor = el.value === '' ? null : Number(el.value);
    else valor = el.value;

    el.disabled = true;
    try {
      if (escopo === 'rede') await definirConf(modId, chave, valor);
      else await definirPref(modId, chave, valor);
      toast({ titulo: 'Configuração salva', tipo: 'sucesso' });
    } catch (err) {
      toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    } finally {
      el.disabled = escopo === 'rede' && !podeRede;
    }
  });
}
```

- [ ] **Step 2: `configuracoes.css`**

```css
.cfg-grupo { border: 0; margin: 0 0 20px; padding: 0; }
.cfg-grupo + .cfg-grupo { border-top: 1px solid var(--border); padding-top: 16px; }
.cfg-grupo > legend {
  color: var(--form-legend); font-size: 11.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em; padding-bottom: 6px;
  border-bottom: 1px solid var(--border); width: 100%; margin-bottom: 12px;
}
.cfg-item { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.cfg-rot { color: var(--form-label); font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.cfg-dica { display: block; text-transform: none; font-weight: 400; letter-spacing: 0; margin-top: 2px; }
.cfg-rede { color: var(--brand); font-size: 10px; margin-left: 4px; }
.cfg-item input[type="number"] { min-height: var(--campo); line-height: 1.25; max-width: 120px; }
.cfg-mod { margin-bottom: 28px; }
.cfg-mod-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cfg-mod-head h2 { font-size: 15px; margin: 0; }
```

- [ ] **Step 3: `@import` em `src/styles/main.css`**

Acrescentar na lista de imports de módulo:

```css
@import url('../modules/configuracoes/configuracoes.css');
```

- [ ] **Step 4: Sanidade + commit**

Run: `python .claude/scripts/verificar_arquitetura.py` (checa que o `@import` existe para o css novo e que o grafo não tem ciclo - `painel.js` importa `registry.js`, que é kernel; OK).
Run: `node --test tests/*.mjs`.

```bash
git add src/modules/configuracoes/painel.js src/modules/configuracoes/configuracoes.css src/styles/main.css
git commit -m "feat(configuracoes): painel.js - renderizador de campo e de painel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: O módulo Configurações (agregador)

**Files:**
- Create: `src/modules/configuracoes/module.js`
- Create: `src/modules/configuracoes/configuracoes.view.js`
- Modify: `src/core/registry.js`

**Interfaces:**
- Consumes: `MODULOS` de `registry.js`; `pintarConfigDoModulo` de `./painel.js`; `nivel`/`OCULTO` de `permissoes.js`; `chavePerm` de `registry.js`; `ico`, `esc`.
- Produces: rota `#/configuracoes`, grupo `conta`.

- [ ] **Step 1: Manifesto**

`src/modules/configuracoes/module.js`:

```js
// Manifesto do módulo Configurações (agregador: tela, sem model, sem
// dados próprios). Reúne as configurações de todos os módulos que a
// pessoa pode ver. É de todo mundo - entra em meu_mapa_permissoes()
// como 'escrita' para todos (migration 026), como Meus dados.
export default {
  id: 'configuracoes',
  ico: 'config',
  nome: 'Configurações',
  desc: 'Como cada módulo se comporta para você e para a rede.',
  navNome: 'Configurações',
  rota: '#/configuracoes',
  grupo: 'conta',
  nav: true,
  ativo: true,
  load: () => import('./configuracoes.view.js'),
};
```

- [ ] **Step 2: A tela**

`src/modules/configuracoes/configuracoes.view.js`:

```js
// ============================================================
// FundHub - modules/configuracoes/configuracoes.view.js
// Agregador puro (como dashboard/viagens): um bloco por módulo que a
// pessoa pode ver e que declara `config`, na ordem do registro. Usa o
// MESMO renderizador que a engrenagem (painel.js).
// ============================================================
import { MODULOS, chavePerm } from '../../core/registry.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { emptyState } from '../../shared/ui/feedback.js';
import { pintarConfigDoModulo } from './painel.js';

export async function render(app, ctx = {}) {
  const perfil = ctx.perfil || null;
  // Módulos configuráveis que a pessoa enxerga (o próprio Configurações fora).
  const alvos = MODULOS.filter(m =>
    m.id !== 'configuracoes' &&
    typeof m.config === 'function' &&
    nivel(chavePerm(m)) !== OCULTO);

  app.innerHTML = `
    <div class="page-head">
      <h1>Configurações</h1>
      <p>O que aparece e como o sistema se comporta - para você e, onde você
         tem permissão, para a rede.</p>
    </div>
    <div id="cfg-lista"></div>`;

  const lista = app.querySelector('#cfg-lista');
  if (!alvos.length) {
    lista.innerHTML = emptyState(ico('config', { tam: 32 }), 'Nada para configurar',
      'Os módulos que você usa ainda não têm opções.');
    return;
  }

  lista.innerHTML = alvos.map(m => `
    <section class="cfg-mod" data-mod="${esc(m.id)}">
      <div class="cfg-mod-head">${ico(m.ico || 'config', { tam: 18 })}<h2>${esc(m.nome)}</h2></div>
      <div class="cfg-mod-corpo">…</div>
    </section>`).join('');

  for (const m of alvos) {
    const box = lista.querySelector(`[data-mod="${cssEscape(m.id)}"] .cfg-mod-corpo`);
    await pintarConfigDoModulo(box, m, { perfil });
  }
}

const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');
```

- [ ] **Step 3: Registrar**

Em `src/core/registry.js`:

```js
import configuracoes from '../modules/configuracoes/module.js';
```

e no array `MODULOS`, no grupo `conta` (junto de `meusDados`):

```js
  notificacoes, meusDados, configuracoes, usuarios, docs,
```

- [ ] **Step 4: Sanidade**

Run: `node --test tests/*.mjs` → PASS.
Run: `python .claude/scripts/verificar_arquitetura.py` → sem violações.

- [ ] **Step 5: Commit**

```bash
git add src/modules/configuracoes/ src/core/registry.js
git commit -m "feat(configuracoes): modulo agregador em #/configuracoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Primeira prova real - `telefones_no_card` em Escolas e Servidores

**Files:**
- Create: `src/modules/escolas/escolas.config.js`
- Create: `src/modules/servidores/servidores.config.js`
- Modify: `src/modules/escolas/module.js`, `src/modules/servidores/module.js`
- Modify: `src/modules/escolas/escolas.view.js` (`cardHtml`)
- Modify: `src/modules/servidores/views/lista.js` (`card`)

**Interfaces:**
- Consumes: `pref` de `core/configuracoes.js`.
- Produces: `escolas.config.js` e `servidores.config.js` exportam `DECLARACAO` (formato da Task 6) e um acesso `mostrarTelefonesNoCard(): boolean`.

- [ ] **Step 1: `escolas.config.js`**

```js
// Declaração de configuração do módulo Escolas. NÃO é model: não fala
// com o banco (quem fala é core/configuracoes.js) e não é API pública.
// É declaração + acessos, e o PADRÃO mora aqui, num lugar só.
import { pref } from '../../core/configuracoes.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal da escola na lista.', padrao: false },
  ],
};

export const mostrarTelefonesNoCard = () => pref('escolas', 'telefones_no_card') ?? false;
```

- [ ] **Step 2: `servidores.config.js`**

```js
import { pref } from '../../core/configuracoes.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal do servidor na lista.', padrao: false },
  ],
};

export const mostrarTelefonesNoCard = () => pref('servidores', 'telefones_no_card') ?? false;
```

- [ ] **Step 3: `config` nos manifestos**

`src/modules/escolas/module.js` - acrescentar antes de `load`:

```js
  config: () => import('./escolas.config.js'),
```

Idem `src/modules/servidores/module.js`.

- [ ] **Step 4: Honrar no card de Escolas**

`src/modules/escolas/escolas.view.js`: importar no topo

```js
import { mostrarTelefonesNoCard } from './escolas.config.js';
```

e em `cardHtml(u)`, acrescentar um `.tag` de telefone quando ligado e houver principal:

```js
  const tel = mostrarTelefonesNoCard()
    ? (u.telefones || []).find(t => t.principal) || (u.telefones || [])[0]
    : null;
```

e no array `tags` (antes do `.join('')`):

```js
    tel ? `<span class="tag">${ico('fixo', { tam: 12 })} ${esc(tel.numero)}</span>` : '',
```

- [ ] **Step 5: Honrar no card de Servidores**

`src/modules/servidores/views/lista.js`: importar

```js
import { mostrarTelefonesNoCard } from '../servidores.config.js';
```

e em `card(s)`, no bloco de `tags`/`lugares`, acrescentar o telefone principal quando ligado:

```js
  const tel = mostrarTelefonesNoCard()
    ? (s.telefones || []).find(t => t.principal) || (s.telefones || [])[0]
    : null;
```

e concatenar ao HTML de tags: `${tel ? `<span class="tag">${ico('fixo',{tam:12})} ${esc(tel.numero)}</span>` : ''}`.

- [ ] **Step 6: Sanidade**

Run: `node --test tests/*.mjs` → PASS.
Run: `python .claude/scripts/verificar_arquitetura.py` → sem violações (import view→config.js do próprio módulo é interno; config.js importa só kernel).

- [ ] **Step 7: Verificação no browser (controlador)**

Patch dev-local. Precisa de fixtures com telefone: `data/unidades.local.json` (escolas) já pode ter; para servidores injetar `window.__fixtureServidores` no ramo dev-local do model, OU testar só Escolas.
1. `#/escolas` → engrenagem no topo direito → clicar → gaveta "Configurações / Escolas" com o switch "Exibir telefone no card".
2. Ligar → a gaveta some/permanece; fechar → os cards mostram o telefone. Recarregar a página (`?v=N`) → o switch continua ligado (é `pref`, veio do banco - em dev-local não persiste; validar persistência na URL de dev logado).
3. `#/configuracoes` → bloco "Escolas" com o mesmo switch; bloco "Servidores" idem; nenhum outro módulo (só esses dois têm `config`).
4. Reverter o patch; `grep -rn "fixture\|dev@local\|supabaseAnonKey: ''" src/`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/escolas/ src/modules/servidores/
git commit -m "feat(configuracoes): telefone no card de Escolas e Servidores (preferencia)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Fechar a entrega

**Files:**
- Modify: `src/core/config.js`, `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-05-configuracoes-por-modulo-design.md` (nota sobre a fronteira com E/F)

- [ ] **Step 1: Nota na spec**

No fim da spec, uma seção curta:

```markdown
## Nota de implementação (05/09/2026)

O Bloco A entregou o mecanismo + o módulo Configurações + a prova real
`telefones_no_card` (Escolas e Servidores). `cards_por_linha`,
`servidores_no_card` e os painéis de Horários/Dashboard entram nas specs
E/F/G - cada uma acrescenta ao `<x>.config.js` o item que ela consome, em
vez de o Bloco A declarar tudo antecipadamente (R13).
```

- [ ] **Step 2: Versão**

`src/core/config.js`: `versao: '0.14.6'` → `versao: '0.15.0'` (MINOR - mudança de modelo: duas tabelas novas).

- [ ] **Step 3: CHANGELOG**

```markdown
## [0.15.0] - 2026-09-05

### Adicionado
- Tela de **Configurações** (em "Minha conta") e uma engrenagem no topo de
  cada módulo que tem o que ajustar. Começa com uma opção: exibir o telefone
  principal no card de Escolas e de Servidores. As preferências são suas e
  seguem o seu login; o que for decisão da rede só quem tem permissão muda.
```

- [ ] **Step 4: Verificação final**

Run: `node --test tests/*.mjs` → PASS.
Run: `python .claude/scripts/verificar_arquitetura.py` → sem violações.

- [ ] **Step 5: Commit e push**

```bash
git add src/core/config.js CHANGELOG.md docs/superpowers/specs/2026-09-05-configuracoes-por-modulo-design.md
git commit -m "chore: versao 0.15.0 e fecha o bloco de configuracoes por modulo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

- [ ] **Step 6: Pendências para o André**

Registrar no relato final: **rodar a migration 026 no SQL Editor** (depois da 025); validar em produção/dev logado que a engrenagem aparece e que ligar "Exibir telefone no card" persiste entre sessões e navegadores.

---

## Self-Review

**Spec coverage:**
- D1 (duas naturezas) → Task 1 (duas tabelas + policies distintas), Task 6 (escopo `usuario`/`rede` no item, regra de edição). ✔
- D2 (migration 026, policies, auditoria só de config_modulo, degradação) → Task 1. ✔
- D3 (kernel lê, leitura síncrona, `conf`/`pref` separados) → Task 2. ✔
- D4 (manifesto ganha `config: () => import()`) → Task 8 Step 3. ✔
- D5 (padrão na declaração, acesso pelo arquivo do módulo, `<x>.config.js` não é model) → Task 8 Steps 1-2. ✔
- D6 (campo: switch/número/opção; painel: função) → Task 6 `itemHtml` cobre os 3 tipos de campo + o ramo `painel`. ✔ (primeiro consumidor de `painel` é o Bloco G - anotado.)
- D7 (GRUPOS vocabulário fechado, `<fieldset>`+`<legend>`, grupo sem item some) → Task 2 (`GRUPOS`), Task 6 (`porGrupo.filter(g => g.itens.length)`). ✔
- D8 (barra de ações do roteador, engrenagem topo-direito, `.mod-acoes` irmã da view, `:empty` some) → Task 5. ✔
- D9 (módulo Configurações agregador, lê registry, mesmo renderizador, módulo oculto não aparece) → Task 7. ✔
- D10 (item aparece se `!== oculto`; rede editável só com escrita; rede não editável = desabilitado com valor à vista) → Task 6 `itemHtml` (`desabilita`, `disabled`, hint). ✔
- D11 (o que nasce nesta rodada) → Task 8 entrega `telefones_no_card` ×2; o resto é E/F/G, com a fronteira anotada (Task 9 Step 1). ✔
- Critérios 1-11 da spec → cobertos; 6 (recusa de gravação de rede sem escrita) depende de teste manual pelo console na URL logada - anotado na Task 9 Step 6.

**Placeholder scan:** sem TBD. Todo passo de código tem bloco.

**Type consistency:** `DECLARACAO.itens` com o mesmo shape em `painel.js` (Task 6) e nos `.config.js` (Task 8). `conf`/`pref`/`definirConf`/`definirPref`/`GRUPOS`/`limparConfiguracoes`/`_semearParaTeste` idênticos entre Task 2 (definição), Task 3 (boot), Task 6 (consumo). `abrirPainelConfig(mod)` produzido na Task 6, consumido na Task 5. `pintarConfigDoModulo(box, mod, ctx)` produzido na Task 6, consumido na Task 7.
