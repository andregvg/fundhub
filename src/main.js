// ============================================================
// FundHub — main.js  (bootstrap)
// Ordem: rodapé → gate de login → perfil/permissões → moldura
// (menu, usuário) → roteador → serviços de fundo (notificações).
// Fora daqui, ninguém decide quem entra: o gate é este arquivo, e a
// palavra final é sempre do RLS no Supabase.
//
// Há TRÊS desfechos possíveis para quem chega, e cada um tem a sua
// tela — antes os dois últimos caíam no mesmo silêncio confuso:
//   1. e-mail institucional + cadastrado  → o app;
//   2. e-mail institucional, sem cadastro → "acesso pendente";
//   3. e-mail de fora do domínio          → login com o aviso.
// ============================================================
import { hasSupabase } from './core/supabase.js';
import { getUser, onAuthChange, renderLogin, isInstitucional, signOut } from './core/auth.js';
import { getPerfilAtual, limparPerfil, registrarAcesso } from './core/perfil.js';
import { startRouter } from './core/router.js';
import { servicos } from './core/registry.js';
import { montarNav, marcarNav, setChrome, carimboRodape } from './shell/chrome.js';
import { renderAcessoPendente } from './shell/pendente.js';
import { limparToasts } from './shared/ui/toast.js';

const app = document.getElementById('app');
let montado = false;
const rodando = [];

async function montarApp(user) {
  const perfil = await getPerfilAtual().catch(() => null);

  // Autenticou, domínio certo — mas não está na allowlist. Antes o
  // perfil.js devolvia um "leitor" sintético e a pessoa navegava por
  // um app de listas vazias sem entender por quê.
  if (perfil?.naoCadastrado) {
    setChrome(false);
    renderAcessoPendente(app, perfil.email);
    return;
  }

  // Carimba o acesso e guarda o anterior (para o menu de usuário). Uma vez só.
  if (!montado) await registrarAcesso().catch(() => {});
  setChrome(true, user, perfil);
  if (montado) return;
  montado = true;
  montarNav();
  startRouter(app, { onRoute: marcarNav });
  iniciarServicos();
}

function desmontarApp({ restrito = false } = {}) {
  montado = false;
  pararServicos();
  limparPerfil();
  setChrome(false);
  renderLogin(app, { restrito });
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

  // Modo dev-local (sem Supabase configurado): sem gate, sem dados.
  if (!hasSupabase()) { montarApp(null); return; }

  // Sinaliza que a última saída foi por domínio inválido, para o
  // renderLogin conseguir explicar. O signOut abaixo dispara o
  // onAuthChange com user=null, e é lá que a tela é desenhada.
  let saiuPorDominio = false;

  onAuthChange(async (user) => {
    if (user && isInstitucional(user.email)) {
      saiuPorDominio = false;
      // Limpa o hash de retorno do magic link / OAuth antes de rotear.
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname + '#/');
      }
      montarApp(user);
    } else if (user) {
      saiuPorDominio = true;
      await signOut();          // logou fora do domínio institucional
    } else {
      desmontarApp({ restrito: saiuPorDominio });
      saiuPorDominio = false;
    }
  });

  const user = await getUser();
  if (user && isInstitucional(user.email)) {
    montarApp(user);
  } else {
    if (user) { saiuPorDominio = true; await signOut(); return; }
    setChrome(false);
    renderLogin(app);
  }
}

boot();
