// ============================================================
// FundHub — core/router.js  (roteador por hash)
// Roteamento por hash (#/rota) para funcionar no GitHub Pages sob
// qualquer base path (/fundhub hoje, domínio próprio depois) sem
// precisar de reescrita no servidor.
//
// É aqui que mora o "controller" do MVC: resolve a rota → checa a
// permissão (manifesto `admin`) → carrega a view sob demanda → monta.
// ============================================================
import { moduloPorRota } from './registry.js';
import { getPerfilAtual } from './perfil.js';
import { renderHome } from '../shell/home.js';
import { loading, emptyState } from '../shared/ui/feedback.js';

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
  const hash = location.hash || '#/';
  outlet.innerHTML = loading();

  const perfil = await getPerfilAtual().catch(() => null);
  const mod = moduloPorRota(hash);

  try {
    if (!mod || !mod.ativo) {
      renderHome(outlet, perfil);
    } else if (mod.admin && !perfil?.isAdmin) {
      outlet.innerHTML = emptyState('🔒', 'Acesso restrito',
        'Este módulo é exclusivo dos administradores da SME. Se você precisa de acesso, fale com a Gerência de Ensino Fundamental.');
    } else {
      const view = await mod.load();   // import() dinâmico: só agora a view é baixada
      await view.render(outlet, { perfil });
    }
  } catch (err) {
    outlet.innerHTML = emptyState('⚠️', 'Não foi possível abrir este módulo', String(err?.message || err));
  }

  aoTrocarRota(hash);
  window.scrollTo(0, 0);
}
