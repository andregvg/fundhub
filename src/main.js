// ============================================================
// FundHub — main.js  (bootstrap)
// Ordem: pílula de origem → gate de login → moldura (nav/usuário) →
// roteador → serviços de fundo (notificações).
// Fora daqui, ninguém decide quem entra: o gate é este arquivo, e a
// palavra final é sempre do RLS no Supabase.
// ============================================================
import { hasSupabase } from './core/supabase.js';
import { getUser, onAuthChange, renderLogin, isInstitucional, signOut } from './core/auth.js';
import { getPerfilAtual, limparPerfil } from './core/perfil.js';
import { startRouter } from './core/router.js';
import { servicos } from './core/registry.js';
import { montarNav, marcarNav, setChrome, pilulaOrigem, carimboRodape } from './shell/chrome.js';
import { limparToasts } from './shared/ui/toast.js';

const app = document.getElementById('app');
let montado = false;
const rodando = [];

async function montarApp(user) {
  const perfil = await getPerfilAtual().catch(() => null);
  setChrome(true, user, perfil);
  if (montado) return;
  montado = true;
  montarNav(perfil);
  startRouter(app, { onRoute: marcarNav });
  iniciarServicos();
}

function desmontarApp() {
  montado = false;
  pararServicos();
  limparPerfil();
  setChrome(false);
  renderLogin(app);
}

// Serviços de fundo declarados no registro (servico: true).
async function iniciarServicos() {
  if (!hasSupabase()) return;
  for (const m of servicos()) {
    try {
      const svc = await m.load();
      await svc.iniciar?.();
      rodando.push(svc);
    } catch (err) {
      console.warn(`[FundHub] serviço "${m.id}" não iniciou:`, err);
    }
  }
}

function pararServicos() {
  rodando.splice(0).forEach(svc => { try { svc.parar?.(); } catch (_) {} });
  limparToasts();
}

async function boot() {
  carimboRodape();
  pilulaOrigem();

  // Modo dev-local (sem Supabase configurado): sem gate, sem dados.
  if (!hasSupabase()) { montarApp(null); return; }

  onAuthChange(async (user) => {
    if (user && isInstitucional(user.email)) {
      // Limpa o hash de retorno do magic link / OAuth antes de rotear.
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname + '#/');
      }
      montarApp(user);
    } else if (user) {
      await signOut();          // logou fora do domínio institucional
    } else {
      desmontarApp();
    }
  });

  const user = await getUser();
  if (user && isInstitucional(user.email)) {
    montarApp(user);
  } else {
    if (user) await signOut();
    setChrome(false);
    renderLogin(app);
  }
}

boot();
