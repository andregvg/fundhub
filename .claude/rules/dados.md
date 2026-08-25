# Dados — datas, validação e persistência

Regras R8 e R15. Contexto em `docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

## R8 — Datas e horários

Existem **dois tipos** e eles nunca se convertem um no outro:

| Tipo | Forma | Exemplo | Fuso |
|---|---|---|---|
| **Data civil** | `string` `yyyy-mm-dd` | `'2026-08-25'` | nenhum — é um dia do calendário, não um instante |
| **Timestamp** | ISO/UTC do banco | `'2026-08-25T14:32:10.123Z'` | exibido em `America/Sao_Paulo` |

Uma data de início de afastamento, um dia do calendário escolar, a data de uma solicitação: são
**datas civis**. Um carimbo de criação, um último acesso, um evento de auditoria: são **timestamps**.

### As regras

1. **Data civil nunca vira `Date` para ser formatada.** Manipular como string
   (`fmtData`, `addDias`, comparação direta `a.inicio <= iso`). Comparar `yyyy-mm-dd` com `<`/`>`
   funciona porque o formato é ordenável lexicograficamente — usar isso.
2. **`toISOString()` nunca produz data civil.** `new Date().toISOString().slice(0,10)` volta um dia
   à noite no Brasil. Para "hoje", use `hojeISO()` (que usa `toLocaleDateString('sv-SE')`).
3. **Ao construir um `Date` a partir de data civil, sempre `+ 'T00:00:00'`** — sem isso o JS
   interpreta como UTC e o dia muda.
4. **Timestamp só é exibido por `fmtDataHora`**, que fixa `America/Sao_Paulo`. Nunca formatar
   timestamp à mão.
5. **Toda API de formatação de data/hora fica confinada em `shared/format.js`.** Módulo, view e
   shell não chamam `toISOString`, `toLocaleDateString`, `toLocaleString` nem `toLocaleTimeString`.
   Se falta uma formatação, acrescente a função em `format.js`.

Aritmética de calendário (`new Date(ano, mes - 1, 1)` para montar a grade mensal) é legítima em uma
view — o que não é legítimo é **formatar ou serializar** fora de `format.js`.

### O que `shared/format.js` oferece

`hojeISO()` · `fmtData(iso)` · `fmtExtenso(iso)` · `addDias(iso, n)` · `fmtDataHora(ts)` ·
`horaAgora()` · `MESES` · `DOW` · `isUuid()`

## R15 — Validação em dois níveis

- **No front, para UX.** Feedback imediato, mensagem em português, na hora certa.
- **No banco, para valer.** Constraint, CHECK, índice único, policy. É a única validação que não
  se contorna pelo console.

Regra de negócio que só existe na tela **não existe**. Se ela importa, ela também está no banco.

### Erro barra, aviso não

Semântica fixa em todo o hub:

| | Quando | Comportamento |
|---|---|---|
| **Erro** | A situação é **impossível** | Bloqueia o salvamento |
| **Aviso** | A situação é **indesejável, mas às vezes necessária** | Deixa salvar, sinaliza na tela |

Exemplos reais: blocos de horário sobrepostos e mais de 8h/dia são **erro** (`horarios.model.js`);
mais de 6h contínuas e lacuna de cobertura são **aviso**. Confirmar viagem sem saldo de frota é
aviso — o admin pode, e às vezes precisa.

Antes de bloquear algo, pergunte se a SME pode legitimamente precisar fazer aquilo. Se puder, é aviso.

## Degradação por migration ausente

Migrations são aplicadas à mão, então existe uma janela entre o deploy do código e a execução do
SQL. **O módulo degrada, não quebra a tela:**

- tabela ausente → Postgres `42P01`
- coluna ausente → `42703`

Capturar esses códigos e seguir com estado vazio ou funcionalidade reduzida, avisando o usuário do
que falta. Ver `telefones.model.js`, `locais.model.js` e `afastamentos.model.js`.

## Cache no model

Vários models guardam `_cache` do resultado de leitura e o invalidam (`_cache = null`) em toda
escrita. Manter esse padrão: escreveu, invalidou. Cache que sobrevive a uma escrita mostra dado
velho logo depois de o usuário salvar.

## `upsert` em lote no PostgREST — duas armadilhas

1. **Todos os objetos do array precisam ter exatamente as mesmas chaves.** Chave `undefined` some
   do JSON e quebra o lote inteiro. Preencher com `null` explícito.
2. **`onConflict` não infere índice único parcial.** Usar índice único simples — no Postgres, NULLs
   já são distintos. Ver `020_afastamento_sync.sql`.

## Idempotência de importação

Toda importação/sincronização de fonte externa precisa de uma **chave de identidade estável**, com
índice UNIQUE, para que reimportar **atualize** em vez de duplicar. Ver `afastamento.chave_externa`
(`tipo|nome|início|criado_em`, a mesma identidade que o Apps Script usa).

Ao mapear vocabulário de fonte externa, o vocabulário do FundHub precisa ser **superconjunto** do
da origem — senão a sincronização perde registros em silêncio. Registro que não casa é **ignorado
e listado no relatório**, nunca criado órfão.
