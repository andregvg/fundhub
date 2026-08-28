# Criar um módulo novo

Cinco passos, sempre os mesmos. Antes de começar, confirme que é mesmo um módulo:

- **Tem rota e tela própria?** → módulo completo (com manifesto).
- **É uma tela que só lê dados de outros?** → módulo agregador (com manifesto, sem model).
- **É um domínio novo consumido por telas existentes?** → módulo de domínio sem tela
  (só `<x>.model.js`, sem manifesto - como `telefones` e `locais`).
- **É mais uma aba de um módulo existente?** → **não é módulo.** Vire uma aba em `views/`.
  A navegação já é longa; nem todo assunto merece rota.

## 1. Migration

`supabase/migrations/<NNN>_<x>.sql` - conferir qual é o próximo número livre na pasta.

```sql
create table if not exists <tabela> ( ... );
alter table <tabela> enable row level security;

create policy "<tabela>_select" on <tabela> for select using (is_autorizado());
create policy "<tabela>_write"  on <tabela> for all    using (is_admin()) with check (is_admin());

grant select, insert, update, delete on <tabela> to authenticated;
```

Mais: religar o trigger de auditoria e acrescentar a tabela ao array da `019`. A migration precisa
ser **idempotente** (`if not exists`, `on conflict do nothing`) - ela pode ser rodada duas vezes.

Rodar no SQL Editor do painel. Checklist completo em `.claude/rules/seguranca.md`.

## 2. Model - `src/modules/<x>/<x>.model.js`

Só banco e regras de domínio. **Nunca DOM.** Toda função começa com o guarda de dev-local:

```js
import { sb, hasSupabase } from '../../core/supabase.js';

let _cache = null;

export async function get<X>(opts = {}) {
  if (!hasSupabase()) return [];
  const { data, error } = await sb().from('<tabela>').select('*').order('...');
  if (error) throw error;
  return data || [];
}

export async function criar<X>(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { data, error } = await sb().from('<tabela>').insert(payload).select().single();
  if (error) throw error;
  _cache = null;               // escreveu, invalidou
  return data;
}
```

Degradar se a migration ainda não rodou (`42P01` tabela ausente, `42703` coluna ausente).
Este arquivo é a **API pública** do módulo - é o único que outros módulos podem importar.

## 3. View - `src/modules/<x>/<x>.view.js`

Exporta `render(app, ctx)`. **Nunca chama `sb()`.** Usa `ctx.perfil`, que já vem do roteador -
não chamar `getPerfilAtual()` de novo.

```js
export async function render(app, ctx = {}) {
  const perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>…</h1>
      <p>…</p>
    </div>
    <div class="toolbar">…</div>
    <div id="<x>-body">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  // carregar → pintar
}
```

Todo valor do banco passa por `esc()`. Reusar o vocabulário de `components.css` antes de escrever
CSS novo (ver `.claude/rules/ui.md`).

## 4. Manifesto - `src/modules/<x>/module.js`

```js
export default {
  id: '<x>',
  ico: '📌',
  cor: '<token>',              // opcional - destaque do módulo
  nome: 'Nome completo',
  desc: 'Uma linha sobre o que o módulo faz.',
  navNome: 'Nome curto',       // opcional - se o nome completo não couber no menu
  rota: '#/<x>',
  nav: true,
  grupo: 'modulos',            // principal | modulos | conta | admin | ajuda
  perm: '<x>',                 // opcional - default é o próprio id
  ativo: true,
  load: () => import('./<x>.view.js'),
};
```

Registrar em `src/core/registry.js`: um `import` no topo e o nome no array `MODULOS`
(a ordem no array é a ordem no menu). Isso faz o tile, a rota e o item de navegação aparecerem
sozinhos.

Se o módulo é um **serviço de fundo** (sem tela), use `servico: true` em vez de `rota`/`nav`, e
exporte `iniciar()` / `parar()` - ver `notificacoes`.

## 5. Permissões e CSS

- Acrescentar as linhas de `papel × módulo → nível` na migration de permissões (padrão da `021`),
  senão o módulo nasce **oculto** para todo mundo (política segura por omissão).
- Se tiver CSS próprio: `<x>.css` na pasta **e** um `@import` em `src/styles/main.css`.

## Antes de commitar

```bash
python .claude/scripts/verificar_arquitetura.py
```

E ainda: testar em dev-local **inclusive em tela estreita**, conferir o console, rodar
`git diff --cached` procurando dado real, commitar na `dev`.

Ao fechar a entrega: subir `CONFIG.versao` e registrar em `CHANGELOG.md` - escrito para quem **usa**
o sistema, sem jargão e sem nome de arquivo.
