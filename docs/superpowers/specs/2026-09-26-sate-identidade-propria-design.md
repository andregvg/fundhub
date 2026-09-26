# FundHub - SATE com identidade própria

> 26/09/2026. Entrega junto da 0.37.0. Sem migration.
>
> Revisa: `2026-09-13-sate-app-proprio-design.md` (a página própria já
> existe; aqui ela deixa de apontar para o FundHub).

## O problema

1. **"Como usar o SATE" leva ao FundHub.** O link do menu abre
   `./#/ajuda?m=sate` numa aba nova - quem usa só o SATE cai num sistema que
   não conhece.
2. **O SATE cita o FundHub** no título da aba, no rodapé, no texto do
   tutorial, no link "Ir para o FundHub" e no "Meus dados" do menu de
   usuário. Quem só usa o SATE não deve saber, por ora, que o FundHub existe.

## D1 - Um tutorial, dois lugares de leitura

O texto continua sendo **um arquivo só** (`docs/modulos/sate.md`) - o ponto
de verdade. Muda quem o lê:

| Onde | Como |
|---|---|
| FundHub | `#/ajuda?m=sate`, como hoje |
| SATE | rota nova `#/ajuda` do `sate.html`, desenhada por `src/sate.js` |

A página do SATE busca o mesmo `.md` e o passa pelo mesmo leitor
(`modules/ajuda/markdown.js`). `sate.js` é uma **entrada** (R1): pode
importar o leitor diretamente, sem criar exceção de fronteira.

O item "Como usar o SATE" deixa de ser `externo` e vira rota interna
(`#/ajuda`), marcada no menu como as outras páginas.

## D2 - O texto do tutorial fica neutro

Como o mesmo texto é lido nos dois sistemas, ele **não cita o FundHub**. A
seção "Onde fica o SATE" é reescrita sem mencioná-lo, e somem as frases
sobre "Ir para o FundHub" e "a conta é a mesma". O item de menu **Como usar
o SATE** passa a ser descrito como "abre este tutorial, dentro do SATE".

## D3 - Link para o FundHub só para quem usa o FundHub

`src/sate.js` calcula uma vez, no login:

```js
usaFundHub = MODULOS.some(m =>
  m.nav && m.rota && m.id !== 'sate' && !m.publico && veModulo(m));
```

"Usa o FundHub" = enxerga ao menos um módulo de navegação que não seja o
SATE nem um dos de serviço (`publico: true`). Hoje todo papel passa nesse
teste; o critério existe para quando um papel só-SATE surgir - bastará
tirar os outros módulos do papel.

| Elemento | `usaFundHub` | senão |
|---|---|---|
| "Ir para o FundHub" (menu lateral) | aparece | some |
| "Meus dados" (menu de usuário) | aparece (leva ao FundHub) | some |

**Não é controle de acesso** (R6): o FundHub continua barrando pelo mapa de
permissões quem não tem módulo. Isto só decide o que o SATE **menciona**.

`shell/chrome.js` ganha a opção `meusDados: boolean` em `setChrome` (padrão
`true`, o FundHub não muda). O portão (`shell/portao.js`) repassa as opções
de chrome que recebe; o SATE passa `meusDados: usaFundHub`.

## D4 - Moldura sem o nome do FundHub

- `sate.html`: `<title>SATE - Transporte extraclasse</title>`; rodapé
  `SATE · Gerência de Ensino Fundamental · SME Ribeirão Preto`.
- **Cartão de versão** do rodapé: no SATE mostra só a versão e a data. O
  resumo vem do CHANGELOG do FundHub e o link aponta para o repositório
  `fundhub` - os dois o nomeiam. `carimboRodape()` ganha a opção
  `{ completo: false }`; o FundHub segue com o cartão inteiro.
- Tela de acesso pendente e de login já recebem `sistema: 'SATE'` e a marca
  do SATE - conferir que nenhum texto residual cita o FundHub.

## Fora do repositório

O **e-mail do link mágico** é um modelo configurado no painel do Supabase
(Authentication → Email Templates) e é o mesmo para as duas entradas. Se ele
disser "FundHub", quem só usa o SATE lê o nome ali. Texto neutro sugerido:

> Assunto: Seu link de acesso - SME Ribeirão Preto
> Corpo: Clique no link abaixo para entrar. Ele vale por uma hora e só pode
> ser usado uma vez.

## Verificação

- Logado como gestor escolar em `sate.html`: "Como usar o SATE" abre dentro
  do SATE, o texto é idêntico ao da Ajuda do FundHub.
- Nenhuma ocorrência de "FundHub" no DOM do `sate.html` quando
  `usaFundHub` é falso (testar forçando o valor em dev-local).
- Tela estreita: a página de ajuda não rola de lado.
