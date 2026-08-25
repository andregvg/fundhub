---
name: architecture-review
description: Revisão arquitetural do FundHub — coesão, acoplamento, fronteiras de módulo, tamanho de arquivo e overengineering. Use ao revisar código antes de commitar, ao refatorar, ao avaliar se um módulo/abstração nova se justifica, ou quando o usuário pedir revisão de arquitetura, estrutura ou organização do código.
---

# Revisão arquitetural do FundHub

Esta skill **conduz uma revisão**; ela não repete as regras. As regras estão em
`CLAUDE.md` e `.claude/rules/`, e o porquê de cada uma em
`docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

Princípio: **o script decide o que é objetivo; você decide o que exige julgamento.**
Não gaste análise em nada que o script já verifica.

## 1. Rode o script primeiro — sempre

```bash
python .claude/scripts/verificar_arquitetura.py
```

Só depois analise. Se o script apontar bloqueios, eles entram no relatório como estão — não
re-verifique manualmente o que ele já verificou, e não os discuta: são objetivos.

**Escopo da revisão:** por padrão, só o que mudou (`git diff`, `git diff --cached` ou os arquivos
que você acabou de editar). Revisão do repositório inteiro só quando pedida explicitamente —
caso contrário o relatório vira uma lista de dívida antiga que ninguém vai ler.

## 2. Analise o que o script não alcança

Nesta ordem. Para cada item, a pergunta é concreta — não procure problema onde não há.

### Coesão — o módulo concentra o que é dele?

- Há regra de domínio na **view** que deveria estar no model? (cálculo, validação, decisão de
  negócio, parsing de formato externo)
- Há apresentação no **model**? (rótulo, ícone, cor, texto de interface)
- O módulo faz duas coisas que não têm relação entre si?

> Sinal forte: `afastamentos.view.js` tem parsing de TSV, mapeamento de vocabulário e regra de
> idempotência — isso é domínio, e domínio mora no model.

### Acoplamento — o import novo se justifica?

Para cada import cross-módulo introduzido:

- É `*.model.js`? (se não, o script já bloqueou)
- Quem é o **dono** daquele dado? Se o módulo A precisa escrever no domínio de B, o dado
  provavelmente está no módulo errado — ou A deveria só ler.
- O import fecha um ciclo em potencial? (script cobre o ciclo real; você cobre o risco)
- O módulo virou dependência de quase todo mundo? Isso é aceitável para **cadastro base**
  (`escolas`, `servidores`) e suspeito para qualquer outra coisa.

### Tamanho e divisão

O script avisa quando passa do limite. **Você decide o eixo da divisão:**

- Dividir por **superfície de UI** (aba, visão alternada) → `views/<aba>.js`.
- **Nunca** dividir por tipo técnico (`utils.js`, `helpers.js`, `handlers.js`): isso espalha uma
  responsabilidade em vez de separar responsabilidades.
- Se não há eixo natural de divisão, o arquivo talvez esteja grande porque faz coisas demais —
  o problema é a responsabilidade, não o tamanho.

Cheque também o lado oposto: arquivo abaixo de ~60 linhas que não é manifesto e não é importado
por 2+ arquivos deveria ter ficado onde estava.

### Overengineering

- A abstração nova tem **três** usos concretos já existentes? (regra de três)
- Ela existe para "quando formos precisar"? → remover.
- Nome terminando em `Manager`, `Handler`, `Factory`, `Provider`, `Base`? → quase sempre sinal.
- Está generalizando dois casos que só se parecem por coincidência? → duplicação é mais barata
  que a abstração errada.
- Entrou dependência, build step ou npm? → viola R10, é bloqueante.

### Segurança (só se a mudança tocar em banco, auth ou dado)

- Tabela nova tem RLS, policy de select, policy de escrita, grant e trigger de auditoria?
- Alguma policy concede algo a `anon`? → bloqueante.
- Valor do banco interpolado sem `esc()`? → bloqueante. Inclusive em atributo HTML.
- Regra de negócio que só existe na tela? → não existe; precisa estar no banco.
- Migration idempotente? Módulo degrada se ela ainda não rodou (`42P01`/`42703`)?

### Consistência de UI (só se a mudança tocar em tela)

- Reusou o vocabulário de `components.css` ou inventou classe equivalente?
- Componente novo em `shared/ui/` tem comportamento, ou é só markup? (só markup → CSS)
- Testável em tela estreita? Botão só-ícone tem `aria-label`?

## 3. Relatório

Agrupe por severidade e seja específico: arquivo, linha, e o que fazer.

| Severidade | O que entra |
|---|---|
| **Bloqueia** | Violação de regra obrigatória (R1–R10). Inclui tudo que o script marcou BLOQUEIA. |
| **Ajustar** | Violação de recomendada (R11–R16) na mudança atual, ou coesão/acoplamento discutível. |
| **Observação** | Dívida pré-existente que a mudança encostou. Não é motivo para segurar o commit. |

Regras:

- **Não invente achado.** Se a mudança está boa, diga que está boa. Uma revisão que sempre acha
  algo vira ruído e para de ser lida.
- **Não proponha refatoração fora do escopo da mudança.** Dívida antiga é observação, não tarefa.
- **Não conserte sozinho** enquanto revisa. Reporte; a correção é uma decisão à parte.
- Sempre cite a regra (`R7`) e o arquivo (`src/...:linha`).

## 4. Dívida conhecida — não reportar como novidade

Já mapeada em §6.1 do spec; mencione só se a mudança atual encostar nela:

- `afastamentos.view.js` (575 linhas) e `servidores.view.js` (429) acima do limite;
- `toISOString()` espalhado para carimbar timestamp — destino é um `agoraISO()` em `format.js`;
- `confirm()`/`alert()` nativos ainda em uso;
- cores literais em `afastamentos.model.js`, `sate/views/catalogo.js` e em alguns CSS de módulo;
- `docs.content.js` e `BLUEPRINT.md` §4 defasados quanto a papéis e nº de módulos;
- `PAPEL_ROTULO.gestor_escolar` em `chrome.js` é papel inexistente.
