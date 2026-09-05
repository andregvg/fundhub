# Arquitetura - criar, dividir e mover código

Regras R1–R4, R11 e R13. Contexto e justificativa em
`docs/superpowers/specs/2026-08-25-arquitetura-fundhub-design.md`.

## O padrão: MVC adaptado, e nada além disso

`*.model.js` = Model · `*.view.js` = View · `core/router.js` = Controller (único para o app todo).

**Não adotar** Clean Architecture, DDD, repositories, services, controllers por módulo, casos de uso
ou containers de injeção. Nenhum resolve um problema concreto do FundHub; todos aumentariam a
distância entre a intenção e o código. Se surgir um problema que pareça pedir uma camada nova,
descreva o problema antes de propor a camada.

**O Model é dono do domínio**, não uma "camada de acesso a dados". Regra de negócio mora nele:
`horarios.model.js` valida jornada, `afastamentos.model.js` calcula dias, `sate.model.js` calcula
ônibus. Não extrair essas regras para fora do model "para limpar" - é onde elas devem estar.

## R1 - Direção de dependências

`core/` e `shared/` são **uma camada** (o kernel), separadas por conteúdo e não por hierarquia:

- `core/` - o que tem **estado ou ciclo de vida do app**: config, cliente Supabase, sessão, perfil,
  mapa de permissões, roteamento, vocabulário que o kernel precisa conhecer.
- `shared/` - o que é **sem estado** (helpers puros) ou **widget reusável** (drawer, toast, phones).

Eles podem importar um ao outro (`router.js` → `feedback.js`; `realtime.js` → `supabase.js`).
A regra que vale:

```
kernel (core + shared)  →  só kernel
shell/                  →  kernel
modules/<x>/            →  kernel + *.model.js de outros módulos
main.js                 →  tudo
```

**O kernel nunca importa `modules/` nem `shell/`.**

## R2 - Só `*.model.js` atravessa a fronteira do módulo

Tudo o mais na pasta do módulo é privado: `*.view.js`, `views/`, `*.css`, helpers internos.

Um módulo pode ser dono de mais de um agregado e ter mais de um model
(`sate/sate.model.js` + `sate/atividades.model.js`) - ambos são públicos.

**Se você quiser importar a view de outro módulo**, o que você quer provavelmente é:
(a) mover aquilo para `shared/ui/`, ou (b) o dado está no módulo errado. Nunca é (c) importar a view.

## R3 - Model e View não se misturam

- Model: **nunca** `document`, `innerHTML`, `querySelector`, `addEventListener`.
- View: **nunca** `sb()` nem import de `core/supabase.js`. Todo acesso a dado passa pelo model.
- View recebe `ctx.perfil` do roteador - **não** chamar `getPerfilAtual()` de novo.

## R4 - Zero ciclos

O grafo de imports é hoje uma árvore e deve continuar assim. Antes de criar um import
model→model novo, pergunte se ele fecha um ciclo. O script verifica.

Se A e B precisam um do outro, uma das três coisas é verdade:
1. o dado compartilhado pertence a um terceiro módulo (extraia-o - foi o caso de `telefones`);
2. um dos dois é na verdade um agregador (deve só ler, nunca ser lido);
3. a fronteira entre eles está no lugar errado.

## R11 - Quando dividir um arquivo

**Dividir quando qualquer um for verdade:**

| Gatilho | Limite |
|---|---|
| View grande demais | > **400 linhas** |
| Model grande demais | > **250 linhas** |
| Serve 2+ superfícies navegáveis | abas, visões alternadas |

**Como dividir:** por **superfície de UI**, em `views/<aba>.js` dentro da própria pasta do módulo.
A casca (`<modulo>.view.js`) carrega o que as abas compartilham e delega. Ver `sate/` como
referência: casca de 78 linhas + 5 abas de 60 a 200.

**Nunca dividir** por tipo técnico (`utils.js`, `helpers.js`, `handlers.js`) - isso espalha uma
responsabilidade por vários arquivos em vez de separar responsabilidades.

**Piso anti-fragmentação:** não criar arquivo com menos de ~60 linhas, salvo manifesto ou coisa
importada por 2+ arquivos. Um módulo de 80 linhas continua em um arquivo só.

**Isentos do limite:** arquivos de conteúdo (`*.content.js`) - são dados, não código.

## R13 - Regra de três

Pasta, camada, wrapper, utilitário ou abstração nascem no **terceiro** caso concreto **já existente
no repositório** - não no primeiro, não no "vamos precisar depois".

Sinais de que você está prestes a fazer overengineering:
- o nome do arquivo termina em `Manager`, `Handler`, `Factory`, `Provider` ou `Base`;
- a abstração tem exatamente um uso;
- ela existe para "facilitar quando formos precisar";
- você está generalizando dois casos que só se parecem por coincidência.

Duplicação é mais barata que a abstração errada. Duas cópias parecidas podem esperar a terceira.

## Exceções nomeadas

Estas são as únicas. Qualquer outra precisa de justificativa em comentário no código.

| Exceção | Por quê |
|---|---|
| `core/registry.js` importa os `module.js` | Ponto de inversão: o kernel conhece **manifestos**, não implementações. As views entram por `import()` dinâmico. |
| `core/router.js` importa `modules/configuracoes/painel.js` por `import()` **dinâmico** | A engrenagem da barra de ações abre o painel de configuração no clique. O kernel dispara, o módulo responde - mesma inversão de `mod.load()`. Só dinâmico, só esse alvo. Spec `2026-09-05-configuracoes-por-modulo`, D8. |
| `core/segmentos.js` tem vocabulário de domínio | Aceito só porque quase todo módulo filtra por segmento e todos precisam concordar sobre o significado. Espelha `unidade_segmentos()` no Postgres - mudou aqui, mude lá. Não é licença para mover domínio ao kernel. |
| `dashboard` / `viagens` importam muitos models | Legítimo: são **leitores puros sem dados próprios**, acoplamento unidirecional, módulo descartável. Vira problema se o agregador começar a escrever. |
| `shared/ui/filtro-segmento.js` conhece segmentos | O domínio vem de `core/segmentos.js`, que já é kernel. **Não é controle de acesso** - quem restringe é o RLS; o filtro é conveniência e pode ser desmarcado. |
| `telefones` e `locais` não têm manifesto | Domínio possuído mas renderizado por outro módulo. Se ganharem tela, ganham manifesto. |
