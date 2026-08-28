# Servidores, Escolas e Horários - Plano de Implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA - use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** Tornar o vínculo a fonte única do cargo, da lotação e do período de um servidor, e reconstruir as telas de Servidores, Escolas e Horários sobre esse modelo.

**Architecture:** SPA estática sem build (ES modules servidos direto) + Supabase com RLS. MVC adaptado: `*.model.js` fala com o banco, `*.view.js` com o DOM, `core/router.js` é o único controller. Nenhuma dependência nova.

**Tech Stack:** JavaScript ES2022 (módulos nativos), CSS puro com custom properties, PostgreSQL/Supabase, Python 3 só para o script de verificação.

**Spec:** [`docs/superpowers/specs/2026-08-25-servidores-escolas-horarios-design.md`](../specs/2026-08-25-servidores-escolas-horarios-design.md)

## Global Constraints

- **Branch `dev`.** Nunca commitar em `main`.
- **Sem build, sem npm, sem dependência nova.** O que está no repositório é o que roda no navegador.
- **PT-BR** em código, comentário, commit e interface.
- **Nenhum dado real** (nome, e-mail, telefone, CPF, RG, matrícula) em código, comentário, exemplo ou fixture. Exemplos são inventados: `Escola Exemplo`, `nome@exemplo.com`, `(00) 00000-0000`, `000.000.000-00`. Conferir `git diff --cached` antes de cada commit.
- **Todo valor vindo do banco passa por `esc()`** antes de entrar em template literal, inclusive em atributo.
- **Model nunca toca no DOM; view nunca chama `sb()`.** View recebe `ctx.perfil` do roteador e não chama `getPerfilAtual()`.
- **Data civil** é `string` `yyyy-mm-dd`, manipulada como string. Toda formatação de data/hora fica em `src/shared/format.js` - módulo não chama `toISOString`, `toLocaleDateString`, `toLocaleString` nem `toLocaleTimeString`.
- **Nenhuma cor literal** (`#hex`, `rgb()`, `hsl()`) em `src/modules/**`. Só `var(--token)`.
- **Erro barra, aviso não.** Situação impossível bloqueia o salvamento; situação indesejável mas às vezes necessária deixa salvar e sinaliza.
- **Limites de tamanho (R11):** view > 400 linhas ou model > 250 linhas → dividir por superfície de UI em `views/`. Não criar arquivo com menos de ~60 linhas.
- **Antes de cada commit:** `python .claude/scripts/verificar_arquitetura.py` sem bloqueios.

## Como se testa neste projeto

Não há framework de teste, e não vai haver - seria dependência nova. O ciclo de cada tarefa usa três ferramentas, nesta ordem:

**1. Verificação mecânica.** `python .claude/scripts/verificar_arquitetura.py` - dez checagens das regras acima. Exit 0 obrigatório.

**2. Asserção de função pura no navegador.** O servidor de desenvolvimento serve os módulos ES direto, então dá para importar um módulo real no console e afirmar sobre ele. É teste de verdade, sem infraestrutura:

```js
// no console da aba do preview
const f = await import('http://localhost:8123/src/shared/format.js');
console.assert(f.mascaraCPF('11111111111') === '111.111.111-11', 'CPF');
```

Use isto sempre que a tarefa produzir função sem DOM e sem banco: máscaras, idade, derivação de lotação, catálogo de cargos, validação.

**3. Verificação de tela.** Com o modo dev-local ligado (abaixo), carregar a rota, conferir que o console está limpo e afirmar sobre o DOM. Sem banco, as telas mostram estado vazio - o que se verifica localmente é **estrutura, ausência de erro e responsividade**. O comportamento com dado real é verificado pelo André na URL de dev, depois da migration; cada tarefa diz o que ele precisa confirmar lá.

### Ligar o modo dev-local

```bash
git stash list   # confira que não há stash pendente antes
```

1. Em `src/core/config.js`, trocar `supabaseAnonKey: 'sb_publishable_…'` por `supabaseAnonKey: ''`. Guardar o valor original.
2. Subir o preview: usar a ferramenta `preview_start` com `{"name": "fundhub"}` (porta 8123). **Nunca** rodar o servidor por Bash.
3. **Ao terminar a tarefa, restaurar a chave antes de commitar.** `git diff src/core/config.js` tem de sair vazio.

Em dev-local, `hasSupabase()` é `false`: os models devolvem lista vazia e as views renderizam o estado vazio. É o suficiente para pegar erro de sintaxe, template quebrado, listener em elemento inexistente e quebra de layout.

### Verificação de responsividade

Toda tarefa que mexe em tela verifica em **375px, 768px e 1280px** (ferramenta `resize_window`). A página nunca rola na horizontal.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `supabase/migrations/023_servidores_vinculos.sql` | modelo: nascimento, SME, vínculo por período, cargo livre | criar |
| `src/core/registry.js` | casar rota ignorando query | modificar |
| `src/core/router.js` | entregar `ctx.params` à view | modificar |
| `src/shell/chrome.js` | destacar o item de menu ignorando query | modificar |
| `src/shared/ui/drawer.js` | pilha de gavetas + devolução de foco | modificar |
| `src/shared/format.js` | `fmtIdade`, `mascaraCPF`, `mascaraRG`, `noPadraoCPF`, `noPadraoRG` | modificar |
| `src/styles/components.css` | `.campos.auto`, `.col-full`, `.switch`, `.filtros-linha` | modificar |
| `src/modules/escolas/escolas.model.js` | unidades (só escolas) + `getLocais()` (escolas + SME) | modificar |
| `src/modules/servidores/servidores.model.js` | a pessoa; lotação e cargo derivados do vínculo | modificar |
| `src/modules/servidores/vinculos.model.js` | o vínculo e o catálogo de cargos | criar |
| `src/modules/servidores/servidores.view.js` | casca: busca, filtros, lista | modificar |
| `src/modules/servidores/views/lista.js` | cards e filtragem | modificar |
| `src/modules/servidores/views/formulario.js` | criar/editar/excluir pessoa | modificar |
| `src/modules/servidores/views/detalhe.js` | ficha + lista de vínculos | modificar |
| `src/modules/servidores/views/vinculo.js` | formulário de vínculo (criar/editar/encerrar) | criar |
| `src/modules/escolas/escolas.view.js` | casca: busca, filtros, cards | modificar |
| `src/modules/escolas/views/detalhe.js` | ficha da escola | criar |
| `src/modules/escolas/views/formulario.js` | criar/editar/excluir escola | criar |
| `src/modules/horarios/horarios.view.js` | casca: abas e estado | modificar |
| `src/modules/horarios/views/por-escola.js` | cobertura + semana da equipe | criar |
| `src/modules/horarios/views/por-servidor.js` | semana de uma pessoa | criar |
| `src/modules/horarios/views/bloco.js` | formulário de bloco | criar |
| `src/modules/horarios/horarios.model.js` | cobertura só para escola | modificar |
| `src/modules/meus-dados/meus-dados.view.js` | cargo e vínculos vindos do vínculo aberto | modificar |

Dois models em `servidores/` é legítimo: o módulo é dono de dois agregados (a pessoa e a designação), caso previsto por R2 - o mesmo de `sate/`.

---

### Task 1: Migration 023 - o modelo

**Files:**
- Create: `supabase/migrations/023_servidores_vinculos.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `servidor.nascimento date`; `unidade_escolar.tipo text` (`'escola'`|`'sede'`) com a linha `numero = 0`; `vinculo` sem coluna `ativo`, com `papel` livre e índice único parcial `vinculo_aberto_unico`; `vw_escola_pessoas` filtrando `fim is null`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/023_servidores_vinculos.sql`:

```sql
-- ============================================================
-- 023 - Servidor, vínculo e a SME como local de lotação
-- Rode no SQL Editor, depois da 022.
--
-- O princípio: o VÍNCULO é a fonte única do "onde" e do "como" de uma
-- pessoa. Cargo, lotação e período deixam de ser atributos do servidor
-- e passam a ser atributos da designação. Ver
-- docs/superpowers/specs/2026-08-25-servidores-escolas-horarios-design.md
--
-- Idempotente: pode rodar duas vezes sem quebrar.
-- ============================================================

-- ── 1. Data de nascimento ────────────────────────────────────
alter table servidor add column if not exists nascimento date;

-- ── 2. A SME como unidade ────────────────────────────────────
-- Um vínculo com a sede tem a mesma forma de um vínculo com escola.
-- Uma tabela separada obrigaria `vinculo` a apontar para dois destinos,
-- e esse polimorfismo apareceria em todo model e em toda tela.
alter table unidade_escolar add column if not exists tipo text not null
  default 'escola';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'unidade_tipo_valido') then
    alter table unidade_escolar add constraint unidade_tipo_valido
      check (tipo in ('escola', 'sede'));
  end if;
end $$;
create index if not exists idx_unidade_tipo on unidade_escolar(tipo);

-- numero = 0 é reservado: acha a linha sem depender do nome exibido.
insert into unidade_escolar (numero, nome, apelido, tipo, segmento)
values (0, 'SME - Sede', 'SME', 'sede', null)
on conflict (numero) do update
  set tipo = 'sede', segmento = null;

-- ── 3. Vínculo: de "ano letivo" para período ─────────────────
-- 3a. Fecha o que estava marcado como inativo sem data de fim. Esse
-- estado não significa nada e existe na base: `ativo=false` sem `fim`.
-- O guarda é o que torna o arquivo re-executável: 3e dropa `ativo`, e
-- sem ele a segunda execução morreria aqui com 42703.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'vinculo'
                and column_name = 'ativo') then
    update vinculo set fim = make_date(ano, 12, 31)
     where ativo = false and fim is null;
  end if;
end $$;

-- 3b. Cargo vira texto livre. Os três papéis fixos viram os rótulos
-- que a tela já exibia - a partir daqui o valor gravado É o rótulo.
update vinculo set papel = 'Gestor(a)'       where papel = 'gestor';
update vinculo set papel = 'Coordenador(a)'  where papel = 'coordenador';
update vinculo set papel = 'Supervisor(a)'   where papel = 'supervisor';

-- 3c. Quem é da sede não tinha vínculo: a lotação vivia solta em
-- servidor.lotacao + servidor.cargo, sem período. Passa a ter.
-- Guardado por coluna E por "não tem vínculo aberto": na segunda
-- execução ninguém é duplicado.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'servidor'
                and column_name = 'lotacao') then
    insert into vinculo (servidor_id, unidade_id, papel, ano, ingresso)
    select s.id,
           (select id from unidade_escolar where numero = 0),
           btrim(s.cargo),
           coalesce(extract(year from s.inicio_rede)::int, extract(year from now())::int),
           s.inicio_rede
      from servidor s
     where s.lotacao = 'sede'
       and coalesce(btrim(s.cargo), '') <> ''
       and not exists (select 1 from vinculo v where v.servidor_id = s.id and v.fim is null);
  end if;
end $$;

-- 3d. O unique por ano impedia sair da escola e voltar no mesmo ano
-- com o mesmo cargo. O que importa garantir é outra coisa: não existem
-- dois vínculos ABERTOS iguais. Histórico fica livre.
alter table vinculo drop constraint if exists vinculo_servidor_id_unidade_id_papel_ano_key;
create unique index if not exists vinculo_aberto_unico
  on vinculo (servidor_id, unidade_id, papel)
  where fim is null;

-- 3e. Aberto = fim is null. Duas fontes de verdade para o mesmo fato
-- é o que produzia o estado impossível corrigido em 3a.
alter table vinculo drop column if exists ativo;

-- ── 4. A view da equipe gestora ──────────────────────────────
-- Equipe = quem está lá AGORA. E `papel` já vem legível (3b).
create or replace view vw_escola_pessoas
  with (security_invoker = true) as
select u.id as unidade_id, u.numero, u.nome, v.papel, v.ano,
       s.nome as pessoa_nome, s.apelido, s.email,
       coalesce(
         (select t.numero from telefone t
            where t.servidor_id = s.id
            order by t.principal desc, t.criado_em
            limit 1),
         s.telefone
       ) as telefone
from unidade_escolar u
join vinculo v  on v.unidade_id = u.id
join servidor s on s.id = v.servidor_id
where v.fim is null;

-- ── 5. Auditoria ─────────────────────────────────────────────
-- servidor, vinculo e unidade_escolar já estão no array da 019 e o
-- trigger continua válido: nenhuma tabela nova foi criada aqui.

select registrar_migration('023', 'Servidor, vinculo por periodo, cargo livre e SME como unidade');
```

> `servidor.cargo` e `servidor.lotacao` **não são dropados**: são o insumo do passo 3c, estão no `audit_log` e dropar coluna é irreversível. O front para de lê-los na Task 6.

- [ ] **Step 2: Conferir a idempotência comando a comando**

Migration que explode na segunda execução vira armadilha na hora do reparo - foi a razão de existir da 022. Ler o arquivo do começo ao fim e confirmar, para **cada** comando, o que o protege:

| Comando | O que o protege numa 2ª execução |
|---|---|
| `alter table … add column if not exists` | a própria cláusula |
| `add constraint unidade_tipo_valido` | o `if not exists` em `pg_constraint` |
| `insert into unidade_escolar … on conflict (numero)` | a cláusula `do update` |
| 3a `update vinculo … where ativo = false` | o `do $$` que testa `information_schema.columns` - sem ele, 3e já dropou `ativo` e o arquivo morre com `42703` |
| 3b `update vinculo set papel = …` | o `where papel = 'gestor'` não casa mais nada |
| 3c `insert into vinculo … select … from servidor` | o `do $$` sobre `servidor.lotacao` **e** o `not exists` de vínculo aberto |
| 3d `drop constraint if exists` + `create unique index if not exists` | as próprias cláusulas |
| 3e `drop column if exists ativo` | a própria cláusula |
| `create or replace view` | a própria cláusula |
| `select registrar_migration('023')` | a função é `on conflict do update` por definição (022) |

Qualquer linha desta tabela que não tenha resposta é um defeito a corrigir **antes** do commit.

- [ ] **Step 3: Conferir que não há dado real**

```bash
git diff --cached -- supabase/migrations/023_servidores_vinculos.sql
python .claude/scripts/verificar_arquitetura.py --so-pii
```

Esperado: nenhum achado. O único texto literal de pessoa no arquivo é `'SME - Sede'`, que é nome de órgão, não de gente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/023_servidores_vinculos.sql
git commit -m "feat(023): vinculo por periodo, cargo livre e SME como local de lotacao"
```

- [ ] **Step 5: Pedir a execução ao André**

A migration é aplicada à mão no SQL Editor do painel - não há ferramenta automática, por opção. Avisar que ela precisa rodar antes de a Task 6 ser verificada com dado real, e que até lá o front degrada (Task 6 trata `42703`).

Confirmação no banco, depois de rodar:

```sql
select versao, aplicada_em from schema_migrations where versao = '023';
select count(*) from unidade_escolar where tipo = 'sede';        -- 1
select count(*) from vinculo where fim is null;                   -- > 0
select distinct papel from vinculo order by 1;                    -- rótulos legíveis
```

---

### Task 2: Rota com parâmetros

**Files:**
- Modify: `src/core/registry.js:79-81`
- Modify: `src/core/router.js:31-47`
- Modify: `src/shell/chrome.js:104-109`

**Interfaces:**
- Consumes: nada.
- Produces: `moduloPorRota(hash)` casa ignorando `?query`; a view recebe `ctx.params` (`URLSearchParams`); `marcarNav(hash)` destaca o item certo mesmo com query.

- [ ] **Step 1: Casar a rota ignorando a query**

Em `src/core/registry.js`, substituir `moduloPorRota`:

```js
// Só o caminho identifica o módulo: `#/servidores?unidade=…` é a mesma
// rota de `#/servidores`. A query é filtro de abertura, não endereço.
export const caminhoDaRota = (hash) => String(hash || '').split('?')[0];

export function moduloPorRota(hash) {
  const caminho = caminhoDaRota(hash);
  return MODULOS.find(m => m.rota && m.rota === caminho) || null;
}
```

- [ ] **Step 2: Entregar `ctx.params` à view**

Em `src/core/router.js`, importar `caminhoDaRota` junto dos outros e ajustar `route()`:

```js
import { moduloPorRota, caminhoDaRota, chavePerm, REDIRECIONAMENTOS } from './registry.js';
```

```js
export async function route() {
  let hash = location.hash || '#/';
  const caminho = caminhoDaRota(hash);

  // Endereços antigos (#/gestores → #/servidores) continuam valendo.
  if (REDIRECIONAMENTOS[caminho]) {
    location.replace(REDIRECIONAMENTOS[caminho] + hash.slice(caminho.length));
    return;
  }
  if (caminho === '#/' || caminho === '#') hash = ROTA_INICIAL;

  // `?unidade=…`, `?servidor=…`: filtro com que a tela abre. Fica na
  // URL para o link poder ser copiado e continuar significando o mesmo.
  const params = new URLSearchParams(hash.split('?')[1] || '');
  // … (o resto do corpo continua igual, até:)
      await view.render(outlet, { perfil, nivel: nivel(chavePerm(mod)), params });
```

- [ ] **Step 3: Destacar o item de menu ignorando a query**

Em `src/shell/chrome.js`, importar `caminhoDaRota` e usá-lo em `marcarNav`:

```js
import { navPorGrupo, caminhoDaRota } from '../core/registry.js';
```

```js
export function marcarNav(hash) {
  const caminho = caminhoDaRota(hash);
  // "#/" é a dashboard: o item certo a destacar é o dela.
  const alvo = (caminho === '#/' || caminho === '#') ? '#/dashboard' : caminho;
  document.querySelectorAll('.sidebar a').forEach(a =>
    a.classList.toggle('active', a.dataset.rota === alvo));
}
```

- [ ] **Step 4: Afirmar sobre o casamento de rota, no navegador**

Ligar o dev-local e o preview. No console da aba:

```js
const r = await import('http://localhost:8123/src/core/registry.js');
console.assert(r.caminhoDaRota('#/servidores?unidade=abc') === '#/servidores', 'caminho');
console.assert(r.caminhoDaRota('#/servidores') === '#/servidores', 'caminho sem query');
console.assert(r.caminhoDaRota('') === '', 'vazio');
console.assert(r.moduloPorRota('#/escolas?x=1')?.id === 'escolas', 'modulo com query');
console.assert(r.moduloPorRota('#/nao-existe') === null, 'rota inexistente');
'ok';
```

Esperado: `'ok'` sem nenhum `console.assert` falhando.

- [ ] **Step 5: Verificar a navegação de ponta a ponta**

Navegar para `http://localhost:8123/#/escolas?unidade=teste`. Confirmar:
- a tela de Escolas carrega (não cai em "Página não encontrada");
- o item "Escolas" está destacado no menu (`.sidebar a.active` com `data-rota="#/escolas"`);
- console sem erro.

- [ ] **Step 6: Restaurar a chave e commitar**

Restaurar `supabaseAnonKey` em `src/core/config.js` e confirmar `git diff src/core/config.js` vazio.

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/core/registry.js src/core/router.js src/shell/chrome.js
git commit -m "feat(core): rota aceita query e a view recebe ctx.params"
```

---

### Task 3: Gaveta empilhada e devolução de foco

**Files:**
- Modify: `src/shared/ui/drawer.js`

**Interfaces:**
- Consumes: nada.
- Produces: `abrirDrawer(html, { voltar } = {})` - quando `voltar` é uma função, o cabeçalho ganha um `←` e Esc/× chamam `voltar()` em vez de fechar. `fecharDrawer()` continua com a mesma assinatura. `drawerHtml()`, `montarDrawer()` e `drawerHead(titulo, sub)` inalterados.

- [ ] **Step 1: Reescrever `abrirDrawer` e `fecharDrawer`**

Substituir o corpo de `src/shared/ui/drawer.js` a partir de `let escListener = null;`:

```js
let escListener = null;
// Uma gaveta pode ser aberta POR CIMA de outra (editar o vínculo a
// partir da ficha do servidor). Guardamos a FUNÇÃO que reabre a de
// baixo, não o HTML dela: restaurar HTML deixaria para trás os
// listeners, e a de baixo precisa voltar com dado recarregado.
let voltarPara = null;
let focoAnterior = null;

export function montarDrawer() {
  document.getElementById('drawer-back')?.addEventListener('click', fecharDrawer);
  // Um único listener de teclado por página: registrar a cada render
  // vazava listeners e fechava gavetas de telas já descartadas.
  if (escListener) document.removeEventListener('keydown', escListener);
  escListener = (e) => { if (e.key === 'Escape') fecharDrawer(); };
  document.addEventListener('keydown', escListener);
}

export function abrirDrawer(html, { voltar = null } = {}) {
  const d = document.getElementById('drawer');
  if (!d) return;

  // Guarda quem tinha o foco antes da PRIMEIRA gaveta da pilha, para
  // devolvê-lo quando a pilha inteira fechar.
  if (!d.classList.contains('open')) focoAnterior = document.activeElement;
  voltarPara = voltar;

  d.innerHTML = html;
  d.setAttribute('aria-hidden', 'false');
  d.classList.add('open');
  document.getElementById('drawer-back')?.classList.add('open');

  if (voltar) {
    const head = d.querySelector('.drawer-head');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drawer-voltar';
    btn.setAttribute('aria-label', 'Voltar');
    btn.textContent = '←';
    head?.prepend(btn);
    btn.addEventListener('click', fecharDrawer);
  }

  d.querySelector('.drawer-close')?.addEventListener('click', fecharDrawer);
  (d.querySelector('.drawer-voltar') || d.querySelector('.drawer-close'))?.focus();
}

export function fecharDrawer() {
  // Se há uma gaveta embaixo, "fechar" é voltar para ela - e é ela que
  // chama abrirDrawer de novo, já com o dado atualizado.
  if (voltarPara) {
    const volta = voltarPara;
    voltarPara = null;
    volta();
    return;
  }
  const d = document.getElementById('drawer');
  d?.classList.remove('open');
  d?.setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-back')?.classList.remove('open');
  // ui.md sempre afirmou que a gaveta devolve o foco; até aqui, não devolvia.
  focoAnterior?.focus?.();
  focoAnterior = null;
}
```

- [ ] **Step 2: Estilo do botão de voltar**

Em `src/styles/components.css`, logo depois das regras de `.drawer-close` (procurar por `.drawer-close` e inserir após o bloco):

```css
/* Gaveta aberta sobre outra: o ← desempilha (ver shared/ui/drawer.js). */
.drawer-voltar {
  flex: 0 0 auto;
  width: var(--controle);
  height: var(--controle);
  margin-right: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  color: var(--text);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.drawer-voltar:hover { background: var(--surface-3); }
@media (pointer: coarse) {
  .drawer-voltar { width: var(--toque); height: var(--toque); }
}
```

- [ ] **Step 3: Afirmar sobre a pilha, no navegador**

Ligar o dev-local, abrir `http://localhost:8123/#/escolas` e, no console:

```js
const d = await import('http://localhost:8123/src/shared/ui/drawer.js');
const drawer = document.getElementById('drawer');
let voltas = 0;
const abrirBase = () => d.abrirDrawer('<div class="drawer-head"><h2 id="marca">BASE</h2>' +
  '<button class="drawer-close" type="button">×</button></div>');

abrirBase();
console.assert(drawer.classList.contains('open'), 'abriu');
console.assert(document.querySelector('.drawer-voltar') === null, 'base sem ←');

d.abrirDrawer('<div class="drawer-head"><h2 id="marca">TOPO</h2>' +
  '<button class="drawer-close" type="button">×</button></div>',
  { voltar: () => { voltas++; abrirBase(); } });
console.assert(document.querySelector('.drawer-voltar') !== null, 'topo tem ←');
console.assert(document.getElementById('marca').textContent === 'TOPO', 'topo visível');

document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
console.assert(voltas === 1, 'Esc desempilhou uma vez');
console.assert(document.getElementById('marca').textContent === 'BASE', 'voltou para a base');
console.assert(drawer.classList.contains('open'), 'base continua aberta');

document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
console.assert(!drawer.classList.contains('open'), 'segundo Esc fechou tudo');
console.assert(voltas === 1, 'não desempilhou de novo');
'ok';
```

Esperado: `'ok'` sem falha. Os quatro pontos que isto prova: a base não ganha `←`; a de cima ganha; Esc desempilha um nível; Esc de novo fecha.

- [ ] **Step 4: Verificar que a gaveta comum não regrediu**

Ainda em `#/escolas` (estado vazio, sem cards), no console:

```js
const d2 = await import('http://localhost:8123/src/shared/ui/drawer.js');
const alvo = document.getElementById('q');
alvo.focus();
d2.abrirDrawer('<div class="drawer-head"><h2>X</h2><button class="drawer-close" type="button">×</button></div>');
document.querySelector('.drawer-close').click();
console.assert(document.activeElement === alvo, 'foco devolvido ao campo de busca');
'ok';
```

- [ ] **Step 5: Restaurar a chave e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/shared/ui/drawer.js src/styles/components.css
git commit -m "feat(drawer): gaveta sobre gaveta com Esc que desempilha e foco devolvido"
```

---

### Task 4: Idade e máscaras em `shared/format.js`

**Files:**
- Modify: `src/shared/format.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `fmtIdade(iso)` → `'38 anos'` · `'1 ano'` · `''` se vazio/inválido
  - `mascaraCPF(v)` → `'111.111.111-11'`, formatação progressiva
  - `mascaraRG(v)` → `'12.345.678-9'`, aceita `X` no dígito verificador
  - `noPadraoCPF(v)` / `noPadraoRG(v)` → `boolean`; `true` para vazio (campo opcional não é irregular)

- [ ] **Step 1: Escrever as funções**

Acrescentar ao fim de `src/shared/format.js`:

```js
// Idade em anos a partir de uma data civil. Aritmética de calendário
// direto na string: nada de Date, para não repetir o bug do fuso.
export function fmtIdade(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const [ha, hm, hd] = hojeISO().split('-').map(Number);
  let anos = ha - a;
  if (hm < m || (hm === m && hd < d)) anos--;
  if (anos < 0 || anos > 130) return '';
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

// ── Máscaras de documento ────────────────────────────────────
// Formatação progressiva: mascaram o que já foi digitado e não
// reclamam do que falta. Quem valida "de verdade" é noPadrao*(),
// e o resultado dela é AVISO, não erro (R15) - RG de outro estado
// tem outro formato e a SME precisa cadastrar essa pessoa.

// '11111111111' → '111.111.111-11'
export function mascaraCPF(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// '123456789' → '12.345.678-9'. O dígito verificador do RG paulista
// pode ser X, então o último caractere aceita letra.
export function mascaraRG(v) {
  const bruto = String(v ?? '').toUpperCase().replace(/[^0-9X]/g, '').slice(0, 9);
  const num = bruto.replace(/X/g, '').slice(0, 8);
  const dv = bruto.length > 8 ? bruto.slice(8, 9) : '';
  let out = num;
  if (num.length > 2) out = `${num.slice(0, 2)}.${num.slice(2)}`;
  if (num.length > 5) out = `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5)}`;
  return dv ? `${out}-${dv}` : out;
}

export const noPadraoCPF = (v) =>
  !String(v ?? '').trim() || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(String(v).trim());

export const noPadraoRG = (v) =>
  !String(v ?? '').trim() || /^\d{2}\.\d{3}\.\d{3}-[0-9X]$/.test(String(v).trim().toUpperCase());
```

- [ ] **Step 2: Afirmar sobre as funções, no navegador**

Ligar o dev-local e o preview. No console:

```js
const f = await import('http://localhost:8123/src/shared/format.js');

// máscara de CPF, progressiva
console.assert(f.mascaraCPF('') === '', 'cpf vazio');
console.assert(f.mascaraCPF('123') === '123', 'cpf 3');
console.assert(f.mascaraCPF('1234') === '123.4', 'cpf 4');
console.assert(f.mascaraCPF('1234567') === '123.456.7', 'cpf 7');
console.assert(f.mascaraCPF('11111111111') === '111.111.111-11', 'cpf 11');
console.assert(f.mascaraCPF('111.111.111-11') === '111.111.111-11', 'cpf reaplicada');
console.assert(f.mascaraCPF('1111111111199') === '111.111.111-11', 'cpf trunca');

// máscara de RG, com X
console.assert(f.mascaraRG('12') === '12', 'rg 2');
console.assert(f.mascaraRG('123456') === '12.345.6', 'rg 6');
console.assert(f.mascaraRG('123456789') === '12.345.678-9', 'rg 9');
console.assert(f.mascaraRG('12345678x') === '12.345.678-X', 'rg com x minúsculo');
console.assert(f.mascaraRG('12.345.678-X') === '12.345.678-X', 'rg reaplicada');

// padrão: vazio não é irregular
console.assert(f.noPadraoCPF('') === true, 'cpf vazio ok');
console.assert(f.noPadraoCPF('111.111.111-11') === true, 'cpf ok');
console.assert(f.noPadraoCPF('123456') === false, 'cpf curto fora do padrão');
console.assert(f.noPadraoRG('12.345.678-X') === true, 'rg com X ok');
console.assert(f.noPadraoRG('1234') === false, 'rg curto fora do padrão');

// idade
const hoje = f.hojeISO();
const [ha, hm, hd] = hoje.split('-');
console.assert(f.fmtIdade('') === '', 'idade vazia');
console.assert(f.fmtIdade('não é data') === '', 'idade inválida');
console.assert(f.fmtIdade(`${+ha - 40}-${hm}-${hd}`) === '40 anos', 'aniversário hoje');
console.assert(f.fmtIdade(`${+ha - 1}-${hm}-${hd}`) === '1 ano', 'singular');
console.assert(f.fmtIdade(`${+ha - 30}-12-31`) === (hm === '12' && hd === '31' ? '30 anos' : '29 anos'),
  'antes do aniversário');
'ok';
```

Esperado: `'ok'`. O caso "antes do aniversário" é o que pega o erro clássico de subtrair só o ano.

- [ ] **Step 3: Restaurar a chave e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/shared/format.js
git commit -m "feat(format): idade e mascaras de CPF e RG"
```

---

### Task 5: Vocabulário de formulário e de filtro no CSS

**Files:**
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: nada.
- Produces: `.campos.auto`, `.col-full`, `.filtros-linha`, `.filtro-campo`, `.switch` (+ `.switch-trilho`), `.chip-filtro` - todas em `components.css`, disponíveis para qualquer módulo.

- [ ] **Step 1: Grade automática de campos**

Em `src/styles/components.css`, logo abaixo de `.form-grupo .campos { … }`:

```css
/* Grade que reflui sozinha. Resolve os dois requisitos de uma vez: os
   campos se reorganizam conforme a largura E um campo sozinho na linha
   se estende até o fim do container - que é o que `.campos.duas`
   (grade fixa, só acima de 1280px) não faz. */
.form-grupo .campos.auto { display: grid; grid-template-columns: 1fr; gap: 13px; }
.form-grupo .campos.auto > .col-full { grid-column: 1 / -1; }

/* Rótulo SEMPRE acima do campo. A única exceção é o checkbox
   (.inline), onde o rótulo ao lado é o que a caixa significa. */
.form-grupo .campos label:not(.inline) {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.form-grupo .campos label > input,
.form-grupo .campos label > select,
.form-grupo .campos label > textarea { width: 100%; }

/* Valor derivado, exibido no formulário mas editado em outro lugar
   (cargo e lotação vêm do vínculo). Parece campo, não é. */
.campo-derivado {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--controle);
  padding: 7px 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.campo-derivado .vazio { color: var(--muted); }
.campo-derivado .mini-btn { margin-left: auto; }
```

- [ ] **Step 2: Barra de filtros**

Ainda em `components.css`, logo depois de `.filters { … }`:

```css
/* Linha de filtros que não são multi-escolha: select para escolha
   única entre muitos, toggle para liga/desliga. O chip continua
   sendo a forma da multi-escolha (segmento). */
.filtros-linha { display: grid; grid-template-columns: 1fr; gap: 8px 14px; }
.filtro-campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.filtro-campo select {
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.filtro-campo select:focus {
  outline: 2px solid color-mix(in srgb, var(--brand) 40%, transparent);
  border-color: var(--brand);
}

/* Chip do filtro que veio pela URL (`?unidade=…`): mostra o recorte e
   deixa desfazê-lo. */
.chip-filtro {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: end;
  padding: 5px 10px;
  border: 1px solid var(--brand);
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand) 10%, transparent);
  color: var(--brand);
  font-size: 13px;
  font-weight: 600;
}
.chip-filtro button {
  border: 0;
  background: none;
  color: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
```

- [ ] **Step 3: Toggle switch**

Ainda em `components.css`, na sequência:

```css
/* Toggle: markup sem comportamento, então é classe CSS e não
   componente JS (R12). O estado real é o do checkbox - teclado,
   rótulo e leitor de tela funcionam de graça. */
.switch {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  align-self: end;
  min-height: var(--controle);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
}
.switch input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.switch-trilho {
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 20px;
  border: 1px solid var(--border-forte);
  border-radius: 999px;
  background: var(--surface-3);
  transition: background .15s ease, border-color .15s ease;
}
.switch-trilho::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-btn);
  transition: transform .15s ease;
}
.switch input:checked + .switch-trilho { background: var(--brand); border-color: var(--brand); }
.switch input:checked + .switch-trilho::after { transform: translateX(14px); }
.switch input:focus-visible + .switch-trilho { outline: 2px solid var(--brand); outline-offset: 2px; }
@media (pointer: coarse) { .switch { min-height: var(--toque); } }
```

- [ ] **Step 4: Telas maiores**

No bloco `@media (min-width: 560px)` já existente, acrescentar:

```css
  .form-grupo .campos.auto { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .filtros-linha { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
```

- [ ] **Step 5: Verificar visualmente as três classes**

Ligar o dev-local, abrir `http://localhost:8123/#/escolas` e, no console, montar uma amostra dentro da gaveta:

```js
const d = await import('http://localhost:8123/src/shared/ui/drawer.js');
d.abrirDrawer(`<div class="drawer-head"><h2>Amostra</h2>
  <button class="drawer-close" type="button">×</button></div>
  <div class="drawer-body"><form class="esc-form">
    <fieldset class="form-grupo"><legend>Grupo</legend>
      <div class="campos auto">
        <label>Curto <input value="a" /></label>
        <label>Outro <input value="b" /></label>
        <label class="col-full">Sozinho na linha <input value="c" /></label>
        <label>Derivado <span class="campo-derivado">Gestor(a)
          <button type="button" class="mini-btn">✎</button></span></label>
      </div>
    </fieldset>
  </form>
  <div class="filtros-linha">
    <label class="filtro-campo">Cargo <select><option>Todos</option></select></label>
    <label class="switch"><input type="checkbox" /><span class="switch-trilho"></span> Sem vínculo</label>
  </div></div>`);
'montado';
```

Confirmar, em 1280px:
- os dois campos curtos ficam lado a lado e o `.col-full` ocupa a linha inteira;
- o `.campo-derivado` tem borda tracejada e o `✎` à direita;
- o toggle muda de cor ao clicar e responde a Espaço quando focado pelo Tab.

Depois, `resize_window` para 768px e 375px: em 375px cada campo ocupa a linha inteira e **não há rolagem horizontal**:

```js
console.assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'sem rolagem horizontal');
```

- [ ] **Step 6: Restaurar a chave e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/styles/components.css
git commit -m "feat(ui): grade automatica de campos, barra de filtros e toggle switch"
```

---

### Task 6: Models - locais, pessoa e vínculo

**Files:**
- Modify: `src/modules/escolas/escolas.model.js`
- Modify: `src/modules/servidores/servidores.model.js`
- Create: `src/modules/servidores/vinculos.model.js`

**Interfaces:**
- Consumes: migration 023 (Task 1).
- Produces:
  - `escolas.model.js`: `getUnidades()` (só `tipo='escola'`, forma inalterada), `getLocais()` → `[{ id, nome, tipo }]` com a sede primeiro.
  - `servidores.model.js`: `getServidores()` (vínculos sem `ativo`), `vinculosAbertos(s)`, `lotacaoDe(s)`, `cargoDe(s)`, `getServidoresDaUnidade(unidadeId)`, `limparCacheServidores()`. Some: `PAPEIS`, `ROTULO_PAPEL`, `rotulaPapel`, `LOTACOES`, `rotulaLotacao`, `CARGOS_SEDE`, `criarVinculo`, `atualizarVinculo`, `encerrarVinculo`, `excluirVinculo`.
  - `vinculos.model.js`: `getCargos()`, `criarVinculo(p)`, `atualizarVinculo(id, p)`, `excluirVinculo(id)`, `rotulaCargo(p)`, `limparCacheCargos()`.

- [ ] **Step 1: `getLocais()` em escolas.model.js**

Em `src/modules/escolas/escolas.model.js`:

1. Remover o import de `rotulaPapel` - a `vw_escola_pessoas` agora devolve o cargo já legível (migration 023 § 3b/4). Na montagem de `byU`, trocar `papel: rotulaPapel(r.papel)` por `papel: r.papel`.
2. No `select` de unidades, filtrar escolas: `cli.from('unidade_escolar').select('*').eq('tipo', 'escola').order('nome')`.
3. Acrescentar, depois de `getUnidades`:

```js
// LOCAIS de lotação = escolas + a sede da SME. Só o formulário de
// vínculo e o seletor de Horários usam isto; a lista de Escolas
// continua sendo só escola (getUnidades). A sede vem primeiro porque
// procurá-la no meio de 144 nomes seria absurdo.
let _locais = null;

export async function getLocais() {
  if (_locais) return _locais;
  if (!hasSupabase()) { _locais = []; return _locais; }
  const { data, error } = await sb().from('unidade_escolar')
    .select('id, nome, tipo').order('nome');
  // Migration 023 ainda não rodou: sem a coluna `tipo`, é tudo escola.
  if (error && error.code === '42703') {
    const { data: d2 } = await sb().from('unidade_escolar').select('id, nome').order('nome');
    _locais = (d2 || []).map(u => ({ ...u, tipo: 'escola' }));
    return _locais;
  }
  if (error) throw error;
  _locais = [...(data || [])].sort((a, b) =>
    (a.tipo === 'sede' ? -1 : b.tipo === 'sede' ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt'));
  return _locais;
}
```

4. Em `criarUnidade`, `atualizarUnidade` e `excluirUnidade`, acrescentar `_locais = null;` ao lado do `_cache = null;` já existente.
5. Se a coluna `tipo` não existir, o `.eq('tipo', 'escola')` de `getUnidades` devolve `42703`. Envolver: se `error?.code === '42703'`, refazer o select sem o `.eq` e seguir.

- [ ] **Step 2: Reescrever `servidores.model.js`**

Substituir o arquivo inteiro por:

```js
// ============================================================
// FundHub - modules/servidores/servidores.model.js
// A PESSOA. Existe independentemente de onde trabalha: nome,
// documentos, nascimento, contato, ingresso na rede.
//
// Onde ela trabalha, com que cargo e desde quando é assunto do
// VÍNCULO (vinculos.model.js). Cargo e lotação foram atributos do
// servidor até a migration 023 e deixaram de ser: eram duas fontes de
// verdade para o mesmo fato, e se contradiziam.
//
// As colunas `cargo` e `lotacao` continuam no banco (histórico e
// auditoria) e não são mais lidas nem escritas por aqui.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { slug } from '../../shared/dom.js';
// Telefones vêm da tabela dedicada (fonte única) - model → model.
import { getTelefonesMapas } from '../telefones/telefones.model.js';

const SEL = `*, vinculos:vinculo(
  id, unidade_id, papel, ingresso, fim,
  unidade:unidade_escolar(id, nome, apelido, tipo)
)`;

let _cache = null;
export function limparCacheServidores() { _cache = null; }

export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const [{ data, error }, tel] = await Promise.all([
    sb().from('servidor').select(SEL).order('nome'),
    getTelefonesMapas(),
  ]);
  if (error) throw error;
  _cache = (data || []).map(s => ({
    ...s, vinculos: s.vinculos || [], telefones: tel.porServidor[s.id] || [],
  }));
  return _cache;
}

// ── Derivações do vínculo ────────────────────────────────────
// Aberto = SEM data de fim. Uma regra, um lugar.
export const vinculosAbertos = (s) => (s?.vinculos || []).filter(v => !v.fim);

// A lotação é o nome do local do vínculo aberto - escola ou SME.
// Mais de um vínculo aberto acontece (alguém responde por duas
// unidades) e esconder isso seria mentir.
export function lotacaoDe(s) {
  const nomes = vinculosAbertos(s)
    .map(v => v.unidade?.apelido || v.unidade?.nome)
    .filter(Boolean);
  return [...new Set(nomes)].join(' · ');
}

export function cargoDe(s) {
  const cargos = vinculosAbertos(s).map(v => v.papel).filter(Boolean);
  return [...new Set(cargos)].join(' · ');
}

// Servidores com vínculo ABERTO numa unidade. Usado por Horários.
export async function getServidoresDaUnidade(unidadeId) {
  const todos = await getServidores();
  return todos.filter(s => vinculosAbertos(s).some(v => v.unidade_id === unidadeId));
}

// ── CRUD servidor ────────────────────────────────────────────
const CAMPOS = ['nome', 'apelido', 'email', 'cpf', 'rg', 'nascimento',
  'inicio_rede', 'codigo_funcional'];

function limpar(p) {
  const out = {};
  for (const k of CAMPOS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

// `chave` é unique: gera a partir do nome e desempata se já existir.
async function chaveLivre(nome) {
  const base = slug(nome) || 'servidor';
  const { data } = await sb().from('servidor').select('chave').like('chave', `${base}%`);
  const usadas = new Set((data || []).map(r => r.chave));
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export async function criarServidor(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...limpar(payload), chave: await chaveLivre(payload.nome) };
  const { data, error } = await sb().from('servidor').insert(row).select().single();
  // Migration 023 ainda não rodou: grava sem a data de nascimento.
  if (error?.code === '42703' && 'nascimento' in row) {
    delete row.nascimento;
    const retry = await sb().from('servidor').insert(row).select().single();
    if (retry.error) throw retry.error;
    _cache = null;
    return retry.data;
  }
  if (error) throw error;
  _cache = null;
  return data;
}

export async function atualizarServidor(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const patch = limpar(payload);
  const { error } = await sb().from('servidor').update(patch).eq('id', id);
  if (error?.code === '42703' && 'nascimento' in patch) {
    delete patch.nascimento;
    const retry = await sb().from('servidor').update(patch).eq('id', id);
    if (retry.error) throw retry.error;
    _cache = null;
    return;
  }
  if (error) throw error;
  _cache = null;
}

// Apaga o servidor. Os vínculos e horários caem junto (on delete cascade)
// - assim como os afastamentos dele. É por isso que a tela avisa.
export async function excluirServidor(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('servidor').delete().eq('id', id);
  if (error) throw error;
  _cache = null;
}
```

- [ ] **Step 3: Criar `vinculos.model.js`**

```js
// ============================================================
// FundHub - modules/servidores/vinculos.model.js
// O VÍNCULO (designação): pessoa × local × cargo × período.
// É a fonte única do "onde" e do "como" de um servidor.
//
// Aberto = SEM data de fim. Não existe coluna `ativo`: duas fontes de
// verdade para o mesmo fato produziam o estado impossível
// "inativo, sem data de encerramento" (corrigido na migration 023).
//
// O cargo é TEXTO LIVRE e o catálogo é derivado dos valores em uso -
// ele não tem vida própria, ele É o conjunto dos cargos em uso. Cargo
// novo entra ao ser digitado; cargo cujo último vínculo acabou some.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { limparCacheServidores } from './servidores.model.js';

// Traduz os três papéis fixos que existiam antes da 023. A migration
// normaliza a base; isto é rede de segurança para banco não migrado.
const LEGADO = {
  gestor: 'Gestor(a)',
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
};
export const rotulaCargo = (p) => LEGADO[p] || p || '';

// Espaços aparados e colapsados. Não forçamos caixa: "Vice-diretor(a)"
// é escrito como a SME escreve.
export const normalizaCargo = (p) => String(p ?? '').trim().replace(/\s+/g, ' ');

let _cargos = null;
export function limparCacheCargos() { _cargos = null; }

// Catálogo: os cargos hoje em uso, em ordem alfabética.
export async function getCargos() {
  if (_cargos) return _cargos;
  if (!hasSupabase()) { _cargos = []; return _cargos; }
  const { data, error } = await sb().from('vinculo').select('papel');
  if (error) throw error;
  const vistos = new Map();               // chave sem caixa → grafia gravada
  for (const r of data || []) {
    const c = rotulaCargo(normalizaCargo(r.papel));
    if (c && !vistos.has(c.toLowerCase())) vistos.set(c.toLowerCase(), c);
  }
  _cargos = [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt'));
  return _cargos;
}

// Reaproveita a grafia já em uso quando o cargo digitado só difere em
// maiúscula - senão o catálogo acumula "Coordenadora" e "coordenadora".
export async function cargoCanonico(bruto) {
  const c = normalizaCargo(bruto);
  if (!c) return '';
  const existentes = await getCargos().catch(() => []);
  return existentes.find(x => x.toLowerCase() === c.toLowerCase()) || c;
}

function invalidar() {
  _cargos = null;
  limparCacheServidores();
}

export async function criarVinculo({ servidor_id, unidade_id, papel, ingresso = null, fim = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  // `ano` continua no banco como carimbo (histórico e horários). Não
  // é critério de nada e não aparece em tela nenhuma.
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const row = { servidor_id, unidade_id, papel: cargo, ano, ingresso, fim };
  const { data, error } = await sb().from('vinculo').insert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Este servidor já tem um vínculo aberto com esse cargo neste local.');
    }
    throw error;
  }
  invalidar();
  return data;
}

export async function atualizarVinculo(id, { unidade_id, papel, ingresso = null, fim = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const patch = { unidade_id, papel: cargo, ano, ingresso, fim };
  const { error } = await sb().from('vinculo').update(patch).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      throw new Error('Este servidor já tem um vínculo aberto com esse cargo neste local.');
    }
    throw error;
  }
  invalidar();
}

// Encerrar ≠ excluir: o vínculo passado é histórico e deve ser
// preservado. A tela oferece as duas coisas, com botões diferentes.
export async function excluirVinculo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').delete().eq('id', id);
  if (error) throw error;
  invalidar();
}
```

> `criarVinculo` usa `new Date().getFullYear()` - é leitura do ano corrente, não formatação nem serialização de data, e por isso não viola R8. O script de verificação só reclama de `toISOString`/`toLocale*`.

- [ ] **Step 4: Consertar quem importava o que saiu**

`ANO_LETIVO`, `PAPEIS`, `rotulaPapel`, `LOTACOES` e `rotulaLotacao` deixaram de existir. Localizar os consumidores e deixar os arquivos **importáveis** (o conteúdo das telas é das Tasks 7–9):

```bash
grep -rn "ANO_LETIVO\|rotulaPapel\|PAPEIS\|LOTACOES\|rotulaLotacao\|CARGOS_SEDE" src --include=*.js
```

Esperado: `servidores/servidores.view.js`, `servidores/views/{lista,detalhe,formulario}.js`, `horarios/horarios.view.js`, `meus-dados/meus-dados.view.js`. Em cada um, trocar o import de `rotulaPapel` por `rotulaCargo` de `../servidores/vinculos.model.js` (ajustando a profundidade do caminho) e remover os símbolos que sumiram, substituindo o uso pelo equivalente:

| Sumiu | Passa a ser |
|---|---|
| `v.ativo` | `!v.fim` |
| `v.ano === ANO_LETIVO` | (nada - o critério agora é só `!v.fim`) |
| `rotulaPapel(v.papel)` | `rotulaCargo(v.papel)` |
| `s.cargo` | `cargoDe(s)` |
| `rotulaLotacao(s.lotacao)` | `lotacaoDe(s)` |

- [ ] **Step 5: Afirmar sobre as derivações, no navegador**

Ligar o dev-local. No console:

```js
const m = await import('http://localhost:8123/src/modules/servidores/servidores.model.js');
const s = { vinculos: [
  { papel: 'Gestor(a)',      fim: null,         unidade: { nome: 'Escola Exemplo', apelido: 'Exemplo' } },
  { papel: 'Coordenador(a)', fim: '2025-12-31', unidade: { nome: 'Outra Escola' } },
  { papel: 'Gestor(a)',      fim: null,         unidade: { nome: 'SME - Sede', apelido: 'SME' } },
]};
console.assert(m.vinculosAbertos(s).length === 2, 'só os sem fim');
console.assert(m.lotacaoDe(s) === 'Exemplo · SME', 'lotação = locais abertos');
console.assert(m.cargoDe(s) === 'Gestor(a)', 'cargo sem repetir');
console.assert(m.lotacaoDe({ vinculos: [] }) === '', 'sem vínculo');
console.assert(m.vinculosAbertos(null).length === 0, 'servidor nulo não quebra');

const v = await import('http://localhost:8123/src/modules/servidores/vinculos.model.js');
console.assert(v.normalizaCargo('  Vice-diretor(a)  ') === 'Vice-diretor(a)', 'apara');
console.assert(v.normalizaCargo('Chefe   de   Seção') === 'Chefe de Seção', 'colapsa espaços');
console.assert(v.rotulaCargo('gestor') === 'Gestor(a)', 'legado traduzido');
console.assert(v.rotulaCargo('Vice-diretor(a)') === 'Vice-diretor(a)', 'livre passa direto');
console.assert(v.rotulaCargo(null) === '', 'nulo vira vazio');
console.assert((await v.getCargos()).length === 0, 'catálogo nasce vazio sem banco');
'ok';
```

Esperado: `'ok'`. A terceira asserção é o pedido (e): a lotação é o **nome do local**, não `'escola'`/`'sede'`.

- [ ] **Step 6: Restaurar a chave e commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/escolas/escolas.model.js src/modules/servidores/
git commit -m "refactor(servidores): vinculo vira dono do cargo, da lotacao e do periodo"
```

- [ ] **Step 7: Verificação com dado real (André, na URL de dev)**

Depois da migration: a lista de Escolas continua com 144 (sem a SME); o cargo que aparece na equipe de uma escola está legível; ninguém perdeu vínculo.

---

### Task 7: Servidores - filtros, ficha, formulário e vínculo

**Files:**
- Modify: `src/modules/servidores/servidores.view.js`
- Modify: `src/modules/servidores/views/lista.js`
- Modify: `src/modules/servidores/views/formulario.js`
- Modify: `src/modules/servidores/views/detalhe.js`
- Create: `src/modules/servidores/views/vinculo.js`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces: `render(app, ctx)` lendo `ctx.params.get('unidade')`; `views/vinculo.js` exporta `formVinculo(servidor, vinculo, ctx)` e `removerVinculo(servidor, vinculoId, ctx)`; o `ctx` interno (`ctxAtual()`) ganha `cargos`, `locais`, `filtroUnidade` e `abrirFormVinculo(vinculo)`.

- [ ] **Step 1: Casca - carregar locais e cargos, e a barra de filtros nova**

Em `servidores.view.js`:

1. Estado: `let filtro = { q: '', cargo: '', local: '', semVinculo: false };` e `let cargos = [], locais = [], filtroUnidade = '';`
2. No `render`, ler o parâmetro antes de pintar: `filtroUnidade = ctx.params?.get('unidade') || '';`
3. Carregar em paralelo: `[lista, unidades, locais, cargos] = await Promise.all([getServidores(), getUnidades().catch(() => []), getLocais().catch(() => []), getCargos().catch(() => [])]);`
4. Substituir o bloco `<div class="filters" id="sv-filtros">…</div>` por:

```html
    <div class="toolbar-linha">
      <div class="filtros-linha" id="sv-filtros">
        <label class="filtro-campo">Cargo / função
          <select id="f-cargo"><option value="">Todos</option></select>
        </label>
        <label class="filtro-campo">Lotação
          <select id="f-local"><option value="">Todas</option></select>
        </label>
        <label class="switch">
          <input type="checkbox" id="f-sem" /><span class="switch-trilho" aria-hidden="true"></span>
          Sem vínculo
        </label>
        <span id="sv-chip-uni"></span>
      </div>
    </div>
```

5. Preencher os dois selects depois do carregamento (todo valor por `esc()`):

```js
function pintarOpcoes() {
  document.getElementById('f-cargo').innerHTML =
    `<option value="">Todos</option>` +
    cargos.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  document.getElementById('f-local').innerHTML =
    `<option value="">Todas</option>` +
    locais.map(l => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');
}
```

6. Ligar os eventos:

```js
  document.getElementById('f-cargo').addEventListener('change', e => { filtro.cargo = e.target.value; pintar(); });
  document.getElementById('f-local').addEventListener('change', e => { filtro.local = e.target.value; pintar(); });
  document.getElementById('f-sem').addEventListener('change', e => { filtro.semVinculo = e.target.checked; pintar(); });
```

7. O chip do recorte que veio pela URL:

```js
// Veio de "Gerir servidores e vínculos" na ficha de uma escola: a
// lista abre já restrita à equipe dela, e o chip deixa desfazer.
function pintarChipUnidade() {
  const box = document.getElementById('sv-chip-uni');
  if (!filtroUnidade) { box.innerHTML = ''; return; }
  const nome = locais.find(l => l.id === filtroUnidade)?.nome || 'esta unidade';
  box.innerHTML = `<span class="chip-filtro">Equipe de ${esc(nome)}
    <button type="button" id="sv-limpa-uni" aria-label="Remover o filtro de unidade">×</button></span>`;
  document.getElementById('sv-limpa-uni').addEventListener('click', () => {
    filtroUnidade = ''; pintarChipUnidade(); pintar();
  });
}
```

8. Remover o antigo `document.querySelectorAll('#sv-filtros .chip')…` de `pintar()` - os chips de papel/lotação não existem mais.
9. `ctxAtual()` passa a devolver também `cargos`, `locais`, `filtroUnidade`, e `abrirFormVinculo: (v) => formVinculo(sAtual, v, ctxAtual())` é montado dentro de `detalhe.js` (não aqui). Acrescentar só `cargos`, `locais` e `filtroUnidade` ao objeto.
10. Em `recarregar()`, atualizar também o catálogo: `[lista, cargos] = await Promise.all([getServidores(), getCargos().catch(() => [])]); pintarOpcoes();`

- [ ] **Step 2: Filtragem em `views/lista.js`**

Substituir `vinculosVigentes` e `combina`:

```js
import { vinculosAbertos, lotacaoDe } from '../servidores.model.js';
import { rotulaCargo } from '../vinculos.model.js';
```

```js
function combina(s, ctx) {
  const { filtro, seg, idxUnidades, filtroUnidade } = ctx;
  const abertos = vinculosAbertos(s);

  // Recorte vindo da URL (?unidade=…): só quem está nesta unidade.
  if (filtroUnidade && !abertos.some(v => v.unidade_id === filtroUnidade)) return false;

  if (filtro.cargo && !abertos.some(v => rotulaCargo(v.papel) === filtro.cargo)) return false;
  if (filtro.local && !abertos.some(v => v.unidade_id === filtro.local)) return false;
  if (filtro.semVinculo && abertos.length) return false;

  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. A sede não tem segmento - e por isso continua visível,
  // senão o filtro esconderia justamente a equipe da SME.
  if (seg && seg.selecionados().length) {
    const soSede = abertos.length && abertos.every(v => v.unidade?.tipo === 'sede');
    if (!soSede && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
  }

  if (filtro.q) {
    const alvo = norm([
      s.nome, s.apelido, s.email, s.codigo_funcional, lotacaoDe(s),
      ...(s.telefones || []).map(t => t.numero),
      ...abertos.map(v => `${v.unidade?.nome} ${v.unidade?.apelido} ${rotulaCargo(v.papel)}`),
    ].join(' '));
    if (!alvo.includes(norm(filtro.q))) return false;
  }
  return true;
}
```

E o card:

```js
function card(s) {
  const abertos = vinculosAbertos(s);
  const cargos = [...new Set(abertos.map(v => rotulaCargo(v.papel)).filter(Boolean))]
    .map(c => `<span class="seg">${esc(c)}</span>`).join('');

  const lugares = abertos.length
    ? abertos.map(v => `<span class="tag">${v.unidade?.tipo === 'sede' ? '🏛 ' : ''}${
        esc(v.unidade?.apelido || v.unidade?.nome || '-')}</span>`).join('')
    : `<span class="tag eja">⚠️ Sem vínculo</span>`;

  // Nome completo em caixa alta (como nos sistemas oficiais); o
  // apelido logo abaixo, em caixa normal - não precisa de destaque.
  return `<article class="card" data-id="${esc(s.id)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(s.nome)}</h3>
      ${cargos}
    </div>
    ${s.apelido ? `<div class="apelido">${esc(s.apelido)}</div>` : ''}
    <div class="tags">${lugares}</div>
  </article>`;
}
```

- [ ] **Step 3: Formulário da pessoa**

Em `views/formulario.js`, substituir o `abrirDrawer(...)` pelo formulário no padrão novo. Imports: tirar `LOTACOES`/`CARGOS_SEDE`, entrar `cargoDe`, `lotacaoDe` de `../servidores.model.js` e `mascaraCPF, mascaraRG, noPadraoCPF, noPadraoRG` de `../../../shared/format.js`.

```js
export function formServidor(s, ctx, { voltar = null } = {}) {
  const novo = !s;
  const v = (k) => esc(s?.[k] ?? '');
  const cargo = s ? cargoDe(s) : '';
  const lotacao = s ? lotacaoDe(s) : '';

  // Cargo e lotação continuam à vista - são o que identifica a pessoa
  // - mas não são editáveis aqui: eles vêm do vínculo, que é o único
  // dono desse dado. O ✎ abre a gaveta do vínculo POR CIMA desta.
  const derivado = (rotulo, valor, acao) => `
    <label>${rotulo}
      <span class="campo-derivado">
        ${valor ? esc(valor) : '<span class="vazio">Sem vínculo</span>'}
        ${ctx.podeEditar && !novo
          ? `<button type="button" class="mini-btn" data-vinc="${acao}"
               aria-label="${valor ? 'Editar' : 'Criar'} vínculo">${valor ? '✎' : '+'}</button>`
          : ''}
      </span>
    </label>`;

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo servidor' : 'Editar servidor', novo ? '' : esc(s.nome))}
    <div class="drawer-body">
      <form id="sv-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos auto">
            <label class="col-full">Nome completo <input id="s-nome" required value="${v('nome')}" /></label>
            <label>Apelido / como é chamado(a) <input id="s-apelido" value="${v('apelido')}" /></label>
            <label>Data de nascimento <input id="s-nascimento" type="date" value="${v('nascimento')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Documentos</legend>
          <div class="campos auto">
            <label>CPF <input id="s-cpf" inputmode="numeric" placeholder="000.000.000-00" value="${v('cpf')}" /></label>
            <label>RG <input id="s-rg" inputmode="text" placeholder="00.000.000-0" value="${v('rg')}" /></label>
            <label>Código funcional <input id="s-codigo" inputmode="numeric" value="${v('codigo_funcional')}" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Rede</legend>
          <div class="campos auto">
            <label>Ingresso na rede <input id="s-ingresso" type="date" value="${v('inicio_rede')}" /></label>
            ${derivado('Cargo / função', cargo, 'cargo')}
            ${derivado('Lotação', lotacao, 'lotacao')}
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos auto">
            <label class="col-full">E-mail <input id="s-email" type="email" value="${v('email')}" /></label>
            <div class="col-full">${phonesEditorHtml(s?.telefones)}</div>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="s-msg" class="auth-msg"></span>
          <button type="submit" id="s-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? `<p class="form-hint" style="margin-top:14px">Depois de criar, abra o servidor para vinculá-lo a uma escola ou à SME.</p>` : ''}
    </div>`, { voltar });

  const form = document.getElementById('sv-form');
  montarPhonesEditor(form);

  // Máscara enquanto digita. O caso comum é digitar do começo ao fim;
  // reformatar o valor inteiro mantém o cursor no lugar certo aí.
  const mascarar = (id, fn) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { el.value = fn(el.value); });
    el.value = fn(el.value);
  };
  mascarar('s-cpf', mascaraCPF);
  mascarar('s-rg', mascaraRG);

  // O ✎ de cargo/lotação abre o vínculo sobre esta gaveta; ao fechar,
  // volta para cá com o servidor recarregado.
  form.querySelectorAll('[data-vinc]').forEach(b => b.addEventListener('click', async () => {
    const c = await ctx.recarregar();
    const atual = c.lista.find(x => x.id === s.id);
    const aberto = vinculosAbertos(atual)[0] || null;
    formVinculo(atual, aberto, c, { voltar: () => formServidor(atual, c) });
  }));

  form.addEventListener('submit', (e) => salvarServidor(e, s, ctx));
}
```

Em `salvarServidor`, o payload perde `cargo` e `lotacao` e ganha `nascimento`; o aviso de documento entra antes de gravar:

```js
  const payload = {
    // Nome em caixa alta na origem: os cards e a gaveta exibem assim,
    // e gravar normalizado evita a lista misturar "Maria" e "MARIA".
    nome: val('s-nome').toUpperCase(),
    apelido: val('s-apelido') || null,
    email: val('s-email') || null,
    codigo_funcional: val('s-codigo') || null,
    cpf: val('s-cpf') || null,
    rg: val('s-rg') || null,
    nascimento: document.getElementById('s-nascimento').value || null,
    inicio_rede: document.getElementById('s-ingresso').value || null,
  };
  if (!payload.nome) return falha(msg, 'Informe o nome completo.');

  // Documento fora do padrão é AVISO, não erro: RG de outro estado tem
  // outro formato e a pessoa precisa ser cadastrada assim mesmo (R15).
  const fora = [
    noPadraoCPF(payload.cpf) ? '' : 'CPF',
    noPadraoRG(payload.rg) ? '' : 'RG',
  ].filter(Boolean);
  if (fora.length) {
    toast({ titulo: `${fora.join(' e ')} fora do padrão`,
            texto: 'Salvo assim mesmo - confira se está correto.', tipo: 'ok' });
  }
```

- [ ] **Step 4: Ficha (detalhe) com cargo, lotação e vínculos**

Em `views/detalhe.js`: importar `vinculosAbertos, cargoDe, lotacaoDe` do model da pessoa, `rotulaCargo` de `../vinculos.model.js`, `fmtIdade` de format, e `formVinculo, removerVinculo` de `./vinculo.js`. Trocar o miolo:

```js
  const campoAcao = (rotulo, valor, aria) => `
    <div class="field">
      <div class="lbl">${rotulo}</div>
      <div class="val campo-derivado">
        ${valor ? esc(valor) : '<span class="vazio">Sem vínculo</span>'}
        ${ctx.podeEditar
          ? `<button type="button" class="mini-btn" data-vinc-edit="1"
               aria-label="${aria}">${valor ? '✎' : '+'}</button>`
          : ''}
      </div>
    </div>`;
```

```js
      ${campoAcao('Cargo / função', cargoDe(s), 'Editar o vínculo')}
      ${campoAcao('Lotação', lotacaoDe(s), 'Editar o vínculo')}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', (s.telefones || []).length ? telefonesTexto(s.telefones) : '')}
      ${campo('Nascimento', s.nascimento
        ? `${esc(fmtData(s.nascimento))}${fmtIdade(s.nascimento) ? ` · ${esc(fmtIdade(s.nascimento))}` : ''}`
        : '')}
      ${campo('Código funcional', esc(s.codigo_funcional || ''))}
      ${campo('CPF', esc(s.cpf || ''))}
      ${campo('RG', esc(s.rg || ''))}
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
```

Nas ações do topo, acrescentar o atalho para Horários:

```js
      <a class="mini-btn" href="#/horarios?servidor=${esc(s.id)}">🕒 Horário de trabalho</a>
```

`listaVinculos` passa a ordenar por "aberto primeiro, depois por ingresso decrescente", e cada linha ganha o botão de editar:

```js
function listaVinculos(s, podeEditar) {
  if (!s.vinculos.length) return '<p class="count">Nenhum vínculo cadastrado.</p>';

  // Abertos primeiro; o histórico fica abaixo, apagado.
  const ordenados = [...s.vinculos].sort((a, b) =>
    (Number(Boolean(a.fim)) - Number(Boolean(b.fim)))
    || String(b.ingresso || '').localeCompare(String(a.ingresso || '')));

  return ordenados.map(v => {
    const encerrado = Boolean(v.fim);
    const periodo = [
      v.ingresso ? `desde ${fmtData(v.ingresso)}` : '',
      v.fim ? `até ${fmtData(v.fim)}` : '',
    ].filter(Boolean).join(' · ');
    const acoes = podeEditar ? `
      <div class="vinc-acoes">
        <button class="mini-btn" data-edit-vinc="${esc(v.id)}" aria-label="Editar vínculo">✎</button>
        <button class="mini-btn no" data-del-vinc="${esc(v.id)}" aria-label="Excluir vínculo">🗑</button>
      </div>` : '';
    return `<div class="person ${encerrado ? 'inativo' : ''}">
      <div class="role">${esc(rotulaCargo(v.papel))}${encerrado ? ' · encerrado' : ''}</div>
      <div class="pname">${v.unidade?.tipo === 'sede' ? '🏛 ' : ''}${esc(v.unidade?.nome || '-')}</div>
      <div class="pmeta">
        ${periodo ? `<span>${esc(periodo)}</span>` : ''}
        ${acoes}
      </div>
    </div>`;
  }).join('');
}
```

E os listeners, ao fim de `detalhe()`:

```js
  document.querySelector('[data-vinc-edit]')?.addEventListener('click', () =>
    formVinculo(s, vinculosAbertos(s)[0] || null, ctx, { voltar: () => detalhe(s.id, ctx) }));
  document.getElementById('sv-vinc').addEventListener('click', () =>
    formVinculo(s, null, ctx, { voltar: () => detalhe(s.id, ctx) }));
  const box = document.getElementById('sv-vinculos');
  box.querySelectorAll('[data-edit-vinc]').forEach(b => b.addEventListener('click', () => {
    const v = s.vinculos.find(x => x.id === b.dataset.editVinc);
    formVinculo(s, v, ctx, { voltar: () => detalhe(s.id, ctx) });
  }));
  box.querySelectorAll('[data-del-vinc]').forEach(b =>
    b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc, ctx)));
```

O botão `+ Vincular a uma escola` vira `+ Novo vínculo` (agora também serve para a SME). As funções `encerrar()` e `removerVinculo()` saem daqui - vão para `views/vinculo.js`, e com elas o último `prompt()` do repositório.

- [ ] **Step 5: Criar `views/vinculo.js`**

```js
// ============================================================
// FundHub - servidores/views/vinculo.js
// O formulário da DESIGNAÇÃO: local, cargo, início e fim.
//
// Sem ano letivo: o vínculo é um período, e "está aberto" é não ter
// data de fim. Encerrar é preencher o Término - o mesmo formulário,
// e não mais um prompt() do navegador (R16).
//
// Pode ser aberto sobre a ficha do servidor: quem chama passa
// `voltar`, e o Esc desempilha em vez de fechar tudo.
// ============================================================
import { criarVinculo, atualizarVinculo, excluirVinculo, rotulaCargo } from '../vinculos.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

const OUTRO = '::outro::';   // sentinela: os dois-pontos garantem que
                             // nenhum cargo digitado colide com ele

// `ctx`: { locais, cargos, recarregar } - ver servidores.view.js § ctxAtual().
export function formVinculo(s, vinculo, ctx, { voltar = null } = {}) {
  const novo = !vinculo;
  const cargoAtual = rotulaCargo(vinculo?.papel || '');
  const conhecido = !cargoAtual || ctx.cargos.includes(cargoAtual);

  const opcoesLocal = ctx.locais.map(l =>
    `<option value="${esc(l.id)}" ${l.id === vinculo?.unidade_id ? 'selected' : ''}>${
      l.tipo === 'sede' ? '🏛 ' : ''}${esc(l.nome)}</option>`).join('');

  // O catálogo é derivado dos vínculos existentes: nasce vazio numa
  // base sem ninguém e ganha o cargo assim que alguém digita um.
  const opcoesCargo = ctx.cargos.map(c =>
    `<option value="${esc(c)}" ${c === cargoAtual ? 'selected' : ''}>${esc(c)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo vínculo' : 'Editar vínculo', esc(s.nome))}
    <div class="drawer-body">
      <form id="vc-form" class="esc-form">
        <fieldset class="form-grupo">
          <legend>Designação</legend>
          <div class="campos auto">
            <label class="col-full">Local
              <select id="v-local" required>
                <option value="">Selecione…</option>${opcoesLocal}
              </select>
            </label>
            <label class="col-full">Cargo / função
              <select id="v-cargo" required>
                <option value="">Selecione…</option>
                ${opcoesCargo}
                <option value="${OUTRO}" ${cargoAtual && !conhecido ? 'selected' : ''}>➕ Outro…</option>
              </select>
            </label>
            <label class="col-full" id="v-novo-wrap" ${cargoAtual && !conhecido ? '' : 'hidden'}>
              Qual cargo / função?
              <input id="v-novo" value="${esc(conhecido ? '' : cargoAtual)}" placeholder="Ex.: Vice-diretor(a)" />
            </label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Período</legend>
          <div class="campos auto">
            <label>Início <input id="v-ini" type="date" value="${esc(vinculo?.ingresso || '')}" /></label>
            <label>Término <input id="v-fim" type="date" value="${esc(vinculo?.fim || '')}" />
              <small class="form-hint">Em branco = vínculo em aberto.</small></label>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="v-msg" class="auth-msg"></span>
          <button type="submit" id="v-save" class="btn-primary">${novo ? 'Vincular' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? '' : `<button type="button" class="mini-btn no" id="v-del" style="margin-top:16px">🗑 Excluir vínculo</button>
      <p class="form-hint" style="margin-top:10px">Para preservar o histórico, prefira preencher o Término em vez de excluir.</p>`}
    </div>`, { voltar });

  const sel = document.getElementById('v-cargo');
  sel.addEventListener('change', () => {
    const outro = sel.value === OUTRO;
    document.getElementById('v-novo-wrap').hidden = !outro;
    if (outro) document.getElementById('v-novo').focus();
  });

  document.getElementById('vc-form').addEventListener('submit', (e) => salvar(e, s, vinculo, ctx, voltar));
  document.getElementById('v-del')?.addEventListener('click', () => removerVinculo(s, vinculo.id, ctx));
}

async function salvar(e, s, vinculo, ctx, voltar) {
  e.preventDefault();
  const msg = document.getElementById('v-msg'); msg.className = 'auth-msg';
  const unidade_id = document.getElementById('v-local').value;
  const escolhido = document.getElementById('v-cargo').value;
  const papel = escolhido === OUTRO ? document.getElementById('v-novo').value : escolhido;
  const ingresso = document.getElementById('v-ini').value || null;
  const fim = document.getElementById('v-fim').value || null;

  if (!unidade_id) return falha(msg, 'Selecione o local.');
  if (!String(papel).trim()) return falha(msg, 'Informe o cargo/função.');
  // Fim antes do início é impossível, não indesejável: barra (R15).
  if (ingresso && fim && fim < ingresso) return falha(msg, 'O término não pode ser anterior ao início.');

  const btn = document.getElementById('v-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (vinculo) await atualizarVinculo(vinculo.id, { unidade_id, papel, ingresso, fim });
    else await criarVinculo({ servidor_id: s.id, unidade_id, papel, ingresso, fim });
    const novoCtx = await ctx.recarregar();
    // Volta para a gaveta de baixo já com o dado novo - é para isso
    // que a pilha guarda uma função, e não o HTML anterior.
    if (voltar) voltar(); else novoCtx.abrirDetalhe(s.id);
  } catch (err) {
    falha(msg, err.message || String(err));
    btn.disabled = false; btn.textContent = vinculo ? 'Salvar' : 'Vincular';
  }
}

export async function removerVinculo(s, vinculoId, ctx) {
  const ok = await confirmar('Excluir este vínculo?', {
    detalhe: 'Excluir apaga o registro. Para preservar o histórico, preencha o Término.',
    textoOk: 'Excluir', perigo: true,
  });
  if (!ok) return;
  try {
    await excluirVinculo(vinculoId);
    const novoCtx = await ctx.recarregar();
    novoCtx.abrirDetalhe(s.id);
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'no' });
  }
}
```

- [ ] **Step 6: Verificar a tela em dev-local**

Ligar o dev-local, abrir `http://localhost:8123/#/servidores`. Confirmar:

```js
console.assert(document.getElementById('f-cargo') !== null, 'select de cargo existe');
console.assert(document.getElementById('f-cargo').options.length === 1, 'catálogo vazio = só "Todos"');
console.assert(document.getElementById('f-local') !== null, 'select de lotação existe');
console.assert(document.querySelector('.switch input') !== null, 'toggle existe');
console.assert(document.querySelectorAll('#sv-filtros .chip').length === 0, 'chips antigos removidos');
console.assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'sem rolagem horizontal');
'ok';
```

Depois `#/servidores?unidade=qualquer-coisa` - a tela carrega sem erro e o chip **não** aparece (o id não existe na lista vazia). Console limpo em 375, 768 e 1280.

- [ ] **Step 7: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/servidores/
git commit -m "feat(servidores): filtros por select e toggle, ficha com nascimento e vinculo editavel"
```

- [ ] **Step 8: Verificação com dado real (André, na URL de dev)**

Roteiro: criar um servidor com nascimento, CPF e RG (a máscara formata; a idade aparece na ficha) → vincular a uma escola com início e sem fim (aparece como aberto; a lotação no card vira o nome da escola) → editar o vínculo pelo ✎ da ficha e preencher o Término (some dos abertos, continua no histórico) → criar um vínculo com a SME digitando um cargo novo em "Outro…" (o cargo aparece no filtro) → abrir o formulário de edição do servidor e usar o ✎ ao lado de Cargo (a gaveta do vínculo abre por cima; **Esc volta para o formulário**, não fecha tudo).

---

### Task 8: Escolas - dividir, reorganizar a ficha e ligar a Servidores

**Files:**
- Modify: `src/modules/escolas/escolas.view.js`
- Create: `src/modules/escolas/views/detalhe.js`
- Create: `src/modules/escolas/views/formulario.js`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces: `views/detalhe.js` exporta `detalhe(u, ctx)`; `views/formulario.js` exporta `abrirForm(u, ctx)` e `removerEscola(u, ctx)`. `ctx` = `{ perfil, podeEditar, recarregar, abrirForm, removerEscola }`.

- [ ] **Step 1: Dividir o arquivo**

`escolas.view.js` tem 315 linhas e três superfícies - passa do limite de R11. Mover, sem mudar comportamento ainda:

- `abrirDetalhe` → `views/detalhe.js`, renomeada para `detalhe(u, ctx)` (recebe a unidade, não a chave);
- `abrirForm` + `salvar` + `remover` → `views/formulario.js`, exportando `abrirForm(u, ctx)` e `removerEscola(u, ctx)`;
- a casca fica com `render`, `combina`, `pintar`, `cardHtml`, `porChave` e um `ctxAtual()` no molde do de Servidores.

Rodar `python .claude/scripts/verificar_arquitetura.py` e conferir que o aviso de tamanho de `escolas.view.js` sumiu.

- [ ] **Step 2: Ficha reorganizada**

Em `views/detalhe.js`, substituir o corpo da gaveta:

```js
export function detalhe(u, ctx) {
  const tel = telefonesTexto(u.telefones);
  const maps = u.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.endereco + ', Ribeirão Preto, SP')}`
    : '';

  // Atributo booleano vira CHIP no cabeçalho. Um campo inteiro para
  // dizer "EJA: Não" ocupava espaço para informar nada.
  const chips = [
    u.segmento ? `<span class="seg">${esc(u.segmento)}</span>` : '',
    u.oferta ? `<span class="tag">${esc(u.oferta)}</span>` : '',
    u.tem_transporte ? `<span class="tag bus">🚌 Transporte</span>` : '',
    u.tem_eja ? `<span class="tag eja">🌙 EJA</span>` : '',
  ].filter(Boolean).join('');

  const pessoas = (u.pessoas || []).filter(p => p.nome).map(p => `
    <div class="person">
      <div class="role">${esc(p.papel)}</div>
      <div class="pname">${esc(p.nome)}${p.apelido ? ` · ${esc(p.apelido)}` : ''}</div>
      <div class="pmeta">
        ${p.email ? `<span>✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ''}
        ${p.telefone ? `<span>📱 ${esc(p.telefone)}</span>` : ''}
      </div>
    </div>`).join('') || '<p class="count">Sem pessoas vinculadas.</p>';

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';

  abrirDrawer(`
    ${drawerHead(esc(u.nome), esc(u.nome_oficial || ''))}
    <div class="drawer-body">
      ${chips ? `<div class="tags" style="margin-bottom:14px">${chips}</div>` : ''}
      <div class="drawer-acoes">
        ${ctx.podeEditar ? `<button class="mini-btn" id="edit-esc">✎ Editar</button>` : ''}
        <a class="mini-btn" href="#/horarios?unidade=${esc(u.id)}">🕒 Horários da equipe</a>
        ${ctx.podeEditar ? `<button class="mini-btn no" id="del-esc">🗑 Excluir</button>` : ''}
      </div>

      <h3 class="bloco-tit">Contato e localização</h3>
      ${campo('Endereço', u.endereco
        ? esc(u.endereco) + (maps ? ` · <a href="${maps}" target="_blank" rel="noopener">ver no mapa</a>` : '')
        : '')}
      ${campo('Telefones', tel)}
      ${campo('E-mail institucional', u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : '')}

      <h3 class="bloco-tit">Cadastros e links</h3>
      ${campo('INEP', esc(u.inep))}
      ${campo('Regional', esc(u.regional))}
      ${u.site_apm ? campo('Site APM', `<a href="${esc(u.site_apm)}" target="_blank" rel="noopener">abrir</a>`) : ''}

      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Equipe (${(u.pessoas || []).length})</div></div>
        <a class="mini-btn" href="#/servidores?unidade=${esc(u.id)}">Gerir em Servidores →</a>
      </div>
      <div class="people">${pessoas}</div>
      <p class="form-hint" style="margin-top:10px">
        A equipe vem dos vínculos abertos. Para incluir ou encerrar alguém, use Servidores.
      </p>
    </div>`);

  if (ctx.podeEditar) {
    document.getElementById('edit-esc').addEventListener('click', () => ctx.abrirForm(u));
    document.getElementById('del-esc').addEventListener('click', () => ctx.removerEscola(u));
  }
}
```

Acrescentar a classe do título de bloco em `src/styles/components.css`, junto de `.field`:

```css
/* Título de bloco dentro da gaveta de detalhe. */
.bloco-tit {
  margin: 20px 0 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.drawer-body > .bloco-tit:first-of-type { border-top: 0; padding-top: 0; margin-top: 6px; }
```

- [ ] **Step 3: Formulário no padrão novo**

Em `views/formulario.js`, trocar todo `class="campos duas"` por `class="campos auto"` e marcar como `.col-full` os campos que sempre ocupam a linha: `nome_oficial`, `endereco`, `email`, `site_apm` e o bloco de telefones (envolvê-lo em `<div class="col-full">…</div>`). Os dois checkboxes continuam `.inline` e passam a ser `.col-full` também, para não dividirem coluna com um campo de texto.

- [ ] **Step 4: Filtros da lista**

Em `escolas.view.js`, substituir o `#filters` de chips por:

```html
    <div class="toolbar-linha">
      <div class="filtros-linha" id="filters">
        <label class="filtro-campo">Oferta
          <select id="f-oferta"><option value="">Todas</option></select>
        </label>
        <label class="switch">
          <input type="checkbox" id="f-transporte" /><span class="switch-trilho" aria-hidden="true"></span>
          🚌 Transporte
        </label>
        <label class="switch">
          <input type="checkbox" id="f-eja" /><span class="switch-trilho" aria-hidden="true"></span>
          🌙 EJA
        </label>
      </div>
    </div>
```

O estado vira `{ q: '', oferta: '', transporte: false, eja: false }`; `sincronizarChips()` é apagada; as ofertas saem dos próprios dados:

```js
// As ofertas são as que existem na base - nada fixo no código.
function pintarOfertas() {
  const ofertas = [...new Set(ALL.map(u => u.oferta).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt'));
  document.getElementById('f-oferta').innerHTML =
    `<option value="">Todas</option>` +
    ofertas.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
}
```

e `combina` ganha `if (filtro.oferta && u.oferta !== filtro.oferta) return false;`.

- [ ] **Step 5: Verificar em dev-local**

Abrir `http://localhost:8123/#/escolas`:

```js
console.assert(document.getElementById('f-oferta') !== null, 'select de oferta');
console.assert(document.querySelectorAll('.switch input').length === 2, 'dois toggles');
console.assert(document.querySelectorAll('#filters .chip').length === 0, 'chips antigos removidos');
console.assert(document.documentElement.scrollWidth <= window.innerWidth + 1, 'sem rolagem horizontal');
'ok';
```

Console limpo em 375, 768 e 1280. Marcar e desmarcar os toggles não deve gerar erro (a lista está vazia, mas `pintar()` roda).

- [ ] **Step 6: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/escolas/ src/styles/components.css
git commit -m "feat(escolas): ficha em blocos, filtros por select e toggle, atalhos para equipe e horarios"
```

- [ ] **Step 7: Verificação com dado real (André, na URL de dev)**

Abrir uma escola: os chips do cabeçalho batem com os dados; a equipe lista quem tem vínculo aberto; "Gerir em Servidores →" abre Servidores **já filtrado**, com o chip da escola; removê-lo mostra a lista inteira.

---

### Task 9: Horários - duas visões e permissão correta

**Files:**
- Modify: `src/modules/horarios/horarios.view.js`
- Create: `src/modules/horarios/views/por-escola.js`
- Create: `src/modules/horarios/views/por-servidor.js`
- Create: `src/modules/horarios/views/bloco.js`
- Modify: `src/modules/horarios/horarios.model.js`

**Interfaces:**
- Consumes: Tasks 2, 6.
- Produces: `views/por-escola.js` exporta `renderPorEscola(box, ctx)`; `views/por-servidor.js` exporta `renderPorServidor(box, ctx)`; `views/bloco.js` exporta `formBloco(bloco, { servidorId, unidadeId, dia, nome, recarregar })`. `horarios.model.js`: `getBlocos(unidadeId)` e `getBlocosDoServidor(servidorId)` sem o parâmetro `ano`.

- [ ] **Step 1: Model sem ano e com leitura por servidor**

Em `horarios.model.js`:

```js
// O ano saiu da interface junto com o do vínculo: o que se vê é a
// jornada VIGENTE. A coluna continua no banco como carimbo.
export async function getBlocos(unidadeId) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_bloco')
    .select(SEL).eq('unidade_id', unidadeId)
    .order('dia_semana').order('inicio');
  if (error) throw error;
  return data || [];
}

// A jornada de UMA pessoa, em todos os locais onde ela tem bloco.
export async function getBlocosDoServidor(servidorId) {
  if (!hasSupabase() || !servidorId) return [];
  const { data, error } = await sb().from('horario_bloco')
    .select(`${SEL}, unidade:unidade_escolar(id, nome, apelido, tipo)`)
    .eq('servidor_id', servidorId)
    .order('unidade_id').order('dia_semana').order('inicio');
  if (error) throw error;
  return data || [];
}
```

`criarBloco` continua recebendo `ano` no payload - quem monta o payload passa `new Date().getFullYear()`.

- [ ] **Step 2: Casca com abas**

Reescrever `horarios.view.js` como casca. Estado do módulo: `perfil`, `podeEditar`, `locais`, `seg`, `aba` (`'escola'` | `'servidor'`), `unidadeId`, `servidorId`.

```js
  const params = ctx.params;
  unidadeId = params?.get('unidade') || '';
  servidorId = params?.get('servidor') || '';
  aba = servidorId ? 'servidor' : 'escola';
  podeEditar = podeEscrever('horarios');
```

A barra de abas usa o vocabulário que já existe:

```html
    <div class="tabbar" role="tablist">
      <button class="tab ${aba === 'escola' ? 'on' : ''}" role="tab"
              aria-selected="${aba === 'escola'}" data-aba="escola">🏫 Por escola</button>
      <button class="tab ${aba === 'servidor' ? 'on' : ''}" role="tab"
              aria-selected="${aba === 'servidor'}" data-aba="servidor">👤 Por servidor</button>
    </div>
```

O seletor de ano (`#h-ano`) é removido do HTML e do `render`. O seletor de escola passa a listar `getLocais()` (a SME entra, e a cobertura não se aplica a ela - Step 5).

Trocar `perfil?.isAdmin` por `podeEditar` em todo o módulo:

```js
import { podeEscrever } from '../../core/permissoes.js';
```

> A checagem por `isAdmin` é resquício do modelo binário anterior à migration 021. Quem tem nível `proprios` continua barrado pelo RLS na hora de gravar - a tela nunca foi a barreira.

- [ ] **Step 3: `views/por-escola.js`**

Mover para lá `painelCobertura`, `cartaoServidor`, `linhaDia`, `eixo`, `blocosDe` e `ligarEventos`, exportando:

```js
export async function renderPorEscola(box, ctx) { … }
```

Ajustes de conteúdo:
- `getServidoresDaUnidade(unidadeId)` sem ano;
- `const vinc = vinculosAbertos(s).find(v => v.unidade_id === ctx.unidadeId);` e o subtítulo usa `rotulaCargo(vinc?.papel || '')`;
- o estado vazio deixa de citar o ano: `Esta unidade não tem ninguém com vínculo aberto. Cadastre em <a href="#/servidores?unidade=…">Servidores</a>.`

- [ ] **Step 4: `views/por-servidor.js`**

```js
// ============================================================
// FundHub - horarios/views/por-servidor.js
// A semana de UMA pessoa, agrupada pelos locais onde ela tem jornada.
// É o caminho que faltava: até aqui só dava para chegar ao horário
// escolhendo primeiro a escola, e quem procurava pela pessoa não
// encontrava onde cadastrar.
// ============================================================
```

A tela: um `<select id="hs-servidor">` com os servidores que têm vínculo aberto (`getServidores()` + `vinculosAbertos`), e, para o escolhido, uma `<section class="panel hb-painel">` por local, cada uma com as cinco linhas de dia - a mesma `linhaDia` da visão por escola, importada de `./por-escola.js`.

> `por-servidor.js` importar de `por-escola.js` é import **interno ao módulo**, permitido: R2 só restringe a fronteira entre módulos. Exportar `linhaDia` de `por-escola.js` evita duplicar 30 linhas de barra gráfica.

O botão `+` de cada dia chama `formBloco(null, { servidorId, unidadeId: <o local daquele painel>, dia, nome, recarregar })`.

- [ ] **Step 5: Cobertura só para escola**

Em `renderPorEscola`, o painel de cobertura só é montado quando o local é escola:

```js
  // A janela 7h00–18h20 é regra de ESCOLA: é o horário em que precisa
  // haver alguém da equipe gestora na unidade. Não se aplica à sede.
  const local = ctx.locais.find(l => l.id === ctx.unidadeId);
  const corpo = (local?.tipo === 'sede' ? '' : painelCobertura(ctx))
    + servidores.map(s => cartaoServidor(s, ctx)).join('');
```

- [ ] **Step 6: `views/bloco.js`**

Mover `formBloco`, `salvarBloco` e `removerBloco` para cá, com a assinatura nova:

```js
export function formBloco(bloco, { servidorId, unidadeId, dia, nome, recarregar }) { … }
```

No payload de `criarBloco`, `ano: new Date().getFullYear()`. As validações continuam vindo de `validarDia` no model - a tela só pinta o resultado.

- [ ] **Step 7: Verificar em dev-local**

`http://localhost:8123/#/horarios`:

```js
console.assert(document.querySelectorAll('.tabbar .tab').length === 2, 'duas abas');
console.assert(document.getElementById('h-ano') === null, 'seletor de ano removido');
console.assert(document.querySelector('.tab.on').dataset.aba === 'escola', 'abre em "por escola"');
document.querySelector('[data-aba="servidor"]').click();
console.assert(document.querySelector('.tab.on').dataset.aba === 'servidor', 'troca de aba');
console.assert(document.querySelector('[data-aba="servidor"]').getAttribute('aria-selected') === 'true', 'aria');
'ok';
```

Depois `#/horarios?servidor=abc` - abre já na aba "Por servidor". `#/horarios?unidade=abc` - abre em "Por escola". Console limpo em 375, 768 e 1280.

- [ ] **Step 8: Commitar**

```bash
python .claude/scripts/verificar_arquitetura.py
git add src/modules/horarios/
git commit -m "feat(horarios): visao por servidor, sem ano letivo e permissao por modulo"
```

- [ ] **Step 9: Verificação com dado real (André, na URL de dev)**

Da ficha de um servidor, "🕒 Horário de trabalho" abre a aba dele; o `+` de um dia adiciona bloco; 8h no dia bloqueia com mensagem; 6h contínuas avisa e deixa salvar; da ficha de uma escola, "🕒 Horários da equipe" abre a cobertura dela; um local do tipo sede não mostra o painel de cobertura.

---

### Task 10: Meus dados, versão e fechamento

**Files:**
- Modify: `src/modules/meus-dados/meus-dados.view.js:132,144,166`
- Modify: `src/core/config.js:12`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces: versão `0.11.0`.

- [ ] **Step 1: Meus dados**

Trocar os três pontos que dependiam do modelo antigo:

```js
import { vinculosAbertos, cargoDe } from '../servidores/servidores.model.js';
import { rotulaCargo } from '../servidores/vinculos.model.js';
```

- linha ~132: `const vinculos = vinculosAbertos(s);`
- linha ~144: `<label>Cargo / função <input value="${esc(cargoDe(s))}" readonly /></label>`
- linha ~166: `${esc(v.unidade?.nome || '-')} · ${esc(rotulaCargo(v.papel))}`

- [ ] **Step 2: Varredura final por símbolo morto**

```bash
grep -rn "ANO_LETIVO\|rotulaPapel\|\bPAPEIS\b\|LOTACOES\|rotulaLotacao\|CARGOS_SEDE\|\.ativo\b" src --include=*.js
grep -rn "prompt(\|confirm(\|alert(" src --include=*.js | grep -v confirmar
grep -rn "campos duas" src --include=*.js
```

Esperado: nenhum resultado nos dois primeiros. O terceiro pode listar módulos fora do escopo (Afastamentos, SATE) - `.campos.duas` continua válida para quem ainda não foi tocado; não migrar agora.

- [ ] **Step 3: Subir a versão**

Em `src/core/config.js`, `versao: '0.11.0'` (MINOR: mudou o modelo de dados).

- [ ] **Step 4: Changelog**

Inserir antes da entrada `## [0.10.2]`, escrito **para quem usa** - sem jargão, sem nome de arquivo:

```markdown
## [0.11.0] - 2026-08-25

Rodada de **cadastro de pessoas**: onde alguém trabalha, com que cargo e
desde quando passa a ser uma informação só, no lugar certo.

### Adicionado
- Data de nascimento no cadastro do servidor, com a idade ao lado.
- É possível vincular alguém à **SME**, e não só a uma escola - com data
  de início e de término, como qualquer outra designação.
- Os vínculos agora podem ser **editados**, não só criados e encerrados.
- Horários de Trabalho ganhou a visão **Por servidor**: dá para achar a
  pessoa e montar a jornada dela sem passar pela escola. Na ficha de cada
  servidor há um atalho direto para lá.
- Na ficha de uma escola, "Gerir em Servidores" já abre a lista mostrando
  só a equipe daquela unidade.

### Alterado
- O **cargo/função** deixou de ser digitado no cadastro da pessoa: ele vem
  da designação. A lista de opções se monta sozinha com os cargos em uso -
  um cargo novo entra quando alguém o usa pela primeira vez e some quando
  ninguém mais o ocupa.
- A **lotação** passou a mostrar o nome do lugar (a escola ou a SME), em
  vez de apenas "Escola" ou "Sede".
- Um vínculo é considerado **em aberto** enquanto não tiver data de
  término. Não é mais preciso informar ano letivo em lugar nenhum.
- Os formulários de servidor e de escola foram reorganizados: rótulos
  sempre acima do campo, campos agrupados por assunto e um campo sozinho
  na linha ocupa a largura toda.
- CPF e RG agora são formatados enquanto você digita.
- Os filtros de Servidores e de Escolas trocaram os botões por listas e
  chaves liga/desliga.
- A ficha da escola foi reorganizada em blocos, com a equipe em destaque.
- Ao editar um vínculo a partir do cadastro do servidor, a janela abre por
  cima da anterior - e o Esc volta para ela, em vez de fechar tudo.
```

- [ ] **Step 5: Verificação final**

```bash
python .claude/scripts/verificar_arquitetura.py
git diff --cached
git status --short
```

Confirmar: exit 0; `src/core/config.js` só com a mudança de versão (a chave publishable restaurada); nenhum dado real no diff.

Com o dev-local ligado, percorrer `#/dashboard`, `#/escolas`, `#/servidores`, `#/horarios` e `#/meus-dados` em 375px e 1280px, com o console aberto. Nenhum erro.

- [ ] **Step 6: Commitar**

```bash
git add src/modules/meus-dados/meus-dados.view.js src/core/config.js CHANGELOG.md
git commit -m "chore: versao 0.11.0 e fecha a rodada de servidores, escolas e horarios"
```

- [ ] **Step 7: Entregar para validação**

Avisar o André que a rodada está na `dev` e que a validação na URL de dev depende da migration 023 já ter rodado. O merge `dev → main` é decisão dele.

---

## Auto-revisão do plano

**Cobertura da spec:**

| Seção da spec | Tarefa |
|---|---|
| 3.1 nascimento · 3.2 SME · 3.3 vínculo por período · 3.4 degradação | 1, 6 |
| 4.1 rota com query | 2 |
| 4.2 gaveta empilhada · 4.3 foco | 3 |
| 5 vocabulário de formulário · máscaras | 4, 5, 7, 8 |
| 6.1 formulário · 6.2 vínculo · 6.3 catálogo · 6.4 lotação · 6.5 filtro por escola | 6, 7 |
| 7.1 ficha · 7.2 formulário · 7.3 divisão | 8 |
| 8.1 duas visões · 8.2 atalhos · 8.3 permissão · 8.4 cobertura da SME | 7, 8, 9 |
| 9 filtros | 7, 8 |
| 10 arquivos afetados | todas |
| 13 critérios de aceite | verificados nas Tasks 7–10 |

**Consistência de nomes** (definidos numa tarefa, usados em outra): `caminhoDaRota` (T2 → T2), `abrirDrawer(html, { voltar })` (T3 → T7), `fmtIdade` / `mascaraCPF` / `mascaraRG` / `noPadraoCPF` / `noPadraoRG` (T4 → T7), `.campos.auto` / `.col-full` / `.campo-derivado` / `.filtros-linha` / `.filtro-campo` / `.switch` / `.chip-filtro` / `.bloco-tit` (T5, T8 → T7, T8), `getLocais` / `vinculosAbertos` / `lotacaoDe` / `cargoDe` / `getServidoresDaUnidade` / `getCargos` / `rotulaCargo` / `normalizaCargo` / `cargoCanonico` / `criarVinculo` / `atualizarVinculo` / `excluirVinculo` (T6 → T7, T9, T10), `formVinculo(s, vinculo, ctx, { voltar })` / `removerVinculo(s, id, ctx)` (T7 → T7), `renderPorEscola` / `renderPorServidor` / `formBloco` / `linhaDia` / `getBlocos(unidadeId)` / `getBlocosDoServidor` (T9 → T9).

**Defeito encontrado e corrigido na revisão:** a Task 1 apresentava a migration sem os guardas de idempotência em 3a e 3c, e mandava corrigi-la no passo seguinte - um plano que pede para escrever código errado de propósito. Os guardas passaram para o Step 1 e o Step 2 virou o que devia ser: uma conferência com resposta obrigatória para cada comando.
