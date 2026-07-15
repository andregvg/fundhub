// ============================================================
// FundHub — modules/docs/docs.content.js
// O CONTEÚDO da documentação, separado da apresentação (docs.view.js).
// Cada seção é { id, ico, titulo, resumo, html }. Para escrever uma
// seção nova, acrescente um objeto aqui: o índice e a navegação se
// montam sozinhos.
//
// Regra: nada de dado real, nome de pessoa ou segredo aqui. Este é um
// repositório PÚBLICO — o que entra neste arquivo é público.
// ============================================================

export const SECOES = [
  {
    id: 'visao-geral',
    ico: '🧭',
    titulo: 'Visão geral',
    resumo: 'O que é o FundHub e para quem.',
    html: `
      <p>O <b>FundHub</b> é o hub de aplicações gerenciais da <b>Gerência de Ensino Fundamental</b>
      da Secretaria Municipal da Educação de Ribeirão Preto. Ele substitui um mosaico de planilhas
      do Google e scripts avulsos por uma base integrada, com acompanhamento em tempo real das
      <b>144 unidades escolares</b>.</p>

      <p>A ideia central é simples: <b>um dado, um dono</b>. A escola é cadastrada uma vez e todos os
      módulos a enxergam; uma data bloqueada no Calendário bloqueia o agendamento no SATE sem que
      ninguém precise avisar ninguém.</p>

      <h3>Quem usa</h3>
      <ul>
        <li><b>Equipe da Gerência (admin)</b> — cadastra, valida solicitações, define a frota, edita o calendário.</li>
        <li><b>Equipe autorizada (leitor)</b> — consulta e cria solicitações, sem poder de escrita nos cadastros.</li>
        <li><b>Escolas</b> — hoje entram pela mesma tela do SATE; a camada do professor sem login (por token) está no backlog.</li>
      </ul>

      <div class="doc-nota">
        <b>Endereços.</b> Produção: <code>andregvg.github.io/fundhub/</code> ·
        Desenvolvimento: <code>andregvg.github.io/fundhub/dev/</code>.
        O roteamento é por hash (<code>#/rota</code>) justamente para o app poder mudar de endereço
        — inclusive para um domínio próprio — sem tocar em uma linha de código.
      </div>`,
  },

  {
    id: 'arquitetura',
    ico: '🏗️',
    titulo: 'Arquitetura',
    resumo: 'SPA sem build + Supabase. As quatro camadas.',
    html: `
      <p>O FundHub é uma <b>SPA estática</b>: HTML, CSS e JavaScript puros, servidos pelo GitHub Pages.
      <b>Não há passo de build</b> — nenhum npm, nenhum bundler. O que está no repositório é
      exatamente o que roda no navegador. Isso é uma escolha deliberada: o sistema precisa continuar
      manutenível por quem vier depois, sem depender de uma cadeia de ferramentas.</p>

      <p>O back-end é o <b>Supabase</b> (Postgres + Auth + RLS + Realtime + Storage).
      Não existe servidor de aplicação nosso: o navegador fala direto com o banco, e quem decide o
      que cada um pode ver é o <b>RLS</b> (ver a seção Segurança).</p>

      <h3>As quatro camadas</h3>
      <table class="doc-tabela">
        <thead><tr><th>Camada</th><th>Pasta</th><th>Responsabilidade</th></tr></thead>
        <tbody>
          <tr><td><b>Kernel</b></td><td><code>src/core/</code></td>
              <td>Configuração, cliente Supabase, autenticação, perfil/permissão, registro de módulos e roteador. Não conhece nenhum módulo em particular.</td></tr>
          <tr><td><b>Moldura</b></td><td><code>src/shell/</code></td>
              <td>A casca do app: topo, navegação, rodapé e a home com os tiles. Monta-se a partir do registro.</td></tr>
          <tr><td><b>Compartilhado</b></td><td><code>src/shared/</code></td>
              <td>Peças reusáveis sem domínio: escape de HTML, datas, gaveta lateral, toasts, estados de vazio/erro.</td></tr>
          <tr><td><b>Módulos</b></td><td><code>src/modules/</code></td>
              <td>Uma pasta por ferramenta. É onde vive o domínio — e onde 90% do trabalho acontece.</td></tr>
        </tbody>
      </table>

      <h3>MVC, adaptado à realidade</h3>
      <p>O padrão clássico foi mapeado assim, sem cerimônia inútil:</p>
      <table class="doc-tabela">
        <thead><tr><th>MVC</th><th>Aqui</th><th>Regra</th></tr></thead>
        <tbody>
          <tr><td><b>Model</b></td><td><code>&lt;modulo&gt;.model.js</code></td>
              <td>Só fala com o banco. <b>Nunca toca no DOM.</b> Guarda também as regras de negócio do domínio (ex.: capacidade do ônibus, antecedência mínima).</td></tr>
          <tr><td><b>View</b></td><td><code>&lt;modulo&gt;.view.js</code></td>
              <td>Renderiza e trata eventos. Exporta uma função <code>render(app, ctx)</code>. Todo acesso a dados passa pelo model.</td></tr>
          <tr><td><b>Controller</b></td><td><code>core/router.js</code></td>
              <td>Resolve a rota, confere a permissão, carrega a view sob demanda e a monta. É único para todo o app.</td></tr>
        </tbody>
      </table>
      <p>Quando um módulo cresce demais (o SATE tem quatro abas), a view se divide em
      <code>views/&lt;aba&gt;.js</code> dentro da própria pasta do módulo. A divisão só acontece
      quando se paga — um módulo de 80 linhas continua em um arquivo só.</p>

      <div class="doc-nota">
        <b>Sobre PSR.</b> As PSR (PSR-4, PSR-12…) são padrões do PHP-FIG e <b>não se aplicam</b> a um
        projeto JavaScript. O equivalente adotado aqui é a <i>arquitetura em fatias verticais</i>
        (uma pasta por funcionalidade, kernel compartilhado) sobre <b>ES Modules</b> nativos, que é o
        padrão moderno do lado JS.
      </div>`,
  },

  {
    id: 'estrutura',
    ico: '🗂️',
    titulo: 'Estrutura de pastas',
    resumo: 'Onde fica cada coisa e quem pode importar quem.',
    html: `
      <pre class="doc-arvore">fundhub/
├── index.html              ← única página; carrega src/main.js
├── src/
│   ├── main.js             ← bootstrap: gate de login → moldura → roteador → serviços
│   ├── core/               ← KERNEL (não conhece nenhum módulo)
│   │   ├── config.js         URL e chave pública do Supabase, domínio institucional
│   │   ├── supabase.js       cliente único
│   │   ├── auth.js           magic link, Google, tela de login
│   │   ├── perfil.js         papel do usuário (isAdmin) — camada de autorização
│   │   ├── registry.js       registro dos módulos (fonte única de tiles/nav/rotas)
│   │   └── router.js         roteador por hash + guarda de admin + carga sob demanda
│   ├── shell/              ← MOLDURA
│   │   ├── chrome.js         topo, navegação (com menu mobile), chip do usuário
│   │   └── home.js           os tiles do hub, gerados do registry
│   ├── shared/             ← COMPARTILHADO (sem domínio)
│   │   ├── dom.js            esc(), norm(), slug(), val()…
│   │   ├── format.js         datas em pt-BR, hojeISO(), addDias()…
│   │   └── ui/               drawer.js · toast.js · feedback.js
│   ├── modules/            ← UMA PASTA POR FERRAMENTA
│   │   └── &lt;modulo&gt;/
│   │       ├── module.js         manifesto (id, ícone, rota, permissão)
│   │       ├── &lt;modulo&gt;.model.js dados + regras de negócio
│   │       ├── &lt;modulo&gt;.view.js  tela
│   │       ├── &lt;modulo&gt;.css      estilo próprio (opcional)
│   │       └── views/            sub-telas, só se o módulo for grande
│   └── styles/
│       ├── main.css          @import de tudo (inclusive os CSS dos módulos)
│       ├── tokens.css        cores, sombras, raios — claro e escuro
│       ├── base.css          reset, topo, navegação, rodapé, impressão
│       └── components.css    tiles, cards, formulários, gaveta, chips…
├── supabase/migrations/    ← o schema, em ordem numérica
└── docs/                   ← BLUEPRINT, HANDOFF, SUPABASE (para quem desenvolve)</pre>

      <h3>Quem pode importar quem</h3>
      <p>Estas quatro regras são o que impede o projeto de virar um novelo:</p>
      <ol>
        <li><b>O kernel não importa módulo</b> — exceto os <code>module.js</code> (manifestos), no registry.</li>
        <li><b>Módulo importa de <code>shared/</code> e <code>core/</code></b> à vontade.</li>
        <li><b>Módulo pode importar o <i>model</i> de outro módulo</b>, <b>nunca a view</b>.
            É a API pública de um módulo. Exemplo legítimo: Viagens lê <code>sate.model.js</code>,
            porque quem é dono das solicitações é o SATE.</li>
        <li><b>Model nunca toca no DOM. View nunca fala com o Supabase.</b></li>
      </ol>
      <div class="doc-nota">
        Se você se pegar querendo importar a <i>view</i> de outro módulo, o que você quer
        provavelmente é: (a) mover aquilo para <code>shared/ui/</code>, ou (b) o dado está no
        módulo errado.
      </div>`,
  },

  {
    id: 'modulos',
    ico: '🧩',
    titulo: 'Os módulos',
    resumo: 'O que já roda, o que falta e quem depende de quem.',
    html: `
      <table class="doc-tabela">
        <thead><tr><th>Módulo</th><th>Rota</th><th>Tabelas</th><th>Situação</th></tr></thead>
        <tbody>
          <tr><td>📊 <b>Dashboard do dia</b></td><td><code>#/dashboard</code></td><td>— (compõe os outros)</td><td class="ok">ativo</td></tr>
          <tr><td>🏫 <b>Escolas</b></td><td><code>#/escolas</code></td><td><code>unidade_escolar</code>, <code>vw_escola_pessoas</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>📅 <b>Calendário Escolar</b></td><td><code>#/calendario</code></td><td><code>dia_calendario</code></td><td class="ok">ativo · admin edita</td></tr>
          <tr><td>🌴 <b>Afastamentos</b></td><td><code>#/afastamentos</code></td><td><code>afastamento</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>🚌 <b>SATE · Transporte</b></td><td><code>#/sate</code></td><td><code>solicitacao_transporte</code>, <code>atividade_extraclasse</code>, <code>oferta_onibus</code></td><td class="ok">ativo · 4 abas</td></tr>
          <tr><td>📄 <b>Programação de Viagens</b></td><td><code>#/viagens</code></td><td>— (lê do SATE)</td><td class="ok">ativo · imprimível</td></tr>
          <tr><td>👥 <b>Gestores &amp; Coordenadores</b></td><td><code>#/gestores</code></td><td><code>servidor</code>, <code>vinculo</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>🕒 <b>Horários de Trabalho</b></td><td><code>#/horarios</code></td><td><code>horario_bloco</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>🔔 <b>Notificações</b></td><td>— (serviço)</td><td><code>solicitacao_transporte</code> (realtime)</td><td class="ok">ativo</td></tr>
          <tr><td>📞 <b>Ocorrências</b></td><td><code>#/ocorrencias</code></td><td><code>ocorrencia</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>📝 <b>Atas de Atendimento</b></td><td><code>#/atas</code></td><td><code>ata_atendimento</code></td><td class="ok">ativo · imprime timbrado</td></tr>
          <tr><td>📋 <b>Relatórios de Visita</b></td><td><code>#/visitas</code></td><td><code>relatorio_visita</code></td><td class="ok">ativo · CRUD admin</td></tr>
          <tr><td>🔐 <b>Usuários &amp; Acessos</b></td><td><code>#/usuarios</code></td><td><code>perfil</code>, <code>audit_log</code></td><td class="ok">ativo · só admin</td></tr>
          <tr><td>📖 <b>Documentação</b></td><td><code>#/docs</code></td><td>—</td><td class="ok">ativo · só admin</td></tr>
          <tr><td>🔬 Projetos &amp; Pesquisas</td><td>—</td><td>a definir</td><td>backlog · depende de Edge Function</td></tr>
        </tbody>
      </table>

      <h3>As dependências que importam</h3>
      <ul>
        <li><b>Calendário → SATE.</b> Antes de aceitar uma solicitação, o SATE consulta o dia:
            se ele estiver marcado como <i>bloqueia extraclasse</i> ou como não letivo, a escola é barrada.
            <b>O admin passa por cima</b> — é proposital, exceções existem.</li>
        <li><b>SATE → Viagens.</b> A Programação de Viagens não tem dados próprios: é a leitura das
            solicitações <i>confirmadas</i> de um dia, no formato que a empresa de transporte recebe.</li>
        <li><b>Escolas → todo mundo.</b> É o cadastro de base. Quase todo módulo importa
            <code>escolas.model.js</code>.</li>
        <li><b>Gestores → Horários e Afastamentos.</b> Quem é dono das pessoas (<code>servidor</code>) e
            dos <code>vinculo</code>s é o módulo Gestores. Horários só enxerga quem tem <b>vínculo ativo
            no ano</b> com aquela escola; Afastamentos escolhe o servidor da mesma lista. Sem vínculo,
            a pessoa não aparece em lugar nenhum — é o efeito desejado.</li>
        <li><b>SATE → Notificações.</b> O serviço assina o Realtime da tabela de solicitações.</li>
      </ul>`,
  },

  {
    id: 'jornada',
    ico: '🕒',
    titulo: 'Regras da jornada',
    resumo: 'Como Horários valida a semana e a cobertura da escola.',
    html: `
      <p>A jornada de um servidor num dia é um <b>conjunto de blocos</b>, e não um par
      entrada/saída. Essa escolha não é um detalhe técnico: é o que permite exigir que quem
      cumpre 8 horas tenha um intervalo — com um par único de entrada e saída, a regra das
      6h contínuas seria impossível de representar.</p>

      <h3>O que é validado (em <code>horarios.model.js</code>)</h3>
      <table class="doc-tabela">
        <thead><tr><th>Regra</th><th>Nível</th><th>Comportamento</th></tr></thead>
        <tbody>
          <tr><td>Blocos sobrepostos no mesmo dia</td><td><b>Erro</b></td>
              <td>Bloqueia o salvamento. A pessoa não pode estar em dois lugares.</td></tr>
          <tr><td>Mais de <b>8h no dia</b></td><td><b>Erro</b></td>
              <td>Bloqueia o salvamento.</td></tr>
          <tr><td>Mais de <b>6h contínuas</b></td><td>Aviso</td>
              <td>Deixa salvar, mas sinaliza na tela. Blocos <b>encostados</b> (um termina onde o outro começa) contam como um trecho contínuo só — 7h–12h + 12h–14h são 7h seguidas, não 5h + 2h.</td></tr>
          <tr><td>Cobertura <b>7h00–18h20</b></td><td>Aviso</td>
              <td>Calculada por escola, não por pessoa: é a <i>união</i> dos blocos de todos os servidores no dia. O que sobra vira lacuna, em vermelho.</td></tr>
        </tbody>
      </table>

      <div class="doc-nota">
        <b>Erro barra, aviso não.</b> Sobreposição e excesso de carga são impossíveis e por isso
        impedem o salvamento. Já 6h contínuas e lacuna de cobertura são situações que existem na
        vida real e que a SME às vezes precisa aceitar conscientemente — a tela mostra, mas não
        impede. É a mesma filosofia do SATE, onde o admin pode confirmar uma viagem mesmo sem
        saldo de frota.
      </div>

      <h3>Quem aparece na tela</h3>
      <p>Horários só lista quem tem <b>vínculo ativo, naquela escola, naquele ano</b>. Servidor sem
      vínculo não aparece — cadastre o vínculo primeiro, em Gestores &amp; Coordenadores.</p>`,
  },

  {
    id: 'seguranca',
    ico: '🔒',
    titulo: 'Segurança e permissões',
    resumo: 'RLS, allowlist, papéis — e por que a chave é pública.',
    html: `
      <div class="doc-alerta">
        <b>O repositório é PÚBLICO.</b> Nenhum dado real, nenhuma planilha, nenhum seed, nenhum nome
        de servidor pode ser versionado — em hipótese alguma. Dados reais só existem no Supabase.
        Seeds ficam em <code>_private/</code> (ignorado pelo git). Sempre conferir
        <code>git diff --cached</code> antes de commitar.
      </div>

      <h3>Por que a chave do Supabase está no código</h3>
      <p>A chave <i>publishable</i> (<code>sb_publishable_…</code>), em <code>src/core/config.js</code>,
      é <b>pública por design</b> — ela é enviada ao navegador de todo mundo, sempre; não há como
      escondê-la em um app estático. Ela não é uma senha: é um identificador de projeto.
      <b>Quem protege os dados é o RLS</b>, não o segredo da chave.</p>
      <p>A chave <b>secreta</b> (<code>sb_secret_…</code> / <code>service_role</code>) ignora o RLS.
      Ela <b>nunca</b> entra no front-end nem no repositório, em nenhuma circunstância.
      Se alguém pedir essa chave, a resposta é não.</p>

      <h3>As três barreiras, em ordem</h3>
      <ol>
        <li><b>Domínio institucional.</b> Só entra quem tem e-mail
            <code>@educacao.pmrp.sp.gov.br</code>. Validado na tela (UX) e no banco
            (<code>is_institucional()</code>).</li>
        <li><b>Allowlist.</b> Ter e-mail institucional não basta: o e-mail precisa estar na tabela
            <code>perfil</code>. É o que a função <code>is_autorizado()</code> confere.</li>
        <li><b>Papel.</b> <code>perfil.papel = 'admin_sme'</code> libera escrita
            (<code>is_admin()</code>). Todos os demais só leem.</li>
      </ol>
      <p>O padrão de toda tabela é <b>default-deny</b>: nada é legível até uma policy dizer o
      contrário. Quem está deslogado (<code>anon</code>) <b>não acessa absolutamente nada</b> — e isso
      é o comportamento desejado, não um bug.</p>

      <h3>Onde a permissão é checada no front</h3>
      <ul>
        <li><code>core/perfil.js</code> devolve <code>{ papel, isAdmin }</code> e é a fonte única.</li>
        <li>O <b>roteador</b> barra rotas de módulos marcados <code>admin: true</code> no manifesto.</li>
        <li>A <b>home</b> esconde os tiles de módulos <code>admin</code> de quem não é admin.</li>
        <li>Cada <b>view</b> recebe <code>ctx.perfil</code> e esconde os botões de escrita.</li>
      </ul>
      <div class="doc-nota">
        Nada disso é segurança de verdade — é <b>conforto</b>: esconder um botão não impede ninguém
        de abrir o console. A segurança real é o RLS, e por isso ela é redundante lá. Se o front
        deixar passar, o banco recusa.
      </div>

      <h3>XSS</h3>
      <p>As telas montam HTML com <i>template literals</i>. Todo valor vindo do banco
      <b>tem</b> que passar por <code>esc()</code> (<code>shared/dom.js</code>) antes de ser
      interpolado. Um nome de escola com <code>&lt;script&gt;</code> dentro não é hipótese
      acadêmica quando qualquer admin pode digitar o cadastro.</p>`,
  },

  {
    id: 'auditoria',
    ico: '🕵️',
    titulo: 'Auditoria e último acesso',
    resumo: 'Como se sabe o que mudou, quem mudou e quando.',
    html: `
      <p>Toda alteração de cadastro é registrada automaticamente: o valor <b>antes</b>, o valor
      <b>depois</b> e o <b>diff campo a campo</b>. Quem responde à pergunta "o que era antes e o que
      mudou" é a aba <b>Auditoria</b> em Usuários &amp; Acessos.</p>

      <h3>Por que no banco, e não na tela</h3>
      <p>O registro é feito por um <b>trigger no Postgres</b> (<code>fn_audit</code>, migration 011),
      não por código de tela. Isso tem duas consequências que nenhuma solução no front teria:</p>
      <ul>
        <li><b>É automático.</b> Nenhuma tela precisa "lembrar" de registrar. Um módulo novo entra na
            auditoria com uma linha no array de tabelas do trigger — nada no JavaScript.</li>
        <li><b>É à prova de bypass.</b> Quem alterar por SQL direto, por outra ferramenta, ou por um
            bug de tela, <b>também</b> fica registrado. A auditoria não depende de ninguém se comportar.</li>
      </ul>
      <p>O trigger guarda a linha inteira antes e depois (em <code>jsonb</code>) e, para alterações,
      calcula só os campos que realmente mudaram. Carimbos automáticos
      (<code>atualizado_em</code>, <code>ultimo_acesso</code>) são ignorados para não virar ruído.</p>

      <h3>Quem pode ler</h3>
      <p>Só admin, pelo RLS. E <b>ninguém escreve</b> no <code>audit_log</code> — não há policy de
      insert/update/delete. O único que grava ali é o próprio trigger (que roda como dono da tabela).
      Auditoria que se apaga não é auditoria.</p>

      <h3>Último acesso</h3>
      <p>Cada login carimba <code>perfil.ultimo_acesso</code>, via a função <code>registrar_acesso()</code>
      (a única exceção que deixa um usuário comum escrever no próprio perfil — e só nesse campo).
      A função devolve o acesso <i>anterior</i>, que é o que aparece no menu de usuário
      ("Último acesso: …"). Todo horário exibido no FundHub passa por <code>fmtDataHora</code>, que
      formata no fuso <b>America/Sao_Paulo</b> — o relógio bate com o de quem está usando,
      não importa onde o banco esteja.</p>`,
  },

  {
    id: 'banco',
    ico: '🗄️',
    titulo: 'Banco de dados',
    resumo: 'Tabelas, migrations e como aplicá-las.',
    html: `
      <p>O schema vive em <code>supabase/migrations/</code> e é aplicado <b>à mão, em ordem
      numérica</b>, pelo SQL Editor do painel do Supabase. Não há ferramenta de migração
      automática — de novo, por opção: o volume não justifica.</p>

      <pre class="doc-arvore">schema.sql
 → 002_leitura_allowlist.sql     allowlist + is_autorizado()
 → 003_grants.sql                grants para o papel authenticated
 → 004_sate.sql                  atividades, solicitações, oferta de ônibus
 → 005_solicitacao_extra.sql     campos extras da solicitação
 → 006_realtime.sql              publicação realtime das solicitações
 → 007_calendario.sql            dia_calendario
 → 008_afastamentos.sql          afastamento
 → 009_horarios.sql              horario_bloco
 → 010_ocorrencias.sql           ocorrencia
 → 011_auditoria.sql             audit_log + trigger + ultimo_acesso
 → 012_visitas.sql               relatorio_visita
 → 013_atas.sql                  ata_atendimento</pre>

      <h3>Tabelas</h3>
      <table class="doc-tabela">
        <thead><tr><th>Tabela</th><th>O que guarda</th></tr></thead>
        <tbody>
          <tr><td><code>unidade_escolar</code></td><td>As 144 escolas: nome, endereço, segmento, oferta, transporte, EJA, INEP.</td></tr>
          <tr><td><code>regional</code></td><td>As regionais da rede.</td></tr>
          <tr><td><code>servidor</code></td><td>Gestores, coordenadores e supervisores. A <code>chave</code> é única — a tela a deriva do nome e desempata com sufixo.</td></tr>
          <tr><td><code>vinculo</code></td><td>Liga servidor × unidade × papel × <b>ano</b>. É temporal: encerrar um vínculo (<code>ativo=false</code> + <code>fim</code>) preserva o histórico; excluir apaga. A view <code>vw_escola_pessoas</code> achata isso para a tela de Escolas.</td></tr>
          <tr><td><code>horario_bloco</code></td><td>A jornada. Um dia é um <b>conjunto de blocos</b>, não um par entrada/saída — é o que permite exigir intervalo em quem cumpre 8h.</td></tr>
          <tr><td><code>perfil</code></td><td><b>A allowlist.</b> E-mail + papel (<code>admin_sme</code> ou leitor). Hoje só se edita por SQL.</td></tr>
          <tr><td><code>atividade_extraclasse</code></td><td>O catálogo do SATE. A Feira do Livro é <i>uma linha aqui</i>, não um sistema à parte.</td></tr>
          <tr><td><code>solicitacao_transporte</code></td><td>O pedido da escola: atividade, data, período, alunos, ônibus, status.</td></tr>
          <tr><td><code>oferta_onibus</code></td><td>Quantos ônibus existem por dia e período. Confrontada com o uso ao confirmar.</td></tr>
          <tr><td><code>dia_calendario</code></td><td>Dia letivo, evento, tipo e os <b>bloqueios</b> que o SATE respeita.</td></tr>
          <tr><td><code>afastamento</code></td><td>Servidor × tipo × período × unidade. <code>fim</code> nulo = em aberto.</td></tr>
          <tr><td><code>ocorrencia</code></td><td>Atendimentos telefônicos da recepção. A escola é <b>opcional</b> — nem toda ligação é sobre uma unidade.</td></tr>
          <tr><td><code>relatorio_visita</code></td><td>Visitas técnicas às escolas: pauta, constatações, encaminhamentos e prazo.</td></tr>
          <tr><td><code>ata_atendimento</code></td><td>Atas com numeração sequencial por ano (trigger) e impressão em papel timbrado.</td></tr>
          <tr><td><code>audit_log</code></td><td><b>A auditoria.</b> Preenchida pelo trigger <code>fn_audit</code> — cada alteração com o antes, o depois e o diff. Só admin lê; ninguém escreve direto.</td></tr>
        </tbody>
      </table>

      <h3>Funções</h3>
      <ul>
        <li><code>auth_email()</code> — o e-mail do JWT da sessão.</li>
        <li><code>is_institucional()</code> — o e-mail termina no domínio da SME?</li>
        <li><code>is_autorizado()</code> — está na tabela <code>perfil</code>? (usada em todo <code>select</code>)</li>
        <li><code>is_admin()</code> — <code>papel = 'admin_sme'</code>? (usada em todo <code>insert/update/delete</code>)</li>
      </ul>

      <h3>Seeds</h3>
      <p>Os seeds (<code>seed_unidades.sql</code>, <code>seed_atividades.sql</code>,
      <code>seed_calendario.sql</code>) são gerados localmente a partir das planilhas originais e
      ficam em <code>_private/</code>, que é <b>gitignored</b>. Eles contêm dados reais e
      <b>nunca</b> podem ser commitados. Rodam no SQL Editor, depois da migration correspondente.</p>`,
  },

  {
    id: 'fluxo',
    ico: '🚀',
    titulo: 'Fluxo de trabalho e deploy',
    resumo: 'dev → main, GitHub Pages, e como testar sem login.',
    html: `
      <h3>Branches</h3>
      <p>Trabalha-se <b>sempre na <code>dev</code></b>, valida-se na URL de dev, e só então
      faz-se o merge <code>dev → main</code> para publicar. A <code>main</code> é o que a Gerência
      está usando de verdade.</p>

      <h3>Deploy</h3>
      <p>GitHub Actions (<code>.github/workflows/pages.yml</code>) publica a <code>main</code> na
      raiz e a <code>dev</code> em <code>/dev/</code>. Os deploys são enfileirados
      (<code>cancel-in-progress: false</code>), porque um merge dispara dois runs quase juntos e
      cancelar o primeiro deixava a raiz desatualizada.</p>
      <p>Se a raiz ficar obsoleta depois de um merge, basta re-disparar:</p>
      <pre class="doc-arvore">gh workflow run "Deploy Pages (main + dev)" --ref main</pre>

      <h3>Testar localmente, sem login</h3>
      <p>Rode um servidor estático na raiz (<code>python -m http.server</code>) e, para simular um
      admin, edite <b>temporariamente</b>:</p>
      <ol>
        <li><code>src/core/config.js</code> → <code>supabaseAnonKey: ''</code>
            (isso liga o modo dev-local: sem gate de login, sem dados);</li>
        <li><code>src/core/perfil.js</code> → no ramo <code>if (!hasSupabase())</code>, devolver
            <code>{ email:'dev@local', papel:'admin_sme', isAdmin:true }</code>.</li>
      </ol>
      <div class="doc-alerta">
        <b>Reverta os dois antes de commitar.</b> Confira que a chave voltou e que
        <code>dev@local</code> sumiu. Um <code>git diff</code> resolve.
      </div>

      <h3>O que não mexer</h3>
      <p>Os Apps Scripts antigos (<code>agendamentos-fil</code>,
      <code>afastamentos-gestores</code>) seguem <b>em produção em paralelo</b>. Eles servem de
      inspiração e nada mais: <b>não são alterados</b>. O SATE é a generalização do
      <code>agendamentos-fil</code> — a Feira do Livro virou uma atividade do catálogo.</p>`,
  },

  {
    id: 'novo-modulo',
    ico: '➕',
    titulo: 'Como criar um novo módulo',
    resumo: 'O passo a passo completo, com código.',
    html: `
      <p>Exemplo: criar o módulo <b>Ocorrências</b> (registro dos atendimentos telefônicos).
      São cinco passos, sempre os mesmos.</p>

      <h3>1. A migration</h3>
      <p>Crie <code>supabase/migrations/009_ocorrencias.sql</code>, no mesmo molde das outras:
      tabela, índices, <b>RLS ligado</b>, policies (<code>select</code> por
      <code>is_autorizado()</code>, escrita por <code>is_admin()</code>) e os grants para
      <code>authenticated</code>. Rode no SQL Editor.</p>

      <h3>2. A pasta e o manifesto</h3>
      <pre class="doc-arvore">src/modules/ocorrencias/
├── module.js
├── ocorrencias.model.js
└── ocorrencias.view.js</pre>
      <p><code>module.js</code> — é isto que faz o módulo existir para o hub:</p>
      <pre class="doc-arvore">export default {
  id: 'ocorrencias',
  ico: '📞',
  nome: 'Ocorrências',
  desc: 'Registro de atendimentos telefônicos.',
  rota: '#/ocorrencias',
  nav: true,          // aparece na barra de navegação
  ativo: true,        // false = tile "em breve"
  admin: false,       // true = só admin vê e acessa
  load: () => import('./ocorrencias.view.js'),
};</pre>

      <h3>3. O model</h3>
      <p>Só banco, nunca DOM. Toda função checa <code>hasSupabase()</code> antes — é o que mantém
      o modo dev-local funcionando:</p>
      <pre class="doc-arvore">import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export async function getOcorrencias({ unidadeId } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('ocorrencia')
    .select('*, unidade:unidade_escolar(nome,apelido)')
    .order('criado_em', { ascending: false });
  if (unidadeId) q = q.eq('unidade_id', unidadeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function criarOcorrencia(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...payload, criado_por: await emailAtual() };
  const { data, error } = await sb().from('ocorrencia').insert(row).select().single();
  if (error) throw error;
  return data;
}</pre>

      <h3>4. A view</h3>
      <p>Exporta <code>render(app, ctx)</code>. O <code>ctx.perfil</code> já vem pronto do roteador —
      <b>não</b> chame <code>getPerfilAtual()</code> de novo:</p>
      <pre class="doc-arvore">import { getOcorrencias } from './ocorrencias.model.js';
import { esc } from '../../shared/dom.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, montarDrawer, abrirDrawer } from '../../shared/ui/drawer.js';

export async function render(app, { perfil } = {}) {
  app.innerHTML = &#96;
    &lt;div class="page-head"&gt;&lt;h1&gt;Ocorrências&lt;/h1&gt;&lt;/div&gt;
    &lt;div id="oc-lista"&gt;&#36;{loading()}&lt;/div&gt;
    &#36;{drawerHtml()}&#96;;
  montarDrawer();
  // …carregar, pintar, ligar eventos
}</pre>

      <h3>5. Registrar</h3>
      <p>Em <code>src/core/registry.js</code>, importe o manifesto e acrescente-o ao array
      <code>MODULOS</code> — a posição no array é a posição do tile na home. <b>Só isso.</b>
      O tile, o item de navegação e a rota aparecem sozinhos.</p>
      <p>Se o módulo tiver estilo próprio, crie <code>ocorrencias.css</code> na pasta dele e
      acrescente um <code>@import</code> em <code>src/styles/main.css</code>.</p>

      <div class="doc-nota">
        <b>Antes de commitar:</b> teste em dev-local, confira o console do navegador,
        <b>abra em uma tela estreita</b> (o FundHub é mobile-first) e rode
        <code>git diff --cached</code> procurando por dado real.
      </div>`,
  },

  {
    id: 'visual',
    ico: '🎨',
    titulo: 'Padrão visual',
    resumo: 'Mobile-first, tokens, e os componentes prontos.',
    html: `
      <h3>Mobile-first, de verdade</h3>
      <p>O CSS é escrito <b>primeiro para a tela pequena</b>; as telas maiores recebem
      acréscimos via <code>@media (min-width: …)</code> — nunca o contrário. Os cortes usados são
      <b>560px</b>, <b>720px</b> e <b>900px</b>.</p>
      <p>Na prática, isso significa: um dedo alcança tudo, os alvos de toque têm no mínimo 40px,
      a navegação vira um menu ☰, os formulários viram uma coluna só e a gaveta lateral ocupa a
      largura inteira.</p>

      <h3>Tokens</h3>
      <p>Cores, sombras e raios são variáveis CSS em <code>styles/tokens.css</code>, com o tema
      escuro definido por <code>@media (prefers-color-scheme: dark)</code>. <b>Nunca escreva uma
      cor fixa</b> em um módulo: use <code>var(--brand)</code>, <code>var(--muted)</code>,
      <code>var(--danger)</code>… Se você precisou de uma cor que não existe, ela provavelmente
      deveria virar um token.</p>

      <h3>Componentes prontos</h3>
      <table class="doc-tabela">
        <thead><tr><th>Precisa de…</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>Título da página</td><td><code>.page-head</code> com <code>h1</code> + <code>p</code></td></tr>
          <tr><td>Barra de busca/filtros/ação</td><td><code>.toolbar</code> + <code>.search</code> + <code>.filters</code> + <code>.btn-primary</code></td></tr>
          <tr><td>Filtro alternável</td><td><code>.chip</code> (classe <code>.on</code> quando ativo)</td></tr>
          <tr><td>Lista de fichas</td><td><code>.cards</code> + <code>.card</code></td></tr>
          <tr><td>Item de lista com ações</td><td><code>.solic</code> + <code>.solic-acoes</code> + <code>.mini-btn</code></td></tr>
          <tr><td>Detalhe / formulário lateral</td><td><code>shared/ui/drawer.js</code></td></tr>
          <tr><td>Formulário em grade</td><td><code>.form-grid</code> (1 coluna no celular, 2 a partir de 560px)</td></tr>
          <tr><td>Vazio, erro, carregando</td><td><code>shared/ui/feedback.js</code></td></tr>
          <tr><td>Aviso passageiro</td><td><code>shared/ui/toast.js</code></td></tr>
          <tr><td>Abas</td><td><code>.tabbar</code> + <code>.tab</code></td></tr>
        </tbody>
      </table>
      <p>Antes de escrever CSS novo, procure aqui. Um módulo que não precisou de
      <code>.css</code> próprio é um bom sinal.</p>`,
  },

  {
    id: 'glossario',
    ico: '📚',
    titulo: 'Glossário',
    resumo: 'Os termos da casa.',
    html: `
      <table class="doc-tabela">
        <thead><tr><th>Termo</th><th>Significa</th></tr></thead>
        <tbody>
          <tr><td><b>SATE</b></td><td>Sistema de Agendamento de Transporte Extraclasse. O módulo do ônibus.</td></tr>
          <tr><td><b>Programação de Viagens</b></td><td>O documento enviado à empresa de transporte. <b>Não</b> se chama "romaneio".</td></tr>
          <tr><td><b>Extraclasse</b></td><td>Atividade fora da escola (visita, feira, teatro) que costuma exigir ônibus.</td></tr>
          <tr><td><b>Atividade livre</b></td><td>Atividade organizada pela própria escola, fora do catálogo da SME.</td></tr>
          <tr><td><b>Allowlist</b></td><td>A tabela <code>perfil</code>: quem tem permissão de entrar.</td></tr>
          <tr><td><b>RLS</b></td><td><i>Row Level Security</i>: as regras, no Postgres, de quem enxerga qual linha.</td></tr>
          <tr><td><b>Manifesto</b></td><td>O <code>module.js</code> de um módulo: id, ícone, rota, permissão.</td></tr>
          <tr><td><b>dev-local</b></td><td>Rodar sem Supabase configurado: sem login e sem dados. Para testar layout.</td></tr>
          <tr><td><b>FIL</b></td><td>Feira do Livro. Hoje é apenas uma linha do catálogo de atividades.</td></tr>
          <tr><td><b>EJA</b></td><td>Educação de Jovens e Adultos.</td></tr>
        </tbody>
      </table>`,
  },
];
