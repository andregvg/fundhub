# FundHub - Usuários: tabela de papéis viva, nome em caixa alta e ajustes

> 26/09/2026. Entrega junto da 0.37.0: migration `043`.

## D1 - A tabela de papéis na Ajuda é gerada, não escrita

**Pedido:** a Ajuda de Usuários mostra os papéis e o nível padrão de cada
um por módulo, e a tabela precisa acompanhar toda mudança de papel ou de
padrão.

**Decisão:** em vez de uma tabela escrita à mão e de um monitor que cobre a
reescrita, a tabela é **montada ao vivo** a partir do banco, pela mesma
função que já alimenta a Documentação técnica
(`usuarios.model.js § getMatrizDePermissoes`). Mudou um padrão numa
migration → a Ajuda mudou no mesmo instante. Não há texto para esquecer.

**Como o texto a pede:** um *bloco vivo* - cerca de código com a palavra
`vivo` e o id do bloco:

````
```vivo
permissoes-padrao
```
````

- `modules/ajuda/markdown.js` passa a traduzir a cerca `vivo` em
  `<div class="md-vivo" data-vivo="<id>"></div>` (id restrito a
  `[a-z0-9-]`; qualquer outro vira texto). Fora do FundHub (GitHub), o `.md`
  mostra a cerca como código - degrada legível.
- `modules/ajuda/ajuda.view.js` tem o mapa `id → preenchedor`. O único id
  hoje: `permissoes-padrao`, que desenha a matriz com `montarTabela`
  (R18). O desenho é o mesmo da Documentação técnica; são dois usos, então
  cada view tem o seu (R13 - a terceira cópia é que extrai).
- Id desconhecido: o bloco mostra "Conteúdo indisponível". Falha de leitura:
  `erroBox`.

**Guarda (o "monitor" pedido):** a checagem 11 do verificador ganha o item
**d**: `docs/modulos/usuarios.md` sem o bloco `permissoes-padrao` →
**bloqueia**; bloco vivo com id que `ajuda.view.js` não conhece → **bloqueia**.
A tabela não pode ser apagada nem trocada por uma cópia estática sem o
verificador acusar.

A legenda da tabela, escrita no `.md`, explica o asterisco (nível
implícito: administrador em tudo; módulo de serviço em leitura).

## D2 - Permissões por módulo: o texto cabe no campo

- A opção herdada passa de "Padrão do papel (Leitura)" para
  **"Padrão: Leitura"**.
- `.perm-sel` com `font-size: 13px` e largura mínima que comporte "Padrão:
  Proprios"; a linha `.perm-linha` deixa o nome do módulo quebrar
  (`min-width: 0`) antes de espremer o select.

## D3 - Nome de exibição em CAIXA ALTA

**Regra:** todo nome de exibição é gravado em maiúsculas.

- **No banco (vale):** gatilho `before insert or update` em `perfil`:
  `new.nome := nullif(upper(btrim(new.nome)), '')`. Pega também o que a
  pessoa edita em Meus dados e o que entra por SQL. A `043` converte os
  nomes existentes.
- **Na tela (conforto):** os campos de nome de exibição (Usuários e Meus
  dados) mostram em maiúsculas enquanto se digita
  (`text-transform: uppercase`) e o valor sai `toUpperCase()` - o que se vê
  é o que se grava.

`upper()` do Postgres respeita acento em UTF-8 (`ç` → `Ç`, `ã` → `Ã`).

## D4 - "Acesso ativo" alinhado com a caixa do Papel

Hoje o switch alinha pela linha do rótulo do select. O `.acesso-row` já
declara `align-items: end`, mas o `<label>` do Papel empilha rótulo e
select e o `.switch` tem altura de botão. Correção no container, como manda
a regra de alinhamento (ui.md): o switch da `.acesso-row` recebe
`min-height: var(--campo)` e alinha pela base - a base do trilho encontra a
base da caixa do select.

## D5 - Equipe SME passa a ler, não escrever

Migration `043`: em `papel_permissao`, `equipe_sme` vai de `escrita` para
`leitura` em `sate`, `viagens`, `afastamentos`, `projetos`, `ocorrencias`,
`atas` e `visitas`.

**Vale para todos os Equipe SME, inclusive os que já existem** (decisão de
26/09/2026): o padrão é consultado ao vivo, não copiado. Quem precisar
escrever recebe exceção individual.

Idempotente (`update … where`), termina com `select religar_auditoria();`.

## Arquivos

| Arquivo | O quê |
|---|---|
| `supabase/migrations/043_usuarios_nome_e_equipe_sme.sql` | gatilho do nome, conversão, padrões da Equipe SME |
| `modules/ajuda/markdown.js` | cerca `vivo` |
| `modules/ajuda/ajuda.view.js` | preenchedor `permissoes-padrao` |
| `modules/usuarios/usuarios.view.js`, `usuarios.css` | D2, D3, D4 |
| `modules/meus-dados/meus-dados.view.js` | D3 (tela) |
| `docs/modulos/usuarios.md` | seção "Papéis e níveis padrão" com o bloco vivo |
| `.claude/scripts/verificar_arquitetura.py` | checagem 11d |
| `.claude/rules/documentacao.md` | registrar a cerca `vivo` no subconjunto suportado |
