// ============================================================
// FundHub - core/router.js  (roteador por hash)
// Roteamento por hash (#/rota) para funcionar no GitHub Pages sob
// qualquer base path (/fundhub hoje, domínio próprio depois) sem
// precisar de reescrita no servidor.
//
// É aqui que mora o "controller" do MVC: resolve a rota → checa a
// permissão (mapa módulo → nível) → carrega a view sob demanda.
//
// A rota raiz é a DASHBOARD. A antiga home de tiles virou o módulo
// "Módulos" em #/modulos, alcançável pelo menu lateral.
// ============================================================
import { moduloPorRota, moduloPorId, podeAbrirFicha, caminhoDaRota, nivelEfetivo, REDIRECIONAMENTOS } from './registry.js';
import { getPerfilAtual } from './perfil.js';
import { OCULTO } from './permissoes.js';
import { registrarEventoUnico, EVENTO } from './eventos.js';
import { loading, emptyState, reportarErro } from '../shared/ui/feedback.js';
import { toast } from '../shared/ui/toast.js';
import { ico } from '../shared/ui/icones.js';
import { esc } from '../shared/dom.js';

const ROTA_INICIAL = '#/dashboard';

let outlet = null;
let aoTrocarRota = () => {};

// Ouvinte NOMEADO, module-level, e sempre a MESMA referência no
// remove e no add: se virasse uma arrow function recriada aqui
// dentro, o removeEventListener não casaria com o addEventListener
// anterior e o listener se acumularia a cada startRouter (cada troca
// de sessão). Também existe para não repassar o Event do hashchange
// para route() - route() nunca recebe scroll preservado por engano.
function aoHashChange() { route(); }

export function startRouter(el, { onRoute } = {}) {
  outlet = el;
  if (onRoute) aoTrocarRota = onRoute;
  window.removeEventListener('hashchange', aoHashChange);
  window.addEventListener('hashchange', aoHashChange);
  route();
}

// `manterScroll` existe só para o botão Atualizar: navegar por link
// (hashchange) sempre volta ao topo, que é o comportamento certo ao
// trocar de página. Só recarregarRota() pede para preservar.
export async function route({ manterScroll = false } = {}) {
  let hash = location.hash || '#/';
  const caminho = caminhoDaRota(hash);

  // Endereços antigos (#/gestores → #/servidores) continuam valendo.
  if (REDIRECIONAMENTOS[caminho]) {
    location.replace(REDIRECIONAMENTOS[caminho] + hash.slice(caminho.length));
    return;
  }
  // A raiz é a dashboard - sem trocar a URL, para "#/" continuar
  // sendo um endereço curto e válido que qualquer um pode digitar.
  if (caminho === '#/' || caminho === '#') hash = ROTA_INICIAL;

  outlet.innerHTML = loading();

  // `?unidade=…`, `?servidor=…`: filtro com que a tela abre. Fica na
  // URL para o link poder ser copiado e continuar significando o mesmo.
  const params = new URLSearchParams(hash.split('?')[1] || '');

  const perfil = await getPerfilAtual().catch(() => null);
  const mod = moduloPorRota(hash);

  try {
    if (!mod || !mod.ativo) {
      outlet.innerHTML = emptyState(ico('perdido', { tam: 32 }), 'Página não encontrada',
        'O endereço não corresponde a nenhum módulo. Use o menu à esquerda para navegar.');
    } else if (nivelEfetivo(mod) === OCULTO) {
      // Mesma mensagem para "não existe" e "não pode": confirmar que o
      // módulo existe já é informação a mais para quem não tem acesso.
      outlet.innerHTML = emptyState(ico('restrito', { tam: 32 }), 'Acesso restrito',
        'Você não tem permissão para este módulo. Se precisa de acesso, fale com a Gerência de Ensino Fundamental.');
      // Sinal de sondagem, para o admin ver na aba Atividade. Vai o id do
      // módulo, não o hash: a query (`?servidor=…`) carrega uuid de gente,
      // e o log é lido por todo admin (R7). Uma vez por módulo na sessão -
      // insistir no F5 não vira dez linhas.
      registrarEventoUnico(EVENTO.ACESSO_NEGADO, { modulo: mod.id },
        `${EVENTO.ACESSO_NEGADO}:${mod.id}`);
    } else if (mod.externo) {
      // Módulo com página própria (o SATE, em sate.html): o endereço antigo
      // `#/sate` - favorito, link colado - leva para lá em vez de quebrar.
      location.replace(mod.externo);
      return;
    } else {
      const nv = nivelEfetivo(mod);
      // Estrutura estável: a barra de ações é IRMÃ da view, não mãe. A
      // view continua recebendo um elemento e escrevendo o innerHTML nele;
      // .mod-wrap é o pai posicionado que ancora a barra no canto.
      outlet.innerHTML = `<div class="mod-wrap"><div class="mod-acoes" id="mod-acoes"></div><div id="mod-view"></div></div>`;
      await montarAcoesModulo(mod, nv);
      const view = await mod.load();   // import() dinâmico: só agora a view é baixada
      await view.render(document.getElementById('mod-view'), { perfil, nivel: nv, params });
    }
  } catch (err) {
    outlet.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível abrir este módulo', esc(String(err?.message || err)));
  }

  aoTrocarRota(hash);
  if (!manterScroll) window.scrollTo(0, 0);
}

// A barra de ações do módulo: ajuda à esquerda, engrenagem à direita -
// ordem fixa em toda tela. Ajuda NAVEGA (tutorial é texto para ler com
// calma); engrenagem abre modal (configurar é interrupção curta).
// `import()` dinâmico do painel: o kernel dispara, o módulo responde -
// mesma inversão de mod.load(). Sem ajuda e sem config, a barra fica
// vazia (invisível, via .mod-acoes:empty).
async function montarAcoesModulo(mod, nv) {
  const barra = document.getElementById('mod-acoes');
  if (!barra || nv === OCULTO) return;

  if (mod.doc === true) {
    barra.insertAdjacentHTML('beforeend',
      `<a class="mod-acao" href="#/ajuda?m=${encodeURIComponent(mod.id)}" aria-label="Ajuda de ${esc(mod.nome)}">${ico('ajuda')}</a>`);
  }

  if (typeof mod.config === 'function') {
    barra.insertAdjacentHTML('beforeend',
      `<button type="button" class="mod-acao" id="mod-cfg" aria-label="Configurações de ${esc(mod.nome)}">${ico('config')}</button>`);
    document.getElementById('mod-cfg').addEventListener('click', async () => {
      const { abrirPainelConfig } = await import('../modules/configuracoes/painel.js');
      abrirPainelConfig(mod);
    });
  }
}

// ── Ficha de outro módulo, por cima da tela atual ────────────
// A ficha da escola abre a do servidor e vice-versa, sem uma view importar
// a do outro (R2): o manifesto declara `ficha`, o controller chama, o
// módulo dono responde - a mesma inversão de `mod.load()` em route().
// Spec 2026-09-13-fichas-entre-modulos-design.md. `opts` segue como veio:
// { voltar, editar, aoMudar } - o contrato está no cabeçalho de cada `abrir`.
//
// NUNCA falha em silêncio. O GitHub Pages guarda cada arquivo na CDN por
// até 10 minutos, um a um: logo depois de um deploy, a ficha nova de um
// módulo pode carregar a ficha ANTIGA do outro, que ainda não exporta
// `abrir`. Sem esta guarda o clique simplesmente não fazia nada.
export async function abrirFicha(moduloId, id, opts = {}) {
  if (!podeAbrirFicha(moduloId)) return false;
  let ficha;
  try {
    ficha = await moduloPorId(moduloId).ficha();
  } catch (err) {
    console.error('[abrirFicha] não carregou a ficha de', moduloId, err);
  }
  if (typeof ficha?.abrir !== 'function') {
    toast({
      titulo: 'Não foi possível abrir a ficha',
      texto: 'O FundHub pode ter acabado de ser atualizado. Recarregue a página (Ctrl+Shift+R) e tente de novo.',
      tipo: 'erro',
    });
    return false;
  }
  try {
    await ficha.abrir(id, opts);
    return true;
  } catch (err) {
    console.error('[abrirFicha]', moduloId, err);
    reportarErro(err, { titulo: 'Não foi possível abrir a ficha' });
    return false;
  }
}

// Reexecuta a rota atual sem tocar no hash - o scroll, a aba e o
// filtro em que a pessoa estava sobrevivem. É o que o botão
// Atualizar faz depois de invalidar os caches.
export async function recarregarRota() {
  await route({ manterScroll: true });
}
