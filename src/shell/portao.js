// ============================================================
// FundHub - shell/portao.js  (o portão de entrada)
// Quem entra, quem espera e quem é mandado embora - comum ao FundHub
// (index.html → main.js) e ao SATE (sate.html → sate.js).
//
// Saiu de main.js em 13/09/2026, quando o SATE ganhou página própria. É o
// segundo caso, e a regra de três pediria esperar o terceiro - mas não
// aqui: duas cópias de um portão divergem com o tempo, e portão
// divergente é buraco. Esta é a lógica que decide se alguém vê dados.
//
// Há TRÊS desfechos para quem chega, e cada um tem a sua tela:
//   1. e-mail institucional + cadastrado  → `aoEntrar` (o app);
//   2. e-mail institucional, sem cadastro → "acesso pendente";
//   3. e-mail de fora do domínio          → login com o aviso.
// A palavra final continua sendo do RLS no Supabase.
// ============================================================
import { hasSupabase } from '../core/supabase.js';
import { getUser, onAuthChange, renderLogin, isInstitucional, signOut } from '../core/auth.js';
import { getPerfilAtual, limparPerfil, registrarAcesso } from '../core/perfil.js';
import { carregarConfiguracoes, limparConfiguracoes } from '../core/configuracoes.js';
import { setChrome, carimboRodape } from './chrome.js';
import { renderAcessoPendente } from './pendente.js';
import { limparCaches } from '../shared/cache.js';
import { ligarCamposDataHora } from '../shared/ui/campo-data-hora.js';

// `app`         o <main> onde login, pendência e o app são desenhados
// `marca`       a da tela de login (padrão: FundHub) - ver core/auth.js
// `sistema`     o nome na tela de acesso pendente
// `chrome`      opções de setChrome (ver shell/chrome.js)
// `aoEntrar`    ({ user, perfil }) - monta o app, UMA vez por login
// `aoSair`      desliga o que o app ligou (serviços, toasts)
export async function abrirPortao(app, { marca, sistema, chrome = {}, aoEntrar, aoSair = () => {} }) {
  let montado = false;

  async function entrar(user) {
    const [perfil] = await Promise.all([
      getPerfilAtual().catch(() => null),
      carregarConfiguracoes().catch(() => {}),
    ]);

    // Autenticou, domínio certo - mas não está na allowlist.
    if (perfil?.naoCadastrado) {
      setChrome(false);
      renderAcessoPendente(app, perfil.email, { sistema });
      return;
    }

    // Carimba o acesso e guarda o anterior (para o menu de usuário). Uma vez só.
    if (!montado) await registrarAcesso().catch(() => {});
    setChrome(true, user, perfil, chrome);
    if (montado) return;
    montado = true;
    await aoEntrar({ user, perfil });
  }

  function sair({ restrito = false } = {}) {
    montado = false;
    aoSair();
    limparCaches();  // Dados de outro usuário não podem atravessar o logout.
    limparConfiguracoes();
    limparPerfil();
    setChrome(false);
    renderLogin(app, { restrito, marca });
  }

  carimboRodape();
  ligarCamposDataHora();

  // Modo dev-local (sem Supabase configurado): sem gate, sem dados.
  if (!hasSupabase()) { entrar(null); return; }

  // Sinaliza que a última saída foi por domínio inválido, para o login
  // conseguir explicar. O signOut abaixo dispara o onAuthChange com
  // user=null, e é lá que a tela é desenhada.
  let saiuPorDominio = false;

  onAuthChange(async (user) => {
    if (user && isInstitucional(user.email)) {
      saiuPorDominio = false;
      // Limpa o retorno do magic link / OAuth antes de rotear. `pathname`
      // mantém a página - quem entrou pelo sate.html fica no sate.html.
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname + '#/');
      }
      entrar(user);
    } else if (user) {
      saiuPorDominio = true;
      await signOut();          // logou fora do domínio institucional
    } else {
      sair({ restrito: saiuPorDominio });
      saiuPorDominio = false;
    }
  });

  const user = await getUser();
  if (user && isInstitucional(user.email)) {
    entrar(user);
  } else {
    if (user) { saiuPorDominio = true; await signOut(); return; }
    setChrome(false);
    renderLogin(app, { marca });
  }
}
