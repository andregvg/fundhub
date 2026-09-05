# FundHub - Local de trabalho: vocabulário único e locais não-escolares

> Decisões tomadas em 05/09/2026. Bloco J da rodada de melhorias.
> **Depende do Bloco A** - o editor dos locais internos é um painel de
> configuração de rede (Bloco A, D6). Entra depois de A e B, antes de E.
> Entrega prevista como MINOR (mudança de modelo + vocabulário de hub).

## 1. Os problemas

Quatro coisas, ligadas pelo mesmo conceito:

1. **Vocabulário dividido.** O sistema chama de "vínculo" e "lotação"
   aquilo que o sistema oficial da Secretaria chama de **"local de
   trabalho"**. Quem opera os dois sistemas traduz o tempo todo.
2. **Só escola conta como local.** O vínculo de um servidor aponta para
   uma linha de `unidade_escolar` - as 144 escolas mais a "SME - Sede"
   (migration 023). Não existe "SME - Subsecretaria Pedagógica", nem as
   gerências, como local de trabalho possível. Um gestor designado para
   uma gerência interna hoje só pode ser lotado na Sede genérica.
3. **O nome do local interno não é editável** por quem usa. "SME - Sede"
   entrou por migration; qualquer novo local interno também exigiria uma.
4. **Cargo e local não entram no cadastro da pessoa.** A modal "Novo
   servidor" cria a pessoa; para dizer onde ela trabalha é preciso
   abrir a ficha e criar um vínculo num segundo passo. Quem cadastra um
   gestor sabe o cargo e a lotação na hora.

## 2. O que NÃO muda

A decisão da migration 023 continua de pé: **cargo e local de trabalho
moram no vínculo, nunca no servidor**. As colunas `servidor.cargo` e
`servidor.lotacao` seguem mortas. O que este bloco muda é a *ergonomia*
de criar o primeiro vínculo - não onde o dado vive. Duas fontes de
verdade para "onde a pessoa trabalha" foi o bug que a 023 corrigiu, e
nada aqui o reabre.

## 3. Decisões

### D1 - "Local de trabalho" na interface inteira

Troca de rótulo, não de tabela. A tabela `vinculo` e a coluna
`unidade_id` continuam com esses nomes no banco; o que a pessoa lê muda:

| Hoje (tela) | Passa a ser |
|---|---|
| "Vínculo" / "Novo vínculo" / "Editar vínculo" | "Local de trabalho" / "Adicionar local de trabalho" / "Editar" |
| "Lotação" (filtro em Servidores, campo derivado na ficha) | "Local de trabalho" |
| "Local" (campo no formulário do vínculo) | "Local de trabalho" |
| "Sem vínculo" (card e filtro) | "Sem local de trabalho" |
| "cargo e lotação vêm do vínculo" (tutorial de Servidores, Bloco B) | "cargo e local de trabalho vêm do registro de designação" |

A função `lotacaoDe(s)` em `servidores.model.js` é renomeada para
`localDeTrabalhoDe(s)` - é API pública do módulo (atravessa a fronteira:
`meus-dados`, `usuarios`, `horarios` a consomem), então o rename é feito
nos importadores no mesmo commit. `cargoDe(s)` não muda de nome.

São ~27 ocorrências de "lota*" em `src/` mais os textos de "vínculo" -
todas trocadas de uma vez. O verificador não deve encontrar nenhuma
sobra (o mesmo cuidado da lição de "vocabulário abandonado sobrevive em
texto solto").

### D2 - Locais não-escolares são linhas de `unidade_escolar`

Migration **028**. O `CHECK` de `unidade_escolar.tipo` ganha um valor:

```sql
alter table unidade_escolar drop constraint if exists unidade_tipo_valido;
alter table unidade_escolar add constraint unidade_tipo_valido
  check (tipo in ('escola', 'sede', 'interno'));
```

`interno` = gerência, subsecretaria, coordenadoria - qualquer local de
trabalho dentro da SME que não seja "a Sede" genérica nem uma escola.
"SME - Sede" continua `tipo = 'sede'` (é a linha que a 023 semeia e para
a qual os servidores da sede já apontam); os novos entram como `interno`.

**Por que não uma tabela nova** (`local_trabalho`, com o vínculo
apontando para escola *ou* para ela): porque o vínculo já aponta para
`unidade_escolar`, `getLocais()` já une escola + sede, o filtro de
segmento já trata `segmento = null` como "sem eixo" (Bloco H, D1), a
grade de Horários já lê `unidade_escolar`, e a auditoria já cobre a
tabela. Uma tabela paralela duplicaria a policy, o embed do vínculo, o
seletor de busca e o backfill - para guardar linhas com **menos**
colunas que uma escola. `tipo` é exatamente o discriminador que a 023
criou para isto.

**O que um `interno` tem:** `nome`, `apelido` (opcional), `tipo`. Nada
de segmento, endereço, transporte, INEP. `segmento` fica `null`, e todo
o vocabulário de segmento já lida com isso.

`getUnidades()` (a lista do módulo Escolas) **não muda** - continua
`.eq('tipo', 'escola')`. Uma gerência não é uma escola e não aparece na
tela de Escolas.

`getLocais()` passa a trazer os três tipos, ordenados: Sede, depois os
`interno` em ordem alfabética, depois as escolas. É a lista que o
formulário de local de trabalho e o seletor de Horários usam.

Onde o código hoje testa `tipo === 'sede'` para decidir "é um lugar da
SME, não uma escola" (ícone no card, isenção do filtro de segmento,
ordenação), passa a testar `tipo !== 'escola'`. Um helper
`eLocalInterno(u)` em `escolas.model.js` centraliza isso.

### D3 - O editor dos locais internos é um painel de configuração

Bloco A entrega o mecanismo de painel (D6) e cria `escolas.config.js`
(Bloco A, §4). Este bloco acrescenta a esse arquivo mais um item, escopo
`rede`, grupo "Regras e limites":

```js
{ chave: 'locais_internos', escopo: 'rede', grupo: 'regras',
  rotulo: 'Locais de trabalho internos',
  dica: 'Gerências, subsecretarias e coordenadorias da SME onde há '
      + 'servidores lotados. As escolas se cadastram na própria tela.',
  painel: pintarLocaisInternos }
```

O painel: lista os `tipo = 'interno'` com o `nome` editável no lugar
(mesmo tratamento de campo do resto do hub - `--campo`, rótulo padrão),
um botão de excluir (vermelho, Bloco I) que só funciona se **nenhum
vínculo** aponta para o local, e uma linha "adicionar" com um campo de
nome. "SME - Sede" aparece na lista, com o nome editável, mas **sem**
botão de excluir - é a lotação de fallback da equipe da sede.

Escrita protegida por `pode_escrever('escolas')` no banco (as policies
de `unidade_escolar` já são `is_admin()`; se o Bloco A introduzir
`pode_escrever`, alinhar). Excluir com vínculo aberto é **erro** (R15):
o banco recusa por FK e a tela explica antes.

Três funções novas em `escolas.model.js`, o dono de `unidade_escolar`:

```js
getLocaisInternos()                 // tipo in ('sede','interno'), com contagem de vínculos
criarLocalInterno(nome)             // insert tipo='interno'
renomearLocalInterno(id, nome)      // update nome
excluirLocalInterno(id)             // delete; 23503 (FK) → erro amigável
```

`criarUnidade`/`atualizarUnidade` (o formulário de escola) **não
mudam** - `tipo` não entra no `CAMPOS` deles.

### D4 - Cargo e local de trabalho na modal "Novo servidor"

`formServidor`, só no modo `novo`, ganha um `<fieldset>` opcional
**"Local de trabalho"** com três campos: local (busca-seleção, como no
formulário do vínculo), cargo/função (o mesmo `<select>` + "Outro…" de
`vinculo.js`) e início (data).

No submit, se o local estiver preenchido:

```
criarServidor(payload)                          → id
sincronizarTelefones(...)
se (local)  criarVinculo({ servidor_id: id, unidade_id, papel, ingresso })
recarregar()
```

Regras:

1. **Local preenchido exige cargo.** Sem cargo, é erro inline - não dá
   para ter designação sem função. Cargo sem local: ignora o cargo
   (não há onde pendurá-lo) e avisa.
2. **Falha ao criar o vínculo não desfaz o servidor.** O servidor já
   está no banco; o toast diz "Servidor criado, mas o local de trabalho
   não pôde ser salvo - adicione pela ficha". Meia-gravação silenciosa
   seria pior.
3. **É atalho, não novo caminho.** A ficha do servidor continua sendo
   onde se gerencia mais de um local, se encerra, se corrige. O
   fieldset da modal cria só o primeiro, só no cadastro.

O campo de cargo aparece nos dois lugares agora (modal de servidor e
formulário do vínculo). São dois usos - a R13 pede três para extrair.
Fica duplicado até o terceiro; se o Bloco G (que mexe em cargos) criar
um terceiro, aí se extrai `campoCargo()`.

### D5 - `getLocais()` e o seletor não confirmam existência a quem não pode

Nada novo de segurança - `unidade_escolar` já é `is_autorizado()` para
select. Registrado só para o plano não esquecer: o painel de locais
internos segue a regra dos painéis de rede do Bloco A (D10) - quem tem
`leitura` em Escolas vê a lista desabilitada, com os nomes visíveis;
quem tem `oculto` não vê o painel.

## 4. Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/028_local_trabalho.sql` | `CHECK` de `tipo` com `interno`; idempotente; `unidade_escolar` já está na auditoria da 019 |
| `src/modules/escolas/escolas.model.js` | `getLocais()` com os três tipos; `eLocalInterno`; `getLocaisInternos`/`criarLocalInterno`/`renomearLocalInterno`/`excluirLocalInterno` |
| `src/modules/escolas/escolas.config.js` | acrescenta o item `locais_internos` + `pintarLocaisInternos` (arquivo criado no Bloco A) |
| `src/modules/servidores/servidores.model.js` | `lotacaoDe` → `localDeTrabalhoDe` (API pública) |
| `src/modules/servidores/servidores.view.js` | filtro "Lotação" → "Local de trabalho" |
| `src/modules/servidores/views/formulario.js` | fieldset "Local de trabalho" no modo novo (D4) |
| `src/modules/servidores/views/vinculo.js` | rótulos "Local de trabalho"; legenda; título da gaveta |
| `src/modules/servidores/views/detalhe.js` · `views/lista.js` | rótulos; "Sem local de trabalho" |
| `src/modules/servidores/module.js` | `desc` do manifesto |
| `src/modules/{meus-dados,usuarios,horarios}/*` | importadores de `lotacaoDe` renomeados; rótulos onde aparecem |
| `src/modules/horarios/views/por-servidor.js` | rótulo "lotação" |
| `docs/modulos/servidores.md` | vocabulário (Bloco B escreve; se já escrito, corrige no mesmo commit) |
| `CHANGELOG.md` · `src/core/config.js` | versão MINOR |

## 5. Riscos

| Risco | Mitigação |
|---|---|
| "lota*" sobrar em texto solto depois do rename | varredura obrigatória (`grep -rniI "lota\|vínculo"`) antes de fechar - lição registrada de rodadas anteriores |
| Local interno aparecer na tela de Escolas | `getUnidades()` mantém `.eq('tipo','escola')`; critério de aceite |
| Excluir local interno com servidor lotado | FK recusa (`23503`); a tela checa a contagem antes e explica |
| Vínculo criado na modal falhar e deixar servidor "solto" | D4.2: servidor permanece, toast explica, ficha resolve |
| Migration 028 não rodar | `CHECK` antigo continua valendo; `criarLocalInterno` recebe `23514` → erro amigável "atualização do banco pendente"; sem `interno`, o resto do hub funciona igual a hoje |
| `tipo === 'sede'` esquecido em algum lugar | helper `eLocalInterno`; varredura de `'sede'` no plano |

## 6. Critérios de aceite

1. Nenhuma tela do hub diz "vínculo" ou "lotação" para se referir ao
   local de trabalho; o verificador não acha sobras.
2. Um admin cria "SME - Subsecretaria Pedagógica" pelo painel de
   configuração de Escolas, sem migration, e ela passa a aparecer no
   seletor de local de trabalho.
3. O nome de um local interno é editável no painel; renomear reflete em
   todos os cards de quem está lotado ali.
4. Excluir um local interno com servidor lotado é recusado com mensagem
   clara; sem ninguém lotado, funciona.
5. A tela de Escolas continua listando só escolas.
6. Na modal "Novo servidor", preencher local + cargo + início cria a
   pessoa e o primeiro local de trabalho de uma vez; deixar em branco
   cria só a pessoa.
7. Local sem cargo é erro inline; cargo sem local é ignorado com aviso.
8. Um servidor lotado só num local interno aparece na lista de
   Servidores mesmo com um eixo filtrado (Bloco H, D1).
9. `lotacaoDe` não existe mais; `localDeTrabalhoDe` devolve o mesmo que
   ela devolvia.
10. Legível em 375px, nos dois temas.
11. `node --test tests/` e `python .claude/scripts/verificar_arquitetura.py`
    sem falhas.
