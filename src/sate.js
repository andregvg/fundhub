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
import { emptyState, loading } from './shared/ui/feedback.js';
import { limparToasts } from './shared/ui/toast.js';
import { ico } from './shared/ui/icones.js';

const app = document.getElementById('app');
const MARCA = {
  ico: 'onibus',
  titulo: 'SA<span class="hub">TE</span>',
  sub: 'Transporte extraclasse da rede municipal. Entre com o e-mail institucional.',
};

let estado = null;   // { perfil, aprovador } depois da porta

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

  estado = { perfil, aprovador: nv === ESCRITA };
  montarNav(gruposDoMenu(estado.aprovador));
  rotear().then(marcarAtualizacao);
}

// ── Menu ─────────────────────────────────────────────────────
function gruposDoMenu(aprovador) {
  const paginas = Object.entries(PAGINAS)
    .filter(([, p]) => !p.aprovador || aprovador)
    .map(([id, p]) => ({ rota: `#/${id}`, ico: p.ico, nome: p.rotulo }));
  const conta = [
    ...(aprovador ? [{ rota: '#/configuracoes', ico: 'config', nome: 'Configurações' }] : []),
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

  if (id === 'configuracoes' && estado.aprovador) {
    marcarNav('#/configuracoes');
    return paginaConfiguracoes();
  }
  // Página inexistente ou de aprovador para quem não aprova: a inicial.
  // Sem "acesso restrito" aqui - o menu nem oferece o link, e o RLS barra
  // o dado de qualquer jeito (R6).
  const pagina = PAGINAS[id];
  if (!pagina || (pagina.aprovador && !estado.aprovador)) {
    if (location.hash !== `#/${PAGINA_INICIAL}`) { location.replace(`#/${PAGINA_INICIAL}`); return; }
  }

  aplicarCor();   // quem voltou das Configurações pode ter trocado a cor
  marcarNav(`#/${PAGINAS[id] ? id : PAGINA_INICIAL}`);
  await render(app, {
    perfil: estado.perfil, aprovador: estado.aprovador, id: PAGINAS[id] ? id : PAGINA_INICIAL,
    irPara: (nova) => { location.hash = `#/${nova}`; },
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
  aoSair: () => { estado = null; limparToasts(); },
});
