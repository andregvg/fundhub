# FundHub

Hub de aplicações gerenciais da **Gerência de Ensino Fundamental** — Secretaria Municipal da Educação de Ribeirão Preto.

- **Front-end:** SPA estática (HTML/CSS/JS, sem build) servida pelo **GitHub Pages**.
- **Back-end:** **Supabase** (Postgres + Auth + RLS + Realtime + Storage + Edge Functions).
- **URL atual:** https://andregvg.github.io/fundhub/ — construído sob base `/fundhub` para migração indolor a um domínio próprio.

## Estado

Fase 1 — **Cadastros**. Módulo **Escolas** funcional (144 unidades). Demais módulos entram por etapas — ver [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md).

## Estrutura

```
index.html            Casca do hub + carregamento do supabase-js (CDN)
assets/css/styles.css Estilos (tema claro/escuro)
assets/js/
  config.js           URL + anon key do Supabase (vazio = modo local)
  data.js             Camada de dados: Supabase ou data/unidades.json
  escolas.js          Módulo Cadastro de Escolas
  app.js              Roteador (hash) + hub
data/unidades.json    Dados das escolas (gerado do CSV) — fallback local
supabase/
  schema.sql          Schema Postgres (Fase 1)
  seed_unidades.sql   Inserts das 144 unidades / servidores / vínculos
docs/BLUEPRINT.md     Arquitetura e roteiro
```

## Conectar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `supabase/schema.sql` e depois `supabase/seed_unidades.sql`.
3. Em **Project Settings → API**, copie *Project URL* e *anon public key* para `assets/js/config.js`.
4. O rótulo no topo passa de “dados locais” para “Supabase”.
