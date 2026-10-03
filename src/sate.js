// ============================================================
// FundHub - sate.js  (bootstrap do SATE, página sate.html)
// Spec: docs/superpowers/specs/2026-09-13-sate-app-proprio-design.md
//
// O SATE com cara de sistema próprio: menu lateral com as páginas dele,
// cor configurável e marca do ônibus. Por baixo é o MESMO FundHub - mesmo
// portão (shell/portao.js), mesma conta, mesmas permissões, mesmo banco.
// Quem entra num entra no outro.
//
// Quem só usa o SATE não vê o nome FundHub em lugar nenhum: o link para
// lá e o "Meus dados" do menu de usuário só aparecem para quem também
// enxerga algum módulo do FundHub (`usaFundHub`), e a ajuda é uma rota
// interna (`#/ajuda`) que lê o mesmo tutorial que a Ajuda do FundHub usa
// (spec 2026-09-26-sate-identidade-propria).
//
// É uma ENTRADA, como main.js: pode importar de qualquer lugar (R1). E é
// o controller desta página - um roteador de cinco rotas não justifica
// generalizar core/router.js, que conhece o registro de módulos inteiro.
// ============================================================
import { MODULOS, moduloPorId, nivelEfetivo, veModulo } from './core/registry.js';
import { hasSupabase } from './core/supabase.js';
import { OCULTO, PROPRIOS, LEITURA, ESCRITA } from './core/permissoes.js';
import { abrirPortao } from './shell/portao.js';
import { montarNav, marcarNav, marcarAtualizacao, atualizarMeusDados } from './shell/chrome.js';
import { render, PAGINAS, PAGINA_INICIAL } from './modules/sate/sate.view.js';
import { corSate } from './modules/sate/sate.config.js';
import * as notificacoes from './modules/notificacoes/notificacoes.service.js';
import { pintarConfigDoModulo } from './modules/configuracoes/painel.js';
import { getUnidades } from './modules/escolas/escolas.model.js';
import { markdownParaHtml } from './modules/ajuda/markdown.js';
import { criarBuscaSelecao } from './shared/ui/busca-selecao.js';
import { emptyState, loading } from './shared/ui/feedback.js';
import { limparToasts } from './shared/ui/toast.js';
import { ico } from './shared/ui/icones.js';

// Usa o FundHub = enxerga ao menos um módulo de navegação que não seja o
// SATE nem um dos de serviço (`publico`). Não é controle de acesso (R6):
// decide só o que o SATE MENCIONA. Spec 2026-09-26-sate-identidade-propria, D3.
const usaFundHub = () => MODULOS.some(m =>
  m.nav && m.rota && m.id !== 'sate' && !m.publico && veModulo(m));

// Quem usa o SATE como ESCOLA não é levado ao FundHub - nem pelo menu, nem
// pelo "Meus dados" (spec 2026-10-03, D19). Por enquanto: volta quando o
// FundHub for aberto às escolas. NÃO é controle de acesso (R6): quem
// digitar o endereço entra e vê o que o banco deixa. `simulando` conta
// como escola - a simulação mostra o menu exatamente como ela o vê.
const ehEscola = () => !!simulando || estado?.nivel === PROPRIOS;
const ofereceFundHub = () => usaFundHub() && !ehEscola();

const app = document.getElementById('app');
const MARCA = {
  ico: 'onibus',
  titulo: 'SA<span class="hub">TE</span>',
  sub: 'Transporte extraclasse da rede municipal. Entre com o e-mail institucional.',
};

let estado = null;   // { perfil, nivel, podeAprovar, somenteLeitura } depois da porta

// ── Ver como escola ──────────────────────────────────────────
// Quem aprova escolhe uma escola e o SATE se desenha como ELA o vê: só as
// páginas dela, só as viagens em que está envolvida, as regras de escola
// no formulário. É SIMULAÇÃO DE TELA: o banco continua respondendo com os
// poderes de quem aprova, e por isso nada se grava (`somenteLeitura`).
// Dura a sessão da aba - recarregar mantém, fechar a aba encerra.
const CHAVE_SIM = 'sate:ver-como';
function lerSimulacao() {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_SIM) || 'null'); } catch (_) { return null; }
}
function gravarSimulacao(v) {
  try { v ? sessionStorage.setItem(CHAVE_SIM, JSON.stringify(v)) : sessionStorage.removeItem(CHAVE_SIM); } catch (_) {}
}
let simulando = null;

// O que a tela usa: quem aprova vendo como escola deixa de aprovar.
const aprovadorEfetivo = () => estado.podeAprovar && !simulando;
// `isAdmin: false` porque o Catálogo decide o botão de editar por ele.
const perfilEfetivo = () => (simulando ? { ...estado.perfil, unidades: [simulando.id], isAdmin: false } : estado.perfil);

function mudarSimulacao(v) {
  simulando = v;
  gravarSimulacao(v);
  montarNav(gruposDoMenu());
  atualizarMeusDados();
  if (location.hash === `#/${PAGINA_INICIAL}`) rotear();
  else location.hash = `#/${PAGINA_INICIAL}`;
}

// A cor mora no <body>: tudo o que usa --brand muda junto (sate.css).
const aplicarCor = () => { document.body.dataset.cor = corSate(); };

function montarSate({ perfil }) {
  const mod = moduloPorId('sate');
  const nv = nivelEfetivo(mod);
  aplicarCor();

  if (nv === OCULTO) {
    montarNav([{ itens: usaFundHub() ? [linkFundHub()] : [] }]);
    app.innerHTML = emptyState(ico('restrito', { tam: 32 }), 'O SATE não está liberado para você',
      'Se precisa pedir transporte para a sua escola, fale com a Gerência de Ensino Fundamental.');
    return;
  }

  // `leitura` é quem vê a rede inteira sem decidir nada (ex.: Equipe da
  // SME) - diferente da escola (`proprios`), que só vê e mexe no que é
  // dela. Sem essa distinção a tela tratava os dois como "escola": mostrava
  // botão da escola (que o RLS recusa em silêncio - filtra o UPDATE para 0
  // linhas e a tela dizia sucesso) e "Nova solicitação" com a lista de
  // escolas vazia (spec 2026-09-26-sate-frota-e-disponibilidade, achado da
  // revisão final).
  estado = { perfil, nivel: nv, podeAprovar: nv === ESCRITA, somenteLeitura: nv === LEITURA };
  // Só quem aprova simula; um valor que sobrou de outra conta na mesma aba
  // não vale para quem não aprova.
  simulando = estado.podeAprovar ? lerSimulacao() : null;
  montarNav(gruposDoMenu());
  atualizarMeusDados();
  rotear().then(marcarAtualizacao);
  // O sino, só com os avisos do SATE. Mesmo serviço e mesma permissão do
  // FundHub - aqui sem afastamentos e ocorrências, que seriam ruído.
  if (hasSupabase() && veModulo(moduloPorId('notificacoes'))) notificacoes.iniciar({ fontes: ['sate'] });
}

// ── Menu ─────────────────────────────────────────────────────
function gruposDoMenu() {
  const aprovador = aprovadorEfetivo();
  const paginas = Object.entries(PAGINAS)
    .filter(([, p]) => !p.aprovador || aprovador)
    .map(([id, p]) => ({ rota: `#/${id}`, ico: p.ico, nome: p.rotulo }));
  const conta = [
    ...(aprovador ? [{ rota: '#/configuracoes', ico: 'config', nome: 'Configurações' }] : []),
    // Fora da simulação: durante ela, a saída é o botão da faixa do topo.
    ...(estado.podeAprovar && !simulando ? [{ rota: '#/ver-como', ico: 'escola', nome: 'Ver como escola' }] : []),
    { rota: '#/ajuda', ico: 'ajuda', nome: 'Como usar o SATE' },
    ...(ofereceFundHub() ? [linkFundHub()] : []),
  ];
  return [
    { rotulo: 'Transporte', itens: paginas },
    { rotulo: 'Mais', itens: conta },
  ];
}

const linkFundHub = () => ({ externo: './', ico: 'escola', nome: 'Ir para o FundHub' });

// ── Rotas ────────────────────────────────────────────────────
async function rotear() {
  if (!estado) return;
  const id = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];

  if (id === 'ajuda') {
    marcarNav('#/ajuda');
    return paginaAjuda();
  }
  if (id === 'configuracoes' && aprovadorEfetivo()) {
    marcarNav('#/configuracoes');
    return paginaConfiguracoes();
  }
  if (id === 'ver-como' && estado.podeAprovar) {
    marcarNav('#/ver-como');
    return paginaVerComo();
  }
  // Página inexistente ou de aprovador para quem não aprova: a inicial.
  // Sem "acesso restrito" aqui - o menu nem oferece o link, e o RLS barra
  // o dado de qualquer jeito (R6).
  const pagina = PAGINAS[id];
  if (!pagina || (pagina.aprovador && !aprovadorEfetivo())) {
    if (location.hash !== `#/${PAGINA_INICIAL}`) { location.replace(`#/${PAGINA_INICIAL}`); return; }
  }

  aplicarCor();   // quem voltou das Configurações pode ter trocado a cor
  marcarNav(`#/${PAGINAS[id] ? id : PAGINA_INICIAL}`);
  await render(app, {
    perfil: perfilEfetivo(), aprovador: aprovadorEfetivo(), id: PAGINAS[id] ? id : PAGINA_INICIAL,
    irPara: (nova) => { location.hash = `#/${nova}`; },
    simulando, aoSairSimulacao: () => mudarSimulacao(null),
    somenteLeitura: estado.somenteLeitura,
  });
  window.scrollTo(0, 0);
}

// As configurações do módulo como PÁGINA, e não modal: no SATE elas são um
// item do menu, e o mesmo desenho que o FundHub usa na tela agregadora.
async function paginaConfiguracoes() {
  app.innerHTML = `
    <div class="page-head">
      <h1>Configurações</h1>
      <p>Frota, regras de agendamento e a cor do SATE. Valem para a rede toda.</p>
    </div>
    <div id="sate-config">${loading()}</div>`;
  await pintarConfigDoModulo(document.getElementById('sate-config'), moduloPorId('sate'));
}

// O tutorial do SATE, dentro do SATE. É o MESMO arquivo que a Ajuda do
// FundHub lê (docs/modulos/sate.md), pelo mesmo leitor - um texto só,
// dois lugares de leitura (spec 2026-09-26-sate-identidade-propria, D1).
async function paginaAjuda() {
  app.innerHTML = `
    <div class="page-head"><h1>Como usar o SATE</h1></div>
    <article class="ajuda-doc" id="ajuda-doc">${loading()}</article>`;
  const box = document.getElementById('ajuda-doc');
  try {
    const resp = await fetch('docs/modulos/sate.md', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('nao encontrado');
    const html = markdownParaHtml(await resp.text());
    if (document.getElementById('ajuda-doc')) box.innerHTML = html;
  } catch {
    box.innerHTML = emptyState(ico('documento', { tam: 32 }), 'Tutorial ainda não disponível',
      'O texto de ajuda ainda não foi publicado.');
  }
  window.scrollTo(0, 0);
}

// Escolher a escola. Busca em vez de <select>: são 144.
async function paginaVerComo() {
  app.innerHTML = `
    <div class="page-head">
      <h1>Ver como escola</h1>
      <p>Veja o SATE exatamente como uma escola vê: as páginas, as viagens em que ela está envolvida e as regras que valem para ela.</p>
    </div>
    <div class="sate-ver-como">
      <div id="sim-busca">${loading()}</div>
      <p class="form-hint">É só visualização: enquanto durar, nada é gravado. Uma faixa no topo avisa, e "Voltar à minha visão" encerra.</p>
      ${simulando ? '<button type="button" class="btn-secundario" id="sim-encerrar">Voltar à minha visão</button>' : ''}
    </div>`;
  document.getElementById('sim-encerrar')?.addEventListener('click', () => mudarSimulacao(null));

  const unidades = await getUnidades().catch(() => []);
  const box = document.getElementById('sim-busca');
  if (!box) return;
  criarBuscaSelecao(box, {
    opcoes: unidades.map(u => ({ id: u.id, rotulo: u.nome, detalhe: u.segmento || '', busca: u.apelido || '' })),
    placeholder: 'Buscar a escola…',
    onChange: (id) => {
      const u = unidades.find(x => x.id === id);
      // Nome completo, não o apelido (spec 2026-10-03, D18): é o que a faixa
      // "Você está vendo o SATE como…" mostra, e apelido não identifica.
      if (u) mudarSimulacao({ id: u.id, nome: u.nome });
    },
  });
}

// Uma vez só, fora do login: sair e entrar de novo não pode empilhar
// ouvintes (a página desenharia duas vezes). Sem `estado`, não faz nada.
window.addEventListener('hashchange', rotear);

abrirPortao(app, {
  marca: MARCA,
  sistema: 'SATE',
  // "Meus dados" do menu de usuário leva ao FundHub, e só aparece para quem
  // também o usa e não é escola (ofereceFundHub). Atualizar recarrega a
  // página do SATE, não o roteador do FundHub (que aqui não roda). O rodapé
  // não leva o resumo de versão nem o link "Histórico completo" - eles
  // falam do FundHub.
  chrome: { base: './', aoAtualizar: () => rotear(), meusDados: ofereceFundHub, rodapeSate: true },
  aoEntrar: montarSate,
  aoSair: () => { estado = null; simulando = null; gravarSimulacao(null); notificacoes.parar(); limparToasts(); },
});
