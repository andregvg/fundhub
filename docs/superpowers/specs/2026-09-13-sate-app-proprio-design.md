# FundHub - SATE com página própria

> 13/09/2026. **Bloco S1.** Entrega como MINOR, sem migration.
>
> Herda as decisões de 08/09/2026 registradas em
> `2026-09-08-listas-e-modais-design.md` (decisões herdadas): `sate.html` no mesmo
> repositório, casca própria reusando o kernel, e o item do FundHub virando
> link externo.

## D1 - Duas entradas, um sistema

```
index.html → src/main.js ─┐
                          ├→ shell/portao.js → core (auth, perfil, config) → mesmo banco
sate.html  → src/sate.js ─┘
```

A mesma conta, a mesma sessão (mesma origem) e as mesmas permissões. O que
muda é a moldura: marca, menu e cor. `sate.js` é **entrada**, como
`main.js`, e por isso pode importar de qualquer lugar (R1).

## D2 - O portão sai de main.js, antes da regra de três

A lógica que decide quem entra (domínio institucional, allowlist, acesso
pendente, retorno do magic link/OAuth) foi para `shell/portao.js`. É o
**segundo** caso, e a R13 pediria esperar o terceiro. Não aqui: duas cópias
de um portão divergem com o tempo, e portão divergente é buraco de
segurança. O que difere entre as entradas entra por parâmetro: marca do
login, nome na tela de pendência, opções da moldura, o que montar ao entrar.

O redirecionamento do login usa `location.pathname`: quem entra pelo
`sate.html` volta ao `sate.html`. **O endereço precisa estar na lista de
Redirect URLs do Supabase** (Authentication → URL Configuration); se não
estiver, o Supabase devolve à Site URL e a pessoa cai no FundHub - funciona,
só não volta para onde estava.

## D3 - O kernel ganha parâmetros, não cópias

| Onde | Parâmetro | Padrão (FundHub) |
|---|---|---|
| `chrome.montarNav(grupos)` | itens do menu | o registro de módulos |
| item de menu `externo` | abre outra página em nova aba | - |
| `chrome.setChrome(…, { base, aoAtualizar })` | "Meus dados" e o botão Atualizar | `''` e o roteador |
| `auth.renderLogin(app, { marca })` | ícone, título, texto | FundHub |
| `pendente.renderAcessoPendente(…, { sistema })` | nome do sistema | FundHub |

`montarNav` passou a ligar os ouvintes do menu **uma vez só**: chamado de
novo a cada login (sair e entrar sem recarregar), empilhava ouvintes e o
botão do menu abria e fechava no mesmo clique. Defeito antigo, que a
segunda entrada tornaria mais provável.

## D4 - Um roteador de cinco rotas, sem generalizar o do FundHub

`core/router.js` conhece o registro de módulos, a barra de ações, fichas
entre módulos e eventos de acesso negado. O SATE tem cinco páginas e uma de
configurações. `sate.js` roteia por `hashchange` sobre `PAGINAS`
(declaradas em `sate.view.js`); página de aprovador pedida por quem não
aprova volta à inicial, e o RLS continua barrando o dado (R6).

**Configurações vira página** do menu, desenhada por
`pintarConfigDoModulo` - o mesmo que a tela agregadora do FundHub usa.
**Ajuda** abre o tutorial no FundHub (`./#/ajuda?m=sate`): um texto só.

## D5 - No FundHub, o SATE é link

O manifesto declara `externo: 'sate.html'`. Menu e tile abrem em nova aba;
`#/sate` (favorito antigo) redireciona. `rota` continua existindo para a
ajuda e para esse redirecionamento.

## D6 - Cor e marca

- `--brand` é trocado no `<body class="app-sate" data-cor="…">` por um de
  quatro tokens (`--sate-verde` padrão, `--sate-azul`, `--sate-petroleo`,
  `--sate-vinho`), com variante clara e escura. Só o destaque muda (R14).
- `--info-bg` é redeclarado ali: derivado de `--brand` no `:root`, ele
  continuaria azul.
- A cor é configuração de rede (`sate.config.js`, item `cor`), reaplicada
  a cada troca de página - quem volta das Configurações já vê a nova.
- Ícones **ônibus** e **cadeirante** vieram do agendamentos-fil. O ônibus é
  silhueta preenchida numa grade própria, e `icones.js` passou a aceitar
  ícones com grade própria (`PROPRIOS`) em vez de redesenhá-lo no traço do
  Feather.

## Fora deste bloco

Admin ver o SATE como uma escola específica; ponto de embarque que não é
escola; notificações (sino) dentro do SATE.
