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
import { moduloPorRota, caminhoDaRota, chavePerm, REDIRECIONAMENTOS } from './registry.js';
import { getPerfilAtual } from './perfil.js';
import { nivel, OCULTO } from './permissoes.js';
import { loading, emptyState } from '../shared/ui/feedback.js';
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
    } else if (nivel(chavePerm(mod)) === OCULTO) {
      // Mesma mensagem para "não existe" e "não pode": confirmar que o
      // módulo existe já é informação a mais para quem não tem acesso.
      outlet.innerHTML = emptyState(ico('restrito', { tam: 32 }), 'Acesso restrito',
        'Você não tem permissão para este módulo. Se precisa de acesso, fale com a Gerência de Ensino Fundamental.');
    } else {
      const nv = nivel(chavePerm(mod));
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

// A engrenagem (e, no Bloco B, o botão de ajuda) da barra de ações.
// `import()` dinâmico do painel: o kernel dispara, o módulo responde -
// mesma inversão de mod.load(). Módulo sem `config` não ganha botão, e
// sem botão a barra fica vazia (invisível, via .mod-acoes:empty).
async function montarAcoesModulo(mod, nv) {
  const barra = document.getElementById('mod-acoes');
  if (!barra || nv === OCULTO || typeof mod.config !== 'function') return;
  barra.insertAdjacentHTML('beforeend',
    `<button type="button" class="mod-acao" id="mod-cfg" aria-label="Configurações de ${esc(mod.nome)}">${ico('config')}</button>`);
  document.getElementById('mod-cfg').addEventListener('click', async () => {
    const { abrirPainelConfig } = await import('../modules/configuracoes/painel.js');
    abrirPainelConfig(mod);
  });
}

// Reexecuta a rota atual sem tocar no hash - o scroll, a aba e o
// filtro em que a pessoa estava sobrevivem. É o que o botão
// Atualizar faz depois de invalidar os caches.
export async function recarregarRota() {
  await route({ manterScroll: true });
}
