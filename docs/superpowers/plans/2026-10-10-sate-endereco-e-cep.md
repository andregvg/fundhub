# Endereço e CEP - Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar CEP em escolas, locais e destinos digitados; fazer o CEP e "Localizar pelo endereço" acharem o lugar; levar "Conferir local" para a aba Locais, valendo por lugar.

**Architecture:** Funções puras de formato em `shared/format.js`; consulta de CEP e busca por variantes em `locais/geografia.model.js`; um componente de campo (`shared/ui/campo-cep.js`) com a consulta injetada; três formulários que o usam. Conferência agrupa pedidos pelo destino digitado (função pura em `sate/regras.model.js`).

**Tech Stack:** JS ES modules sem build, Supabase (PostgREST), `node --test` para os testes.

**Spec:** `docs/superpowers/specs/2026-10-10-sate-endereco-e-cep-design.md`

## Global Constraints

- Sem npm, sem dependência nova. O que está no repositório roda no navegador.
- Kernel (`src/core`, `src/shared`) **nunca** importa `src/modules` (R1). View nunca chama `sb()`; model nunca toca no DOM (R3).
- Todo valor do banco ou do usuário passa por `esc()` antes de entrar em template literal (R5).
- Nenhuma cor literal em `src/modules/**` (R9). Reusar classes de `src/styles/components.css`.
- **Repositório público:** nenhum nome, e-mail, telefone, endereço ou CEP real em código, comentário, teste ou doc. Exemplos: `Rua Exemplo`, `00000-000`, `nome@exemplo.com`.
- PT-BR em código, comentário e mensagem de commit. Commits na branch `dev`, com a linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- CEP no banco: 8 dígitos sem hífen. Na tela: `00000-000`.
- Limites: view ≤ 400 linhas, model ≤ 250.
- Rodar a cada tarefa: `node --test tests/` e `python .claude/scripts/verificar_arquitetura.py` (0 bloqueantes).
- **Não** subir versão nem mexer no CHANGELOG antes da Task 6.

## Review Focus

1. CEP digitado pela metade e salvo → o formulário acusa o campo, não grava lixo.
2. Banco sem a migration 047 → quem não mexe no CEP salva como hoje; quem mexe recebe mensagem clara.
3. Resposta do serviço de CEP chega depois de a pessoa corrigir o número → descartada.
4. CEP num cadastro que já tem pino → o pino não se move sozinho.
5. Dois pedidos com o mesmo destino escrito com caixa e acento diferentes → um lugar só no bloco "A conferir".

---

### Task 1: Migration 047 e formato do CEP

**Files:**
- Create: `supabase/migrations/047_cep.sql`
- Modify: `src/shared/format.js` (acrescentar ao fim)
- Test: `tests/format-cep.test.mjs`

**Interfaces:**
- Produces: `cepDe(v) → string(8) | null`, `mascaraCep(v) → string`, `fmtCep(v) → string` em `src/shared/format.js`.

- [ ] **Step 1: Teste que falha** - criar `tests/format-cep.test.mjs`:

```js
// CEP: guardar canônico (8 dígitos), exibir com hífen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cepDe, mascaraCep, fmtCep } from '../src/shared/format.js';

test('cepDe devolve os 8 dígitos ou null', () => {
  assert.equal(cepDe('00000-000'), '00000000');
  assert.equal(cepDe('12.345-678'), '12345678');
  assert.equal(cepDe('12345678'), '12345678');
  assert.equal(cepDe('1234567'), null);
  assert.equal(cepDe('123456789'), null);
  assert.equal(cepDe(''), null);
  assert.equal(cepDe(null), null);
});

test('mascaraCep formata o que já foi digitado', () => {
  assert.equal(mascaraCep('1'), '1');
  assert.equal(mascaraCep('12345'), '12345');
  assert.equal(mascaraCep('123456'), '12345-6');
  assert.equal(mascaraCep('12345678'), '12345-678');
  assert.equal(mascaraCep('12345-678999'), '12345-678');
  assert.equal(mascaraCep('abc'), '');
});

test('fmtCep só formata CEP completo', () => {
  assert.equal(fmtCep('12345678'), '12345-678');
  assert.equal(fmtCep('1234'), '');
  assert.equal(fmtCep(null), '');
});
```

- [ ] **Step 2:** `node --test tests/format-cep.test.mjs` → FALHA (export ausente).

- [ ] **Step 3: Implementar** - ao fim de `src/shared/format.js`:

```js
// ── CEP ──────────────────────────────────────────────────────
// O banco guarda os 8 dígitos; a tela põe o hífen (mesmo critério de CPF).

// O que vai ao banco: 8 dígitos, ou null se não for um CEP inteiro.
export const cepDe = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 8 ? d : null;
};

// '12345678' → '12345-678'. Progressiva: formata o que já foi digitado.
export const mascaraCep = (v) => {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// Exibição de um valor pronto: vazio quando não é um CEP inteiro.
export const fmtCep = (v) => (cepDe(v) ? mascaraCep(v) : '');
```

- [ ] **Step 4:** `node --test tests/format-cep.test.mjs` → PASSA.

- [ ] **Step 5: Migration** - criar `supabase/migrations/047_cep.sql`:

```sql
-- ============================================================
-- 047 - CEP em escolas, locais e no destino digitado do pedido
--
-- Spec: 2026-10-10-sate-endereco-e-cep-design.md, D2.
--
-- Opcional nos tres lugares. Formato canonico: 8 digitos, sem hifen (o
-- mesmo criterio de CPF e telefone - o banco guarda o dado, a tela poe a
-- mascara). O CHECK e o que vale; a mascara do formulario e conforto.
--
-- criar_viagem() NAO muda: ela monta a linha por jsonb_populate_record,
-- que carrega `destino_cep` sozinho agora que a coluna existe.
--
-- Nenhuma tabela nova: sem policy a criar. O gatilho de auditoria ja
-- registra a coluna nova (fn_audit compara a linha inteira).
--
-- Idempotente.
-- ============================================================

alter table local                  add column if not exists cep text;
alter table unidade_escolar        add column if not exists cep text;
alter table solicitacao_transporte add column if not exists destino_cep text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'local_cep_check') then
    alter table local add constraint local_cep_check
      check (cep is null or cep ~ '^[0-9]{8}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'unidade_cep_check') then
    alter table unidade_escolar add constraint unidade_cep_check
      check (cep is null or cep ~ '^[0-9]{8}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solic_destino_cep_check') then
    alter table solicitacao_transporte add constraint solic_destino_cep_check
      check (destino_cep is null or destino_cep ~ '^[0-9]{8}$');
  end if;
end $$;

select religar_auditoria();

select registrar_migration('047',
  'CEP (8 digitos) em local, unidade_escolar e no destino digitado da solicitacao');
```

- [ ] **Step 6:** `node --test tests/` e `python .claude/scripts/verificar_arquitetura.py` → sem falha, 0 bloqueantes.

- [ ] **Step 7: Commit** - `git add supabase/migrations/047_cep.sql src/shared/format.js tests/format-cep.test.mjs` · mensagem `feat(cep): migration 047 e formato do CEP`.

---

### Task 2: Geografia - busca por variantes e consulta de CEP

**Files:**
- Modify: `src/modules/locais/geografia.model.js`
- Modify: `src/modules/escolas/localizacao.model.js` (função `procurar`)
- Test: `tests/geografia.test.mjs` (novo)

**Interfaces:**
- Produces (em `geografia.model.js`):
  - `localizarEndereco(endereco, { pausaMs = 0, continuar = () => true, buscar = geocodificar } = {})` → `Promise<{ achado: {lat,lng,formatado,rank}, precisao: 'exata'|'rua' } | { achado: null, motivo: 'aproximado'|'nada' }>`. Lança só se `buscar` lançar.
  - `lerRespostaCep(json)` → `{ cep, rua, bairro, cidade, uf, lat, lng } | null` (pura).
  - `buscarCep(cep)` → `Promise<mesmo objeto | null>`; lança se o serviço falhar.

- [ ] **Step 1: Teste que falha** - criar `tests/geografia.test.mjs`:

```js
// Geografia: o que dá para testar sem rede - a leitura da resposta do
// serviço de CEP e a ordem de tentativas de "localizar pelo endereço".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerRespostaCep, localizarEndereco } from '../src/modules/locais/geografia.model.js';

test('lerRespostaCep lê endereço e coordenada', () => {
  const r = lerRespostaCep({
    cep: '00000000', address: 'Rua Exemplo', district: 'Centro',
    city: 'Ribeirão Preto', state: 'SP', lat: '-21.17', lng: '-47.80',
  });
  assert.deepEqual(r, {
    cep: '00000000', rua: 'Rua Exemplo', bairro: 'Centro',
    cidade: 'Ribeirão Preto', uf: 'SP', lat: -21.17, lng: -47.8,
  });
});

test('lerRespostaCep: CEP que não existe vira null', () => {
  assert.equal(lerRespostaCep({ code: 'not_found', message: 'x' }), null);
  assert.equal(lerRespostaCep(null), null);
  assert.equal(lerRespostaCep({}), null);
});

test('lerRespostaCep: coordenada inválida não derruba o endereço', () => {
  const r = lerRespostaCep({ cep: '00000-000', address: 'Rua Exemplo', lat: '', lng: '' });
  assert.equal(r.cep, '00000000');
  assert.equal(r.rua, 'Rua Exemplo');
  assert.equal(r.lat, null);
  assert.equal(r.lng, null);
});

const RUA = { lat: -21.1, lng: -47.8, formatado: 'Rua Exemplo, Centro, Ribeirão Preto, São Paulo, Brasil', rank: 26 };
const CASA = { ...RUA, rank: 30 };
const BAIRRO = { ...RUA, formatado: 'Centro, Ribeirão Preto, São Paulo, Brasil', rank: 20 };
const FORA = { ...RUA, formatado: 'Rua Exemplo, Centro, Cidade Exemplo, Brasil' };

test('localizarEndereco acha na segunda variante (sem bairro e sem s/n)', async () => {
  const vistas = [];
  const buscar = async (q) => { vistas.push(q); return vistas.length === 1 ? null : RUA; };
  const r = await localizarEndereco('Rua Exemplo, s/n - Centro', { buscar });
  assert.deepEqual(vistas, ['Rua Exemplo, s/n - Centro', 'Rua Exemplo']);
  assert.equal(r.achado, RUA);
  assert.equal(r.precisao, 'rua');
});

test('localizarEndereco: casa com número é precisão exata', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100', { buscar: async () => CASA });
  assert.equal(r.precisao, 'exata');
});

test('localizarEndereco descarta bairro inteiro e diz o motivo', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100 - Centro', { buscar: async () => BAIRRO });
  assert.deepEqual(r, { achado: null, motivo: 'aproximado' });
});

test('localizarEndereco descarta resposta de outra cidade', async () => {
  const r = await localizarEndereco('Rua Exemplo, 100', { buscar: async () => FORA });
  assert.deepEqual(r, { achado: null, motivo: 'nada' });
});

test('localizarEndereco para quando mandam parar', async () => {
  let n = 0;
  const r = await localizarEndereco('Rua Exemplo, s/n - Centro', {
    buscar: async () => { n++; return null; }, continuar: () => n === 0,
  });
  assert.equal(n, 1);
  assert.equal(r.achado, null);
});

test('localizarEndereco propaga a falha do serviço', async () => {
  await assert.rejects(
    localizarEndereco('Rua Exemplo, 100', { buscar: async () => { throw new Error('fora do ar'); } }),
    /fora do ar/);
});
```

- [ ] **Step 2:** `node --test tests/geografia.test.mjs` → FALHA.

- [ ] **Step 3: Implementar em `geografia.model.js`.**

(a) `buscarJson` ganha a opção de tratar 404 como "não existe":

```js
// Serviço público fora do ar não pode deixar botão girando para sempre.
// `nuloEm404`: o serviço de CEP responde 404 para CEP que não existe - é
// resposta, não falha.
async function buscarJson(url, { nuloEm404 = false } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (r.status === 404 && nuloEm404) return null;
    if (!r.ok) throw new Error(`Serviço de mapa respondeu ${r.status}.`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}
```

(b) Logo depois de `variantesDeEndereco`:

```js
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

// Procura um endereço tentando as variantes, da mais completa à mais
// enxuta. Devolve { achado, precisao } ou { achado: null, motivo }:
//   'aproximado' - o mapa só achou o bairro ou a cidade (erra quilômetros,
//                  e gravar isso seria pior que não ter localização);
//   'nada'       - não achou, ou achou em outra cidade.
// Lança só se o SERVIÇO falhar. `pausaMs` separa as consultas (o Nominatim
// aceita uma por segundo); `continuar` é como quem chama manda parar.
// `buscar` existe para o teste trocar a rede.
//
// Três usos: o lote de escolas e os dois formulários com "Localizar pelo
// endereço" (spec 2026-10-10-sate-endereco-e-cep, D1).
export async function localizarEndereco(endereco, { pausaMs = 0, continuar = () => true, buscar = geocodificar } = {}) {
  let motivo = 'nada';
  const variantes = variantesDeEndereco(endereco);
  for (let i = 0; i < variantes.length; i++) {
    if (!continuar()) break;
    if (i > 0 && pausaMs) await esperar(pausaMs);
    const r = await buscar(variantes[i]);
    if (!r || !naCidade(r)) continue;
    const precisao = precisaoDe(r);
    if (precisao === 'aproximada') { motivo = 'aproximado'; continue; }
    return { achado: r, precisao };
  }
  return { achado: null, motivo };
}
```

(c) Ao fim do bloco "Geografia: localizar e medir" (antes de `temCoordenada` não importa - é função declarada, sofre hoisting):

```js
// ── CEP ──────────────────────────────────────────────────────
// Rua, bairro e um ponto NO NÍVEL DA RUA a partir do CEP. É o que acha o
// lugar quando o nome oficial da rua difere do nome no OpenStreetMap.
// Serviço público, sem chave (spec 2026-10-10-sate-endereco-e-cep, D4).
// Sai do navegador só o CEP - nunca dado de pessoa.

// A resposta do serviço → o que o FundHub usa. Pura.
export function lerRespostaCep(json) {
  const cep = String(json?.cep ?? '').replace(/\D/g, '');
  if (!json || json.code === 'not_found' || cep.length !== 8) return null;
  const temPonto = temCoordenada(json.lat, json.lng);
  return {
    cep,
    rua: String(json.address || '').trim(),
    bairro: String(json.district || '').trim(),
    cidade: String(json.city || '').trim(),
    uf: String(json.state || '').trim(),
    lat: temPonto ? Number(json.lat) : null,
    lng: temPonto ? Number(json.lng) : null,
  };
}

// null = CEP que não existe. Lança se o serviço falhar ou demorar.
export async function buscarCep(cep) {
  const d = String(cep ?? '').replace(/\D/g, '');
  if (d.length !== 8) throw new Error('Informe os 8 dígitos do CEP.');
  return lerRespostaCep(await buscarJson(`https://cep.awesomeapi.com.br/json/${d}`, { nuloEm404: true }));
}

// A cidade do CEP é a da rede? Para o formulário avisar quando não é.
export const cepNaCidade = (r) => !r?.cidade || norm(r.cidade) === norm(CIDADE_PADRAO.split(',')[0]);
```

- [ ] **Step 4:** `node --test tests/geografia.test.mjs` → PASSA.

- [ ] **Step 5: O lote de escolas usa a mesma função.** Em `src/modules/escolas/localizacao.model.js`:
  - no import de `geografia.model.js`, trocar `geocodificar, precisaoDe, naCidade, variantesDeEndereco` por `localizarEndereco` (manter `temCoordenada`);
  - substituir a função `procurar` inteira por:

```js
// Procura uma escola pelas variantes do endereço (geografia.model.js).
// Devolve { achado, precisao } ou { achado: null }; lança só se o SERVIÇO
// falhar. A pausa depois da chamada mantém o ritmo entre uma escola e a
// seguinte; a pausa ENTRE variantes é da própria função.
async function procurar(u) {
  const r = await localizarEndereco(u.endereco, {
    pausaMs: INTERVALO_MS, continuar: () => !_tarefa.cancelada,
  });
  await esperar(INTERVALO_MS);
  return r;
}
```
  Conferir com `grep -n "geocodificar\|precisaoDe\|naCidade\|variantesDeEndereco" src/modules/escolas/localizacao.model.js` que nenhum símbolo removido do import continua em uso (se `precisao` for lido de `resultado.precisao`, continua funcionando - o campo existe).

- [ ] **Step 6:** `node --test tests/` → tudo passa; verificador → 0 bloqueantes.

- [ ] **Step 7: Commit** - `feat(geografia): localizar pelo endereco tenta as variantes e consulta de CEP`.

---

### Task 3: Campo de CEP nos cadastros de local e de escola

**Files:**
- Create: `src/shared/ui/campo-cep.js`
- Modify: `src/modules/locais/locais.model.js`, `src/modules/escolas/escolas.model.js`
- Modify: `src/modules/sate/views/locais.js`, `src/modules/escolas/views/formulario.js`, `src/modules/escolas/views/detalhe.js`

**Interfaces:**
- Consumes: `cepDe`, `mascaraCep`, `fmtCep` (Task 1); `buscarCep`, `cepNaCidade`, `localizarEndereco` (Task 2).
- Produces: `ligarCep(input, { buscar, dica, aoAchar })` em `src/shared/ui/campo-cep.js`. `aoAchar(r, dizer)` recebe o objeto de `buscarCep` e `dizer(texto, erro = false)`.

- [ ] **Step 1: O componente** - criar `src/shared/ui/campo-cep.js`:

```js
// ============================================================
// FundHub - shared/ui/campo-cep.js
// Campo de CEP: máscara enquanto se digita e consulta ao completar os
// oito dígitos (spec 2026-10-10-sate-endereco-e-cep, D5).
//
// É componente, e não função solta, porque tem comportamento (R12):
// descarta a resposta atrasada - a pessoa corrigiu o CEP antes de a
// primeira consulta voltar - e mantém o texto de estado em `dica`.
//
// `buscar` é INJETADO por quem usa: o kernel não importa modules/ (R1), e
// este arquivo não precisa saber de onde a resposta vem. O que fazer com
// ela (`aoAchar`) é de cada formulário.
//
//   ligarCep(input, { buscar, dica, aoAchar })
//     buscar(cep8)        → Promise<objeto | null>   (null = não existe)
//     dica                → elemento que recebe o texto de estado (aria-live)
//     aoAchar(r, dizer)   → dizer(texto, erro = false) escreve na dica
// ============================================================
import { mascaraCep, cepDe } from '../format.js';

export function ligarCep(input, { buscar, dica = null, aoAchar }) {
  let pedido = 0;
  // O CEP que já veio preenchido não é consultado de novo ao abrir.
  let ultimo = cepDe(input.value);

  const dizer = (texto, erro = false) => {
    if (!dica) return;
    dica.textContent = texto;
    dica.classList.toggle('err', !!erro);
  };

  input.addEventListener('input', async () => {
    input.value = mascaraCep(input.value);
    const cep = cepDe(input.value);
    if (!cep) { ultimo = null; pedido++; dizer(''); return; }
    if (cep === ultimo) return;
    ultimo = cep;
    const meu = ++pedido;
    dizer('Procurando…');
    try {
      const r = await buscar(cep);
      if (meu !== pedido || !input.isConnected) return;   // resposta velha, ou o modal fechou
      if (!r) return dizer('CEP não encontrado. Confira os números ou preencha o endereço à mão.', true);
      dizer('');
      aoAchar(r, dizer);
    } catch (_) {
      if (meu === pedido) dizer('O serviço de CEP não respondeu. Preencha o endereço à mão.', true);
    }
  });
}
```

- [ ] **Step 2: Models.**

`src/modules/locais/locais.model.js`:
  - `COLS` passa a incluir `cep` (depois de `bairro`);
  - a constante `COLS_ANTIGAS` e o comentário dela são substituídos por:

```js
// Sem a migration 047 a coluna `cep` não existe (42703): lê sem ela.
const COLS_SEM_CEP = 'id, nome, endereco, numero, bairro, desembarque, latitude, longitude, maps_url, ativo, obs';
```
  - em `getLocais`, o segundo `select` usa `COLS_SEM_CEP`;
  - `CAMPOS` ganha `'cep'` (depois de `'bairro'`).

`src/modules/escolas/escolas.model.js`: `CAMPOS` ganha `'cep'` (depois de `'endereco'`).

- [ ] **Step 3: Formulário de local** (`src/modules/sate/views/locais.js`).

Imports: acrescentar `localizarEndereco, buscarCep, cepNaCidade` ao import de `geografia.model.js` (tirar `geocodificar`); `import { fmtCep, cepDe } from '../../../shared/format.js';`; `import { ligarCep } from '../../../shared/ui/campo-cep.js';`.

(a) Grupo **Endereço**, na ordem CEP → Endereço → Número → Bairro:

```html
<fieldset class="form-grupo">
  <legend>Endereço</legend>
  <div class="campos auto">
    <label>CEP <input id="l-cep" inputmode="numeric" autocomplete="postal-code" maxlength="9"
        value="${esc(fmtCep(base?.cep))}" placeholder="00000-000" />
      <small class="form-hint" id="l-cep-dica" aria-live="polite">Preenche rua e bairro e ajuda a achar o lugar no mapa.</small></label>
    <label class="col-full">Endereço <input id="l-end" value="${v('endereco')}" placeholder="Ex.: Rua Exemplo" /></label>
    <label>Número <input id="l-num" inputmode="numeric" value="${v('numero')}" placeholder="Ex.: 123" /></label>
    <label>Bairro <input id="l-bairro" value="${v('bairro')}" placeholder="Ex.: Centro" /></label>
  </div>
</fieldset>
```

(b) Na `.geo-linha` do grupo Localização, depois do botão `#l-geo`:

```html
<button type="button" class="mini-btn" id="l-cep-pino" hidden>${ico('visita', { tam: 13 })} Mover o pino para este CEP</button>
```

(c) Depois dos `addEventListener` de `abrirLocal`:

```js
ligarCep(document.getElementById('l-cep'), {
  buscar: buscarCep, dica: document.getElementById('l-cep-dica'), aoAchar: aoAcharCep,
});
```

(d) Funções novas no arquivo:

```js
// O CEP não destrói o que já foi conferido (spec 2026-10-10, D6): rua e
// bairro só entram em campo VAZIO, o número nunca é tocado, e um pino que
// já existe só se move pelo botão. Preencher por CEP é gesto da pessoa -
// os campos escritos contam como digitados (marcarTocado).
function aoAcharCep(r, dizer) {
  const preencher = (id, valor) => {
    const c = document.getElementById(id);
    if (!c || c.value.trim() || !valor) return;
    marcarTocado(c); c.value = valor;
  };
  preencher('l-end', r.rua);
  preencher('l-bairro', r.bairro);

  const onde = [r.rua, r.bairro].filter(Boolean).join(' - ') || 'CEP sem logradouro';
  const fora = cepNaCidade(r) ? '' : ` · CEP de ${[r.cidade, r.uf].filter(Boolean).join('/')}`;
  dizer(`Encontrado: ${onde}${fora}`);

  const botao = document.getElementById('l-cep-pino');
  botao.hidden = true;
  if (r.lat == null) return;
  const temPino = temCoordenada(val('l-lat'), val('l-lng'));
  const mover = () => { aoMover(r.lat, r.lng); mapaAtual?.mover(r.lat, r.lng); botao.hidden = true; };
  if (!temPino) return mover();
  botao.hidden = false;
  botao.onclick = mover;
}
```

(e) `localizar()` passa a tentar as variantes. Substituir o corpo do `try` por:

```js
    const r = await localizarEndereco(enderecoDoForm(), { pausaMs: 1100 });
    if (!r.achado) {
      dica.textContent = r.motivo === 'aproximado'
        ? 'Só encontrei o bairro, não a rua. Informe o CEP ou acerte o pino à mão.'
        : 'Endereço não encontrado. Informe o CEP, ou copie as coordenadas do Google Maps: clique com o botão direito no lugar e clique nos números.';
      return;
    }
    aoMover(r.achado.lat, r.achado.lng);
    mapaAtual?.mover(r.achado.lat, r.achado.lng);
    dica.textContent = `Encontrado: ${r.achado.formatado} · ${r.precisao === 'rua'
      ? 'achei a rua, não o número: acerte o pino no mapa antes de salvar.'
      : 'conferir no mapa acima antes de salvar.'}`;
```
  (`textContent`, não `innerHTML`: o texto vem de um serviço externo.) Atualizar o comentário acima de `localizar`: tirar o parágrafo "Segunda cópia desta ligação… (R13)" - a busca agora é uma função só em `geografia.model.js`.

(f) Em `salvar`: antes de montar o payload,

```js
  const cepTexto = val('l-cep');
  const cep = cepDe(cepTexto);
  if (cepTexto && !cep) return falhaNoCampo(msg, '#l-cep', 'CEP incompleto: são 8 dígitos.');
```
  e no payload, depois de `bairro`:

```js
    // Só entra quando foi preenchido, ou quando havia um e foi apagado:
    // quem não mexe no CEP salva igual com ou sem a migration 047.
    ...(cep || l?.cep ? { cep } : {}),
```
  No `catch`, trocar a condição e o texto do primeiro ramo por:

```js
    if (['42703', 'PGRST204'].includes(err?.code)) {
      falha(msg, 'O banco ainda não tem o campo CEP. Avise a Gerência.');
    }
```

(g) No `card(l)`, a linha do endereço mostra o CEP:

```js
    ${enderecoCompleto(l) ? `<div class="addr">${esc(enderecoCompleto(l))}${l.cep ? ` · CEP ${esc(fmtCep(l.cep))}` : ''}</div>` : ''}
```

- [ ] **Step 4: Formulário de escola** (`src/modules/escolas/views/formulario.js`).

Imports: trocar `geocodificar` por `localizarEndereco, buscarCep, cepNaCidade` no import de `geografia.model.js`; acrescentar `falha` ao import de `shared/dom.js`; `import { fmtCep, cepDe } from '../../../shared/format.js';`; `import { ligarCep } from '../../../shared/ui/campo-cep.js';`.

(a) No grupo **Localização**, antes do `<label class="col-full">Endereço`:

```html
<label>CEP <input name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9"
    value="${esc(fmtCep(u?.cep))}" placeholder="00000-000" />
  <small class="form-hint" id="ef-cep-dica" aria-live="polite">Preenche o endereço e ajuda a achar a escola no mapa.</small></label>
```
  e na `.geo-linha`, depois do botão `#ef-geo`:

```html
<button type="button" class="mini-btn" id="ef-cep-pino" hidden>${ico('visita', { tam: 13 })} Mover o pino para este CEP</button>
```

(b) Em `abrirForm`, depois de `mapaAtual = null; montarMapaPino(…)…` (o `f` já existe):

```js
  // CEP (spec 2026-10-10, D6): endereço só se estiver vazio; o pino que já
  // existe só se move pelo botão.
  ligarCep(f.cep, {
    buscar: buscarCep, dica: document.getElementById('ef-cep-dica'),
    aoAchar: (r, dizer) => {
      const texto = [r.rua, r.bairro].filter(Boolean).join(', ');
      if (!f.endereco.value.trim() && texto) { marcarTocado(f.endereco); f.endereco.value = texto; }
      const fora = cepNaCidade(r) ? '' : ` · CEP de ${[r.cidade, r.uf].filter(Boolean).join('/')}`;
      dizer(`Encontrado: ${texto || 'CEP sem logradouro'}${fora}`);
      const botao = document.getElementById('ef-cep-pino');
      botao.hidden = true;
      if (r.lat == null) return;
      const mover = () => {
        marcarTocado(f.latitude); marcarTocado(f.longitude);
        f.latitude.value = r.lat.toFixed(6); f.longitude.value = r.lng.toFixed(6);
        mapaAtual?.mover(r.lat, r.lng);
        botao.hidden = true;
      };
      if (!temCoordenada(f.latitude.value.trim(), f.longitude.value.trim())) return mover();
      botao.hidden = false;
      botao.onclick = mover;
    },
  });
```

(c) `localizar()`: substituir o corpo do `try` por

```js
    const r = await localizarEndereco(f.endereco.value, { pausaMs: 1100 });
    if (!r.achado) {
      dica.textContent = r.motivo === 'aproximado'
        ? 'Só encontrei o bairro, não a rua. Informe o CEP ou acerte o pino à mão.'
        : 'Endereço não encontrado. Informe o CEP, ou copie as coordenadas do Google Maps: clique com o botão direito no lugar e clique nos números.';
      return;
    }
    marcarTocado(f.latitude); marcarTocado(f.longitude);   // "Localizar" também é gesto dela
    f.latitude.value = r.achado.lat.toFixed(6);
    f.longitude.value = r.achado.lng.toFixed(6);
    mapaAtual?.mover(r.achado.lat, r.achado.lng);
    dica.innerHTML = `Encontrado: ${esc(r.achado.formatado)} · <a href="${esc(linkMaps(r.achado.lat, r.achado.lng))}" target="_blank" rel="noopener">conferir no mapa</a> antes de salvar${r.precisao === 'rua' ? ' - achei a rua, não o número' : ''}.`;
```
  e tirar do comentário acima o parágrafo "Primeira de duas cópias… (R13)".

(d) Em `salvar`, antes do payload:

```js
  const cep = cepDe(f.cep.value);
  if (f.cep.value.trim() && !cep) return falhaNoCampo(msg, f.cep, 'CEP incompleto: são 8 dígitos.');
```
  no payload, depois de `endereco`: `...(cep || u?.cep ? { cep } : {}),`
  e no `catch`, antes do `reportarErro`:

```js
    if (['42703', 'PGRST204'].includes(err?.code)) {
      falha(msg, 'O banco ainda não tem o campo CEP. Avise a Gerência.');
      btn.disabled = false; btn.textContent = u ? 'Salvar' : 'Criar';
      return;
    }
```

- [ ] **Step 5: Ficha da escola** (`src/modules/escolas/views/detalhe.js`). Importar `fmtCep` de `shared/format.js` (acrescentar ao import existente desse arquivo, se houver) e, na linha do endereço da `.ficha-contato`:

```js
        ${linha('visita', u.endereco
          ? esc(u.endereco) + (u.cep ? ` · CEP ${esc(fmtCep(u.cep))}` : '')
            + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : '')
          : '')}
```

- [ ] **Step 6:** `node --test tests/` → passa; verificador → 0 bloqueantes; `grep -n "geocodificar" src/modules/sate/views/locais.js src/modules/escolas/views/formulario.js` → nada.

- [ ] **Step 7: Commit** - `feat(cep): campo de CEP no cadastro de local e de escola`.

---

### Task 4: CEP no destino digitado do pedido

**Files:**
- Modify: `src/modules/sate/views/formulario-destino.js`, `src/modules/sate/views/formulario.js`, `src/modules/sate/views/detalhe.js`

**Interfaces:**
- Consumes: `ligarCep`, `buscarCep`, `cepDe`, `fmtCep`.
- Produces: `lerDestino()` passa a devolver também `cep` (8 dígitos ou `null`).

- [ ] **Step 1: `formulario-destino.js`.**

Imports: `import { buscarCep } from '../../locais/geografia.model.js';`, `import { ligarCep } from '../../../shared/ui/campo-cep.js';`, `import { cepDe, fmtCep } from '../../../shared/format.js';`.

(a) Em `destinoHtml`, antes do rótulo Endereço:

```html
<label class="col-2">CEP <input id="f-dest-cep" type="text" inputmode="numeric" maxlength="9" placeholder="00000-000" readonly />
  <small class="form-hint" id="f-dest-cep-dica" aria-live="polite">Opcional. Preenche o endereço.</small></label>
```

(b) `preencher(l)` ganha `campo('f-dest-cep').value = fmtCep(l?.cep);`.

(c) `destravar(novo)` ganha `campo('f-dest-cep').readOnly = !novo;` (o CEP **não** vira obrigatório - fica fora do array `ENDERECO`).

(d) Em `ligarDestino`, depois dos `addEventListener` de `f-dest-end`/`f-dest-num`:

```js
  // Só dispara para local NOVO: campo somente-leitura não emite `input`.
  ligarCep(campo('f-dest-cep'), {
    buscar: buscarCep, dica: campo('f-dest-cep-dica'),
    aoAchar: (r, dizer) => {
      if (!campo('f-dest-end').value.trim() && r.rua) campo('f-dest-end').value = r.rua;
      if (!campo('f-dest-bairro').value.trim() && r.bairro) campo('f-dest-bairro').value = r.bairro;
      dizer(`Encontrado: ${[r.rua, r.bairro].filter(Boolean).join(' - ') || 'CEP sem logradouro'}`);
      pintarMesmo();
    },
  });
```

(e) `lerDestino()`: no ramo do cadastro acrescentar `cep: l.cep || null`; no ramo do novo, `cep: cepDe(val('f-dest-cep'))`.

(f) `validarDestino(d)`: depois da checagem de `falta`,

```js
  if (val('f-dest-cep') && !cepDe(val('f-dest-cep'))) return { campo: campo('f-dest-cep'), texto: 'CEP incompleto: são 8 dígitos.' };
```

- [ ] **Step 2: `formulario.js`** - no objeto `viagem`, depois de `destino_bairro`:

```js
    ...(d.cep ? { destino_cep: d.cep } : {}),
```

- [ ] **Step 3: `detalhe.js`** - o CEP ao lado do endereço do destino. Importar `fmtCep` de `shared/format.js` (o arquivo já importa `fmtData, fmtDataHora` de lá) e trocar `enderecoDestino` por:

```js
// O CEP vem do local do cadastro quando o pedido aponta para um; senão,
// do que a escola digitou.
const cepDestino = (s) => (s.local_id ? (ctx.locais || []).find(l => l.id === s.local_id)?.cep : s.destino_cep) || '';

const enderecoDestino = (s) => {
  const linha = enderecoCompleto({ endereco: s.destino_endereco, numero: s.destino_numero, bairro: s.destino_bairro })
    || s.atividade?.local_endereco || '';
  return linha && cepDestino(s) ? `${linha} · CEP ${fmtCep(cepDestino(s))}` : linha;
};
```
  (manter o comentário que já existia acima de `enderecoDestino`.)

- [ ] **Step 4:** `node --test tests/`; verificador → 0 bloqueantes.

- [ ] **Step 5: Commit** - `feat(sate): CEP no destino digitado do pedido`.

---

### Task 5: Conferir local por lugar, e na aba Locais

**Files:**
- Modify: `src/modules/sate/regras.model.js`, `src/modules/sate/sate.model.js`
- Modify: `src/modules/sate/views/conferir-local.js`, `src/modules/sate/views/locais.js`, `src/modules/sate/views/detalhe.js`, `src/modules/sate/sate.css`
- Test: `tests/sate-regras.test.mjs` (acrescentar)

**Interfaces:**
- Produces:
  - `chaveDestino(s) → string` e `agruparDestinos(pedidos) → [{ chave, nome, endereco, numero, bairro, cep, pedidos }]` em `regras.model.js` (puras).
  - `destinosAConferir() → Promise<pedido[]>` e `vincularLocal(ids, local) → Promise<patch>` em `sate.model.js` (`ids`: um id ou um array).
  - `abrirConferirLocal(lugar, ctx, aoConcluir)` e `abrirConferirDoPedido(s, ctx, reabrir)` em `views/conferir-local.js`.

- [ ] **Step 1: Teste que falha** - ao fim de `tests/sate-regras.test.mjs` (ajustar o import do topo para incluir `chaveDestino, agruparDestinos`):

```js
// ── Conferir local por LUGAR (spec 2026-10-10-sate-endereco-e-cep, D8) ──
const ped = (id, nome, endereco, numero, extra = {}) => ({
  id, destino_nome: nome, destino_endereco: endereco, destino_numero: numero,
  destino_bairro: 'Centro', destino_cep: null, ...extra,
});

test('agruparDestinos junta o mesmo lugar escrito de jeitos diferentes', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'TEATRO EXEMPLO ', 'rua  exemplo', '100', { destino_bairro: 'Outro' }),
    ped('c', 'Téatro Exemplo', 'Rua Exemplo.', '100'),
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].pedidos.map(p => p.id), ['a', 'b', 'c']);
  assert.equal(g[0].nome, 'Teatro Exemplo');
});

test('agruparDestinos separa lugares diferentes na mesma rua', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'Museu Exemplo', 'Rua Exemplo', '100'),
    ped('c', 'Teatro Exemplo', 'Rua Exemplo', '200'),
  ]);
  assert.equal(g.length, 3);
});

test('agruparDestinos aproveita o CEP de quem informou e ordena por nome', () => {
  const g = agruparDestinos([
    ped('a', 'Teatro Exemplo', 'Rua Exemplo', '100'),
    ped('b', 'Museu Exemplo', 'Rua Modelo', '5'),
    ped('c', 'Teatro Exemplo', 'Rua Exemplo', '100', { destino_cep: '00000000' }),
  ]);
  assert.deepEqual(g.map(x => x.nome), ['Museu Exemplo', 'Teatro Exemplo']);
  assert.equal(g[1].cep, '00000000');
});

test('agruparDestinos ignora pedido sem destino digitado', () => {
  assert.deepEqual(agruparDestinos([{ id: 'x', destino_nome: null }]), []);
  assert.deepEqual(agruparDestinos(null), []);
});

test('chaveDestino não depende de bairro nem de CEP', () => {
  assert.equal(
    chaveDestino(ped('a', 'Teatro', 'Rua A', '1')),
    chaveDestino(ped('b', 'Teatro', 'Rua A', '1', { destino_bairro: 'X', destino_cep: '00000000' })));
});
```

- [ ] **Step 2:** `node --test tests/sate-regras.test.mjs` → FALHA.

- [ ] **Step 3: `regras.model.js`** - conferir se o arquivo já importa `norm` de `../../shared/dom.js`; se não, acrescentar `import { norm } from '../../shared/dom.js';`. Ao fim do arquivo:

```js
// ── Conferir local por LUGAR ─────────────────────────────────
// Dois pedidos apontam para o MESMO destino digitado quando nome, rua e
// número coincidem sem acento, caixa e pontuação. Bairro e CEP ficam fora
// da chave: são os que a escola mais erra (spec 2026-10-10-sate-endereco-e-cep, D8).
const limpo = (v) => norm(v).replace(/[^a-z0-9]+/g, ' ').trim();

export const chaveDestino = (s) =>
  [s?.destino_nome, s?.destino_endereco, s?.destino_numero].map(limpo).join('|');

// Os pedidos com destino digitado, um grupo por lugar. O texto exibido é
// o do primeiro pedido; o CEP, o primeiro que alguém informou.
export function agruparDestinos(pedidos) {
  const grupos = new Map();
  for (const s of pedidos || []) {
    if (!String(s?.destino_nome || '').trim()) continue;
    const chave = chaveDestino(s);
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, nome: s.destino_nome.trim(), endereco: s.destino_endereco || '', numero: s.destino_numero || '',
        bairro: s.destino_bairro || '', cep: null, pedidos: [] };
      grupos.set(chave, g);
    }
    g.cep = g.cep || s.destino_cep || null;
    g.pedidos.push(s);
  }
  return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}
```

- [ ] **Step 4:** `node --test tests/sate-regras.test.mjs` → PASSA.

- [ ] **Step 5: `sate.model.js`.** Substituir `vincularLocal` (e o comentário dela) por:

```js
// Os pedidos com destino digitado que ainda não são local do cadastro
// (spec 2026-10-10-sate-endereco-e-cep, D8). Negado e cancelado ficam de
// fora: não há mais viagem para a qual conferir o endereço.
export async function destinosAConferir() {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('solicitacao_transporte')
    .select(SELECT_BASE).is('local_id', null).not('destino_nome', 'is', null)
    .not('status', 'in', '(negado,cancelado)').order('data');
  if (error) { if (ausente(error)) return []; throw error; }
  return data || [];
}

// A SME apontou o destino digitado para um local do cadastro ("É este" ou
// "Cadastrar novo"). Vale para o LUGAR: `ids` são todos os pedidos que
// digitaram aquele destino, e mudam juntos. Troca SÓ o destino - data,
// horários, escolas e veículos ficam. O texto da escola fica no audit_log.
export async function vincularLocal(ids, local) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = {
    local_id: local.id,
    destino_nome: local.nome,
    destino_endereco: local.endereco || null,
    destino_numero: local.numero || null,
    destino_bairro: local.bairro || null,
    // Só quando o local tem CEP: sem a migration 047 a coluna não existe.
    ...(local.cep ? { destino_cep: local.cep } : {}),
  };
  const { error } = await sb().from('solicitacao_transporte')
    .update({ ...patch, atualizado_em: agoraISO() }).in('id', [].concat(ids));
  if (error) throw error;
  return patch;
}
```

- [ ] **Step 6: `views/conferir-local.js`** - reescrever o arquivo:

```js
// ============================================================
// FundHub - sate/views/conferir-local.js
// "Conferir local" (spec 2026-09-27, D6; por LUGAR desde a spec
// 2026-10-10-sate-endereco-e-cep, D8): o destino que as escolas digitaram
// vira um local do cadastro - um existente ("É este") ou um novo,
// conferido no mapa ("Cadastrar novo"). Todos os pedidos que digitaram
// aquele destino mudam juntos; o trajeto de cada um é recalculado.
//
// Abre por dois caminhos: a aba Locais (bloco "A conferir") e a ficha de
// um pedido.
// ============================================================
import { vincularLocal, destinosAConferir } from '../sate.model.js';
import { agruparDestinos, chaveDestino } from '../regras.model.js';
import { locaisParecidos, enderecoCompleto } from '../../locais/locais.model.js';
import { atualizarTrajeto, retratoTrajeto } from '../rota.model.js';
import { velocidadeOnibusKmh, margemParadaMin } from '../sate.config.js';
import { abrirLocal } from './locais.js';
import { esc } from '../../../shared/dom.js';
import { fmtCep } from '../../../shared/format.js';
import { modalHead, abrirModal } from '../../../shared/ui/modal.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';

const quantos = (n) => (n === 1 ? '1 pedido' : `${n} pedidos`);

// `lugar`: um grupo de agruparDestinos() - { nome, endereco, numero,
// bairro, cep, pedidos }. `aoConcluir` roda depois de vincular.
export function abrirConferirLocal(lugar, ctx, aoConcluir) {
  const parecidos = locaisParecidos(lugar, ctx.locais || []);
  const linha = [enderecoCompleto(lugar), lugar.cep ? `CEP ${fmtCep(lugar.cep)}` : ''].filter(Boolean).join(' · ');

  abrirModal(`
    ${modalHead('Conferir local', 'O destino que a escola digitou')}
    <div class="modal-body" id="conf-corpo">
      <div class="conf-digitado">
        <b>${esc(lugar.nome)}</b>
        <div class="di-meta">${esc(linha) || 'sem endereço'}</div>
        <div class="di-meta">Usado em ${quantos(lugar.pedidos.length)}.</div>
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
    </div>`, { tamanho: 'medio', voltar: aoConcluir });

  const corpo = document.getElementById('conf-corpo');
  corpo.querySelectorAll('[data-local]').forEach(b => b.addEventListener('click', () =>
    vincular(lugar, ctx, (ctx.locais || []).find(l => l.id === b.dataset.local), aoConcluir)));
  document.getElementById('conf-novo').addEventListener('click', () =>
    abrirLocal(null, {
      preenchido: { nome: lugar.nome, endereco: lugar.endereco, numero: lugar.numero, bairro: lugar.bairro, cep: lugar.cep },
      aoSalvar: (novo) => vincular(lugar, ctx, novo, aoConcluir),
    }, ctx));
}

// A partir da ficha de UM pedido: acha os outros pedidos do mesmo lugar e
// confere todos. O objeto `s` aberto na ficha entra no grupo no lugar da
// cópia vinda do banco - é ele que a ficha redesenha depois.
export async function abrirConferirDoPedido(s, ctx, reabrir) {
  const todos = await destinosAConferir().catch(() => []);
  const mesmo = todos.filter(p => p.id !== s.id && chaveDestino(p) === chaveDestino(s));
  abrirConferirLocal(agruparDestinos([s, ...mesmo])[0], ctx, reabrir);
}

async function vincular(lugar, ctx, local, aoConcluir) {
  if (!local) return;
  try {
    const patch = await vincularLocal(lugar.pedidos.map(p => p.id), local);
    // Um por vez: cada trajeto é uma consulta ao serviço de rotas.
    for (const p of lugar.pedidos) {
      Object.assign(p, patch);
      const r = await atualizarTrajeto(p, { velocidadeKmh: velocidadeOnibusKmh(), margemMin: margemParadaMin() }).catch(() => null);
      if (r) Object.assign(p, retratoTrajeto(r));
    }
    ctx.recarregar?.();
    toast({ titulo: 'Local conferido', texto: `${local.nome} · ${quantos(lugar.pedidos.length)}`, tipo: 'sucesso' });
    await aoConcluir();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível vincular o local' });
  }
}
```

- [ ] **Step 7: `views/detalhe.js`** - trocar o import `abrirConferirLocal` por `abrirConferirDoPedido` e a linha que liga `#det-conferir` por:

```js
  corpo.querySelector('#det-conferir')?.addEventListener('click', () => abrirConferirDoPedido(s, ctx, () => abrirDetalhe(s, ctx)));
```

- [ ] **Step 8: `views/locais.js` - o bloco "A conferir".**

Atenção ao ciclo de imports: `conferir-local.js` já importa `abrirLocal` de `locais.js`. Para `locais.js` abrir a conferência **sem fechar um ciclo** (R4), usar `import()` dinâmico no clique. Imports estáticos novos: `import { destinosAConferir } from '../sate.model.js';` e `import { agruparDestinos } from '../regras.model.js';`.

Em `render`, o HTML passa a ter o espaço do bloco entre a barra e os cards:

```js
  box.innerHTML = barra + (podeEditar ? '<div id="loc-conferir"></div>' : '') + (locais.length
    ? …como está…);
```
  e, depois de `if (!podeEditar) return;`, chamar `pintarAConferir();`.

Função nova:

```js
// Destinos que as escolas digitaram e ainda não são local do cadastro
// (spec 2026-10-10-sate-endereco-e-cep, D8). Uma linha por LUGAR. Sem
// pendência, o bloco não aparece. Falha de leitura também não: a aba
// Locais não pode quebrar por causa de um bloco de apoio.
async function pintarAConferir() {
  const box = document.getElementById('loc-conferir');
  if (!box) return;
  const grupos = agruparDestinos(await destinosAConferir().catch(() => []));
  if (!document.getElementById('loc-conferir') || !grupos.length) return;
  box.innerHTML = `
    <section class="panel loc-conferir">
      <h2>A conferir</h2>
      <p class="form-hint">Destinos que as escolas digitaram e ainda não são um local do cadastro.</p>
      ${grupos.map((g, i) => `
        <div class="solic">
          <div class="solic-main"><b>${esc(g.nome)}</b>
            <div class="di-meta">${esc(enderecoCompleto(g)) || 'sem endereço'} · em ${g.pedidos.length === 1 ? '1 pedido' : `${g.pedidos.length} pedidos`}</div></div>
          <div class="solic-acoes"><button type="button" class="mini-btn" data-conferir="${i}">Conferir</button></div>
        </div>`).join('')}
    </section>`;
  box.querySelectorAll('[data-conferir]').forEach(b => b.addEventListener('click', async () => {
    // Dinâmico: conferir-local.js importa este arquivo (abrirLocal).
    const { abrirConferirLocal } = await import('./conferir-local.js');
    abrirConferirLocal(grupos[Number(b.dataset.conferir)], ctx, async () => {
      await ctx.recarregarLocais();
      render(ctx);
    });
  }));
}
```

O formulário de local leva o CEP do que foi digitado: nada a fazer além da Task 3 (o `value` já lê `base?.cep`, e `base` inclui `preenchido`).

`src/modules/sate/sate.css` - ao lado das regras `.conf-*`:

```css
.loc-conferir { margin-bottom: 16px; }
.loc-conferir h2 { margin: 0 0 4px; font-size: 15px; }
```

Antes de dar por pronto, conferir que `aoConcluir` com `voltar` não reabre a página de locais em pilha: `abrirModal(..., { voltar: aoConcluir })` chama `aoConcluir` no `←`; aqui ele só redesenha a página, o que é o comportamento certo.

- [ ] **Step 9:** `node --test tests/`; verificador → 0 bloqueantes (em especial a checagem de ciclos, R4, e a checagem 12 de classes sem CSS).

- [ ] **Step 10: Commit** - `feat(sate): conferir local por lugar e bloco A conferir na aba Locais`.

---

### Task 6: Tutoriais, changelog e versões

**Files:**
- Modify: `docs/modulos/sate.md`, `docs/modulos/escolas.md`, `CHANGELOG.md`, `src/core/config.js`

- [ ] **Step 1: `src/core/config.js`** - `versao: '0.41.0'`, `versaoSate: '0.19.0'`.

- [ ] **Step 2: `CHANGELOG.md`.**
  - Na tabela "Versões do SATE", nova primeira linha: `| 0.19.0 | 0.41.0 | CEP nos locais e no destino do pedido, busca de endereço mais certeira, conferir local pela aba Locais |`
  - Nova entrada **acima** de `## [0.40.0]`, no formato das anteriores (ler a entrada 0.40.0 inteira como modelo literal), escrita para quem usa, sem jargão e sem nome de arquivo:

```markdown
## [0.41.0] - 2026-10-10

> SATE 0.19.0.
>
> **Rodar a migration 047 no Supabase.** Ela cria o campo CEP nas escolas, nos locais e no
> destino dos pedidos. Sem ela, tudo continua funcionando; só quem preencher um CEP recebe
> o aviso de que o banco ainda não tem o campo.

### Adicionado

- **CEP** no cadastro de escolas e de locais do SATE, e no destino novo de um pedido de
  transporte. Ao digitar o CEP, o sistema preenche rua e bairro (só se estiverem em branco)
  e posiciona o pino no mapa. Num cadastro que já tem o pino acertado, o pino não se move
  sozinho: aparece o botão **Mover o pino para este CEP**.
- **A conferir**, no alto da página Locais do SATE (para quem aprova): os destinos que as
  escolas digitaram e ainda não são um local do cadastro, com o botão **Conferir**.

### Alterado

- **Localizar pelo endereço** acha mais lugares: quando a busca com o endereço completo não
  encontra nada, o sistema tenta de novo só com a rua. Quando o mapa só acha o bairro, ele
  avisa em vez de pôr o pino longe do lugar.
- **Conferir local** vale para o lugar: se vários pedidos digitaram o mesmo destino, uma
  conferência resolve todos.
```

- [ ] **Step 3: `docs/modulos/sate.md`.**
  - "### Localizar um destino": passo 1 cita o campo **CEP** antes de Endereço; novo passo 2 "Digite o **CEP**: rua e bairro são preenchidos (se estiverem em branco) e o pino vai para a rua. Se o local já tinha o pino acertado, ele não se move - clique em **Mover o pino para este CEP** se quiser."; o passo de "Localizar pelo endereço" passa a dizer que é a segunda via, e que quando só o bairro é encontrado o sistema avisa.
  - "### Conferir local": acrescentar o caminho pela página **Locais** (bloco **A conferir**, botão **Conferir**) e a regra "vale para o lugar: todos os pedidos que digitaram aquele destino são resolvidos juntos".
  - "### Pedir transporte": no passo do local novo, citar o **CEP** opcional.
  - Carimbo final: `> Atualizado na versão 0.41.0.`

- [ ] **Step 4: `docs/modulos/escolas.md`.**
  - "### Localizar a escola no mapa": citar o campo **CEP** em Localização, o que ele preenche e o botão **Mover o pino para este CEP**; "Localizar pelo endereço" como segunda via.
  - "O que dá para fazer aqui" / ficha: o CEP aparece ao lado do endereço.
  - Carimbo final: `> Atualizado na versão 0.41.0.`

  Regras dos tutoriais: escritos para quem usa; nenhum nome de arquivo, tabela, função ou coluna; botão nomeado como aparece na tela; nenhum dado real.

- [ ] **Step 5:** `node --test tests/`; `python .claude/scripts/verificar_arquitetura.py` → 0 bloqueantes (as checagens 11 e 14 não devem acusar tutorial atrasado nem versão do SATE esquecida).

- [ ] **Step 6:** `git diff --cached` (depois do `git add`) lido procurando dado real. **Commit** - `feat: 0.41.0 - CEP em escolas e locais, busca de endereco e conferencia por lugar`.
