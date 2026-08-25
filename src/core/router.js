// ============================================================
// FundHub — core/router.js  (roteador por hash)
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

const ROTA_INICIAL = '#/dashboard';

let outlet = null;
let aoTrocarRota = () => {};

export function startRouter(el, { onRoute } = {}) {
  outlet = el;
  if (onRoute) aoTrocarRota = onRoute;
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
}

export async function route() {
  let hash = location.hash || '#/';
  const caminho = caminhoDaRota(hash);

  // Endereços antigos (#/gestores → #/servidores) continuam valendo.
  if (REDIRECIONAMENTOS[caminho]) {
    location.replace(REDIRECIONAMENTOS[caminho] + hash.slice(caminho.length));
    return;
  }
  // A raiz é a dashboard — sem trocar a URL, para "#/" continuar
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
      outlet.innerHTML = emptyState('🧭', 'Página não encontrada',
        'O endereço não corresponde a nenhum módulo. Use o menu à esquerda para navegar.');
    } else if (nivel(chavePerm(mod)) === OCULTO) {
      // Mesma mensagem para "não existe" e "não pode": confirmar que o
      // módulo existe já é informação a mais para quem não tem acesso.
      outlet.innerHTML = emptyState('🔒', 'Acesso restrito',
        'Você não tem permissão para este módulo. Se precisa de acesso, fale com a Gerência de Ensino Fundamental.');
    } else {
      const view = await mod.load();   // import() dinâmico: só agora a view é baixada
      await view.render(outlet, { perfil, nivel: nivel(chavePerm(mod)), params });
    }
  } catch (err) {
    outlet.innerHTML = emptyState('⚠️', 'Não foi possível abrir este módulo', String(err?.message || err));
  }

  aoTrocarRota(hash);
  window.scrollTo(0, 0);
}
