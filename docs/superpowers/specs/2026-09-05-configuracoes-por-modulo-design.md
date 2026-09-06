# FundHub - Configurações por módulo

> Decisões tomadas em 05/09/2026. Bloco A da rodada de melhorias - a **fundação**
> de que dependem os blocos E (Dashboard), F (Escolas) e G (Horários).
> Entrega prevista como MINOR (módulo novo + mudança de modelo).
>
> Compartilha com o Bloco B (`2026-09-05-ajuda-por-modulo-design.md`) a **barra
> de ações do módulo** (D8). Quem for implementado primeiro cria a barra; o
> outro só acrescenta um botão nela.

## 1. O problema

O FundHub tem 17 módulos e nenhum lugar onde alguém possa dizer *como quer que
o sistema se comporte*. Três consequências concretas:

1. **Decisão de produto virou constante no código.** A janela de cobertura das
   escolas (7h00–18h20) está escrita em `horarios.model.js`. Ela vale para CEI,
   EMEF e Conveniada igualmente, o que não é verdade, e mudá-la exige um deploy.
2. **Configuração institucional virou botão perdido numa tela.** Quais cargos
   compõem a equipe gestora é uma decisão da Gerência que vale para a rede
   inteira - e mora hoje atrás de um botão na barra do módulo Horários, ao lado
   de duas abas de consulta, como se fosse mais uma visão.
3. **Preferência pessoal não existe.** Quem usa Escolas num monitor de 27" e
   quem usa num notebook veem a mesma grade; quem nunca olha o painel de
   Ocorrências no Dashboard olha para ele todo dia mesmo assim.

## 2. Escopo

Um mecanismo em que **cada módulo declara as suas configurações**, o kernel
guarda e devolve os valores, e duas superfícies as apresentam:

- a **engrenagem** na barra de ações do módulo, que abre as configurações
  daquele módulo, ali mesmo;
- o **módulo Configurações** (`#/configuracoes`), que reúne as de todos os
  módulos que a pessoa pode configurar.

Nesta rodada nascem as configurações de **Dashboard, Escolas, Servidores e
Horários** (§ D11). Os demais módulos ganham a engrenagem quando tiverem o que
configurar - módulo sem declaração não exibe o botão.

**Fora do escopo:** configuração por escola, por papel ou por segmento; perfis
de configuração exportáveis; histórico de mudança de preferência pessoal.

## 3. Decisões

### D1 - Duas naturezas, e essa é a decisão central

Toda configuração deste hub é uma de duas coisas, e confundi-las seria o erro
caro:

| | **Escopo `usuario`** | **Escopo `rede`** |
|---|---|---|
| O que é | como *eu* quero ver | como a *Gerência* decidiu que é |
| Exemplos | ordem dos cards, cards por linha, exibir telefones | quais cargos são equipe gestora, janela de cobertura, dia do TDC |
| Vale para | só quem escolheu | todo mundo |
| Quem pode | qualquer um que **enxergue** o módulo | quem tem **escrita** no módulo |
| Onde é gravada | `preferencia_usuario` | `config_modulo` |
| Some no logout? | não - é do e-mail, não do navegador | não |

A regra de permissão de D1 é o refinamento pedido ao item 9 do pedido original.
"Só quem tem permissão de edição acessa as configurações" está certo para o
escopo `rede` e seria errado para o `usuario`: um gestor com nível `leitura` no
Dashboard não deve poder mudar a janela de cobertura da rede, mas **precisa**
poder esconder um painel que não usa. A permissão do módulo governa o que é
institucional; a tela de cada um é de cada um.

### D2 - Duas tabelas, e por que não uma coluna em `perfil`

Migration **026**.

```sql
-- Institucional: vale para a rede.
create table if not exists config_modulo (
  modulo          text not null,
  chave           text not null,
  valor           jsonb not null,
  atualizado_por  text,
  atualizado_em   timestamptz not null default now(),
  primary key (modulo, chave)
);
alter table config_modulo enable row level security;

create policy config_modulo_sel on config_modulo for select using (is_autorizado());
create policy config_modulo_ins on config_modulo for insert with check (pode_escrever(modulo));
create policy config_modulo_upd on config_modulo for update using (pode_escrever(modulo))
                                                    with check (pode_escrever(modulo));
create policy config_modulo_del on config_modulo for delete using (pode_escrever(modulo));
grant select, insert, update, delete on config_modulo to authenticated;
```

A policy é a parte elegante: `pode_escrever(modulo)` lê a **coluna da própria
linha**. A permissão de uma configuração é, literalmente, a permissão do módulo
dela - nenhum vocabulário novo de autorização, nenhuma tabela de quem-pode-o-quê
paralela. Quem ganhar escrita em Horários amanhã ganha junto o direito de mudar
a janela de cobertura, sem que ninguém precise lembrar de nada.

```sql
-- Pessoal: vale para uma pessoa.
create table if not exists preferencia_usuario (
  email          text not null,
  modulo         text not null,
  chave          text not null,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  primary key (email, modulo, chave)
);
alter table preferencia_usuario enable row level security;

create policy pref_sel on preferencia_usuario for select using (email = auth_email());
create policy pref_ins on preferencia_usuario for insert with check (email = auth_email());
create policy pref_upd on preferencia_usuario for update using (email = auth_email())
                                                 with check (email = auth_email());
create policy pref_del on preferencia_usuario for delete using (email = auth_email());
grant select, insert, update, delete on preferencia_usuario to authenticated;
```

**Por que não uma coluna `preferencias jsonb` em `perfil`:** porque
`perfil_upd` é `is_admin()` (migration 021). Um usuário comum não pode escrever
na própria linha de `perfil` - e afrouxar essa policy para deixar passar
preferência abriria a porta para ele escrever também no que não é dele. A
tabela separada mantém `perfil` sob a regra que ela precisa ter.

**Por que `email` e não `perfil_id`:** é a identidade que o hub já usa em
`criado_por`, `atualizado_por` e nas policies (`auth_email()`), e sobrevive a
uma linha de `perfil` recriada.

**Auditoria (`019`):** `config_modulo` entra no array - é decisão institucional
e precisa de rastro. `preferencia_usuario` **não entra**, deliberadamente:
auditar que alguém escondeu um painel do próprio dashboard só produziria ruído
num log que existe para outra coisa.

**Sem migration 026 o hub funciona.** `42P01` em qualquer das duas leituras
devolve mapa vazio, e todo consumidor cai no padrão declarado. É a mesma
degradação de `telefones` e `locais`.

### D3 - Quem lê é o kernel, e a leitura é síncrona

`core/configuracoes.js`, por analogia direta com `core/permissoes.js`: um mapa
carregado uma vez no boot, consultado por todo mundo, sem tela própria. É
exatamente a definição de `core/` ("o que tem estado ou ciclo de vida do app").

```js
carregarConfiguracoes()          // no boot, junto do perfil (2 queries)
conf(modulo, chave)              // síncrono → valor de rede ou undefined
pref(modulo, chave)              // síncrono → preferência do usuário ou undefined
definirConf(modulo, chave, v)    // grava rede    (RLS confirma)
definirPref(modulo, chave, v)    // grava pessoal (RLS confirma)
limparConfiguracoes()            // logout
```

**Síncrono é requisito, não conveniência.** As views montam HTML em template
literal de uma vez só; um `await` no meio de `cardHtml()` obrigaria a
reescrever a montagem de toda tela que consulta configuração. Carregar no boot
custa duas consultas e resolve isso de vez - é o que `permissoes.js` já faz com
o mapa de níveis.

Duas funções (`conf`/`pref`) e não uma: no ponto de uso fica visível se aquilo
é decisão da rede ou escolha da pessoa, e portanto o que o RLS vai cobrar.

### D4 - Quem declara é o módulo, alcançado pelo manifesto

O manifesto ganha um campo opcional, no mesmo formato de `load()`:

```js
export default {
  id: 'escolas',
  // …
  load:   () => import('./escolas.view.js'),
  config: () => import('./escolas.config.js'),   // ← novo, opcional
};
```

Import **dinâmico**, e não um array dentro do manifesto, por dois motivos: os
manifestos são carregados estaticamente por `registry.js` no boot e precisam
continuar minúsculos; e a declaração só é necessária quando alguém abre uma
tela de configuração. Módulo sem `config` simplesmente não tem engrenagem.

Isso preserva a R1 intacta: o kernel continua conhecendo **manifestos**, nunca
implementações - e a declaração entra pela mesma porta que a view já usa.

### D5 - O padrão mora na declaração; a view lê pelo arquivo do módulo

`modules/escolas/escolas.config.js`:

```js
import { pref } from '../../core/configuracoes.js';

export const DECLARACAO = {
  grupos: ['exibicao'],
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefones no card',
      dica: 'Mostra o telefone principal da escola na lista.', padrao: false },
    { chave: 'servidores_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir quantidade de servidores',
      dica: 'Conta quem tem vínculo aberto na unidade.', padrao: false },
    { chave: 'cards_por_linha', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'numero', rotulo: 'Cards por linha (desktop)',
      min: 1, max: 6, padrao: 3 },
  ],
};

// Os acessos que a view usa. O padrão é escrito UMA vez, aqui.
export const mostrarTelefones  = () => pref('escolas', 'telefones_no_card')  ?? false;
export const mostrarServidores = () => pref('escolas', 'servidores_no_card') ?? false;
export const cardsPorLinha     = () => pref('escolas', 'cards_por_linha')    ?? 3;
```

O arquivo é privado do módulo (R2): `escolas.view.js` o importa como importa
qualquer arquivo da própria pasta; quem está de fora só o alcança pelo
`config()` do manifesto. E o valor padrão existe **em um lugar só** - o erro
clássico desse tipo de sistema é o padrão escrito na declaração e repetido em
cada `?? false` espalhado pelas views.

`<x>.config.js` **não** é `<x>.model.js`: não fala com o banco (quem fala é o
kernel) e não é API pública do módulo. É declaração + acessos.

### D6 - Dois tipos de item: campo e painel

A maioria das configurações é um campo simples, e para essas o renderizador é
genérico:

| `tipo` | Vira | Usado por |
|---|---|---|
| `switch` | `.switch` (o toggle do hub) | exibir telefones, exibir contagem |
| `numero` | `<input type="number">` | cards por linha |
| `opcao` | `<select>` | dia da semana de uma escala |

Três tipos, e só nascem mais quando houver caso concreto (R13).

Mas algumas configurações são **tela**, não campo: a lista de cargos que
compõem a equipe gestora, as cinco janelas de cobertura por tipo de escola, a
ordem dos painéis do Dashboard. Para essas, a declaração aponta uma função que
o próprio módulo fornece:

```js
{ chave: 'cargos_gestao', escopo: 'rede', grupo: 'regras',
  rotulo: 'Equipe gestora',
  dica: 'Quais cargos entram na grade e na cobertura por padrão.',
  painel: (box, ctx) => pintarCargosGestao(box, ctx) }
```

Isso é o que permite **reaproveitar em vez de reescrever**: a tela de cargos já
existe (`horarios/views/cargos.js`) e passa a ser desenhada dentro do painel de
configurações, sem virar outra coisa.

### D7 - Categorias semânticas, vocabulário fechado

Cada item declara um `grupo`, e o vocabulário vive em `core/configuracoes.js`
como `GRUPOS` vive em `registry.js`:

| id | Rótulo | O que cai aqui |
|---|---|---|
| `exibicao` | Exibição | o que aparece na tela, em que ordem, quantos por linha |
| `regras` | Regras e limites | o que o sistema valida, bloqueia ou avisa |
| `calendario` | Calendário e escalas | dias, escalas, janelas de horário |
| `notificacoes` | Notificações | o que avisa, quando |

Renderizados como `<fieldset>` + `<legend>`, com o tratamento de legenda de
bloco que o hub já tem (`--form-legend`). Grupo sem item não aparece.

### D8 - A barra de ações do módulo: quem desenha é o roteador

Pedido: "um SVG de configuração alinhado no topo direito, dentro da div
container do módulo" - e, no Bloco B, um segundo botão ao lado dele.

Isso **não** é feito view a view. Seriam 17 arquivos alterados para um elemento
idêntico em todos, e o 18º módulo nasceria sem ele. É o mesmo raciocínio que
manteve o menu e o topo na moldura.

O roteador passa a montar uma estrutura estável dentro do outlet e a entregar à
view só a parte de baixo:

```js
outlet.innerHTML = `<div class="mod-acoes" id="mod-acoes"></div><div id="mod-view"></div>`;
// … monta os botões conforme o manifesto (config? doc?) e a permissão …
await view.render(document.getElementById('mod-view'), ctx);
```

Nenhuma view muda: cada uma continua recebendo um elemento e escrevendo o seu
`innerHTML` nele. A barra é irmã, não mãe.

Posicionamento: `.mod-acoes` é `position: absolute; top: 0; right: 0` sobre um
container `position: relative`, e o `.page-head` ganha reserva à direita
(`padding-right`) quando há barra. Assim os botões ficam na altura do `<h1>`,
que é o "topo direito" pedido, sem depender de o que a view desenha primeiro.
Em tela estreita a reserva cai e os botões continuam com alvo de 40px
(`--toque`).

A barra só aparece se houver botão: módulo sem `config` e sem `doc` não ganha
container vazio.

### D9 - O módulo Configurações

Agregador puro (como `dashboard` e `viagens`): tela, sem model, sem dados
próprios. Lê `registry.js`, importa a declaração de cada módulo via
`m.config()` e usa o **mesmo renderizador** que a engrenagem usa.

```js
// modules/configuracoes/module.js
export default {
  id: 'configuracoes', ico: 'config', nome: 'Configurações',
  desc: 'Como cada módulo se comporta para você e para a rede.',
  navNome: 'Configurações', rota: '#/configuracoes',
  grupo: 'conta', nav: true, ativo: true,
  load: () => import('./configuracoes.view.js'),
};
```

Grupo `conta`, ao lado de "Meus dados": é onde a pessoa vai procurar por
"ajustes", e a maior parte do que ela vai encontrar lá é dela mesma.

A tela lista um bloco por módulo (na ordem do registro), com o ícone e o nome
do módulo, e dentro dele os grupos semânticos. Módulo cujos itens a pessoa não
pode ver nem mexer **não aparece** - inclusive o cabeçalho, pela mesma razão
que o roteador não confirma a existência de módulo oculto.

Como `meus-dados` e `modulos`, `configuracoes` precisa entrar no mapa de
permissões da migration (`escrita` para todos os papéis) - `nivel()` devolve
`oculto` para módulo desconhecido, e a política segura por omissão é esconder.
O que cada pessoa vê **dentro** dele é o que D10 decide, não esse nível.

### D10 - Um item aparece quando?

| Escopo do item | Aparece se | Editável se |
|---|---|---|
| `usuario` | `nivel(modulo) !== oculto` | sempre que aparece |
| `rede` | `nivel(modulo) !== oculto` | `podeEscrever(modulo)` |

Configuração de rede que a pessoa não pode mudar aparece **desabilitada, com o
valor atual visível**. Esconder faria a tela mentir sobre por que o sistema se
comporta como se comporta - e o valor não é segredo: ele já é observável no
comportamento da tela. Quem decide de verdade continua sendo o RLS.

### D11 - O que nasce nesta rodada

Configurações que respondem a um pedido concreto e que alguma tela de fato
honra. Nada declarado "para quando precisar" (R13).

| Módulo | Chave | Escopo | Grupo | Padrão |
|---|---|---|---|---|
| **dashboard** | `ordem_paineis` | usuario | exibicao | ordem natural |
| | `paineis_ocultos` | usuario | exibicao | `[]` |
| **escolas** | `telefones_no_card` | usuario | exibicao | desligado |
| | `servidores_no_card` | usuario | exibicao | desligado |
| | `cards_por_linha` | usuario | exibicao | 3 |
| **servidores** | `telefones_no_card` | usuario | exibicao | desligado |
| | `cards_por_linha` | usuario | exibicao | 3 |
| **horarios** | `cargos_gestao` (painel) | rede | regras | - |
| | `cobertura_por_tipo` (painel) | rede | calendario | 07:00–18:20 |
| | `dia_semana_escala` (painel) | rede | calendario | sem dia fixo |

Dois desses painéis **não gravam em `config_modulo`**: `cargos_gestao` escreve
na tabela `cargo_gestao` e `dia_semana_escala`, em `escala_tipo` - as duas já
existem e já são o dono daquele dado. O painel é a superfície; onde o valor mora
é decisão de quem já é dono dele. Só `cobertura_por_tipo`, que não tem tabela
própria nem mereceria uma, guarda um objeto em `config_modulo`.

As três de Horários são detalhadas na spec do Bloco G; as de Dashboard e
Escolas, nas specs dos Blocos E e F. Esta spec entrega o **mecanismo** e as de
Escolas/Servidores como primeira prova real de que ele funciona.

**Candidatas descartadas nesta rodada**, para não inventar demanda: cores por
tipo de afastamento (é token, não configuração - R9), limites da jornada
(8h/dia e 6h contínuas: são regra legal, não preferência; viram configuração no
dia em que a lei mudar), antecedência de alerta em SATE, formato de exportação.

## 4. Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/026_configuracoes.sql` | criar - duas tabelas, policies, `config_modulo` na auditoria da 019, `configuracoes` no mapa de permissões |
| `src/core/configuracoes.js` | criar - carga no boot, `conf`/`pref`, `definirConf`/`definirPref`, `GRUPOS` |
| `src/core/router.js` | montar `.mod-acoes` + `#mod-view`; entregar `#mod-view` à view |
| `src/core/registry.js` | registrar o módulo `configuracoes` |
| `src/main.js` | `carregarConfiguracoes()` no boot; `limparConfiguracoes()` no logout |
| `src/shared/ui/icones.js` | traçado `config` (engrenagem) |
| `src/modules/configuracoes/module.js` | criar - manifesto |
| `src/modules/configuracoes/configuracoes.view.js` | criar - tela agregadora |
| `src/modules/configuracoes/painel.js` | criar - renderizador compartilhado (tela + gaveta da engrenagem) |
| `src/modules/configuracoes/configuracoes.css` | criar (+ `@import` em `styles/main.css`) |
| `src/modules/{escolas,servidores}/escolas.config.js` etc. | criar - declaração + acessos |
| `src/modules/{escolas,servidores}/module.js` | campo `config` |
| `src/styles/components.css` | `.mod-acoes`, reserva no `.page-head` |

`painel.js` mora no módulo Configurações e é importado pelo roteador para a
gaveta da engrenagem. Como o roteador é kernel, esse import inverteria a R1 -
por isso ele entra por `import()` dinâmico no clique, exatamente como as views:
o kernel dispara, o módulo responde.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Virar um sistema de plugins com vida própria | três tipos de campo (D6), vocabulário fechado de grupos (D7), catálogo enxuto (D11) |
| Configuração de rede mudar o comportamento sem ninguém saber por quê | `config_modulo` é auditada; a tela mostra quem mudou e quando |
| Preferência pessoal virar caminho para burlar permissão | escopo `rede` é sempre `pode_escrever` no banco; a tela é conforto |
| Leitura síncrona devolver vazio antes do boot terminar | `carregarConfiguracoes()` é aguardado antes de `startRouter` |
| Barra de ações colidir com o conteúdo de alguma view | posicionamento absoluto + reserva no `.page-head`; conferir nas 17 telas |
| Migration 026 não rodar em produção | `42P01` → mapas vazios → todo mundo no padrão |

## 6. Critérios de aceite

1. Um módulo que declara `config` exibe a engrenagem no topo direito do
   container; um que não declara, não exibe.
2. A engrenagem abre as configurações **daquele** módulo; `#/configuracoes`
   mostra as de todos os módulos que a pessoa pode configurar.
3. Mudar uma preferência pessoal reflete na tela e sobrevive ao logout e à
   troca de navegador.
4. Uma configuração de rede alterada por um admin vale para outra pessoa no
   próximo carregamento.
5. Quem tem `leitura` num módulo vê as configurações de rede dele
   **desabilitadas** e continua podendo mudar as pessoais.
6. Uma tentativa de gravar configuração de rede sem `escrita` é recusada pelo
   banco (testar pelo console, não só pela tela).
7. Com a migration 026 ausente, todas as telas abrem normalmente nos padrões.
8. `config_modulo` aparece no `audit_log` ao ser alterada; `preferencia_usuario`, não.
9. Nenhuma view existente precisou ser alterada para ganhar a barra de ações.
10. Legível em 375px, nos dois temas.
11. `python .claude/scripts/verificar_arquitetura.py` sem violações.

## Nota de implementação (05/09/2026)

O Bloco A entregou o mecanismo + o módulo Configurações + a prova real
`telefones_no_card` (Escolas e Servidores). `cards_por_linha`,
`servidores_no_card` e os painéis de Horários/Dashboard entram nas specs
E/F/G - cada uma acrescenta ao `<x>.config.js` o item que ela consome, em
vez de o Bloco A declarar tudo antecipadamente (R13).

Duas exceções nomeadas nasceram aqui: o roteador importa
`modules/configuracoes/painel.js` por `import()` **dinâmico** no clique da
engrenagem (registrada em `.claude/rules/arquitetura.md` e no verificador);
e `shared/ui/drawer.js` ganhou `garantirDrawer()` para a gaveta abrir sem
depender do markup que a view montou.
