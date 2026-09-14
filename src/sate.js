// ============================================================
// FundHub - sate.js  (bootstrap do SATE, página sate.html)
// Spec: docs/superpowers/specs/2026-09-13-sate-app-proprio-design.md
//
// O SATE com cara de sistema próprio: menu lateral com as páginas dele,
// cor configurável e marca do ônibus. Por baixo é o MESMO FundHub - mesmo
// portão (shell/portao.js), mesma conta, mesmas permissões, mesmo banco.
// Quem entra num entra no outro.
//
// É uma ENTRADA, como main.js: pode importar de qualquer lugar (R1). E é
// o controller desta página - um roteador de cinco rotas não justifica
// generalizar core/router.js, que conhece o registro de módulos inteiro.
// ============================================================
import { moduloPorId, nivelEfetivo } from './core/registry.js';
import { OCULTO, ESCRITA } from './core/permissoes.js';
import { abrirPortao } from './shell/portao.js';
import { montarNav, marcarNav, marcarAtualizacao } from './shell/chrome.js';
import { render, PAGINAS, PAGINA_INICIAL } from './modules/sate/sate.view.js';
import { corSate } from './modules/sate/sate.config.js';
import { pintarConfigDoModulo } from './modules/configuracoes/painel.js';
import { getUnidades } from './modules/escolas/escolas.model.js';
import { criarBuscaSelecao } from './shared/ui/busca-selecao.js';
import { emptyState, loading } from './shared/ui/feedback.js';
import { limparToasts } from './shared/ui/toast.js';
import { ico } from './shared/ui/icones.js';

const app = document.getElementById('app');
const MARCA = {
  ico: 'onibus',
  titulo: 'SA<span class="hub">TE</span>',
  sub: 'Transporte extraclasse da rede municipal. Entre com o e-mail institucional.',
};

let estado = null;   // { perfil, podeAprovar } depois da porta

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
    montarNav([{ itens: [linkFundHub()] }]);
    app.innerHTML = emptyState(ico('restrito', { tam: 32 }), 'O SATE não está liberado para você',
      'Se precisa pedir transporte para a sua escola, fale com a Gerência de Ensino Fundamental.');
    return;
  }

  estado = { perfil, podeAprovar: nv === ESCRITA };
  // Só quem aprova simula; um valor que sobrou de outra conta na mesma aba
  // não vale para quem não aprova.
  simulando = estado.podeAprovar ? lerSimulacao() : null;
  montarNav(gruposDoMenu());
  rotear().then(marcarAtualizacao);
}

// ── Menu ─────────────────────────────────────────────────────
function gruposDoMenu() {
  const aprovador = aprovadorEfetivo();
  const paginas = Object.entries(PAGINAS)
    .filter(([, p]) => !p.aprovador || aprovador)
    .map(([id, p]) => ({ rota: `#/${id}`, ico: p.ico, nome: p.rotulo }));
  const conta = [
    ...(aprovador ? [{ rota: '#/configuracoes', ico: 'config', nome: 'Configurações' }] : []),
    ...(estado.podeAprovar ? [{ rota: '#/ver-como', ico: 'escola', nome: 'Ver como escola' }] : []),
    // A ajuda é o tutorial do FundHub: um texto só, lido em qualquer página.
    { externo: './#/ajuda?m=sate', ico: 'ajuda', nome: 'Como usar o SATE' },
    linkFundHub(),
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
    opcoes: unidades.map(u => ({ id: u.id, rotulo: u.apelido || u.nome, detalhe: u.segmento || '', busca: u.nome })),
    placeholder: 'Buscar a escola…',
    onChange: (id) => {
      const u = unidades.find(x => x.id === id);
      if (u) mudarSimulacao({ id: u.id, nome: u.apelido || u.nome });
    },
  });
}

// Uma vez só, fora do login: sair e entrar de novo não pode empilhar
// ouvintes (a página desenharia duas vezes). Sem `estado`, não faz nada.
window.addEventListener('hashchange', rotear);

abrirPortao(app, {
  marca: MARCA,
  sistema: 'SATE',
  // "Meus dados" do menu de usuário leva ao FundHub; Atualizar recarrega
  // a página do SATE, não o roteador do FundHub (que aqui não roda).
  chrome: { base: './', aoAtualizar: () => rotear() },
  aoEntrar: montarSate,
  aoSair: () => { estado = null; simulando = null; gravarSimulacao(null); limparToasts(); },
});
