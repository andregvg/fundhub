// ============================================================
// FundHub — shell/chrome.js  (moldura do app: topo, navegação, rodapé)
// A barra de navegação é montada a partir do registro de módulos e
// depende do perfil (itens `admin` só aparecem para admin). Em telas
// pequenas ela vira um menu sanfonado (botão ☰).
//
// O canto superior direito tem só duas coisas: o sino (inserido pelo
// serviço de notificações) e o MENU DE USUÁRIO — um dropdown que reúne
// e-mail, papel, último acesso, origem dos dados e o botão Sair.
// ============================================================
import { modulosNav } from '../core/registry.js';
import { CONFIG } from '../core/config.js';
import { source } from '../core/supabase.js';
import { signOut } from '../core/auth.js';
import { limparPerfil, ultimoAcessoAnterior } from '../core/perfil.js';
import { esc } from '../shared/dom.js';
import { fmtDataHora } from '../shared/format.js';

const topnav = () => document.getElementById('topnav');
const toggle = () => document.getElementById('nav-toggle');

const PAPEL_ROTULO = { admin_sme: 'Administrador', transporte: 'Transporte', leitor: 'Leitor' };

// Ícone de usuário (Feather "user").
const USER_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// ── Navegação ────────────────────────────────────────────────
export function montarNav(perfil) {
  const itens = [`<a href="#/" data-nav="home">Início</a>`,
    ...modulosNav(perfil).map(m => `<a href="${m.rota}">${esc(m.navNome || m.nome)}</a>`)];
  topnav().innerHTML = itens.join('');
  topnav().addEventListener('click', (e) => { if (e.target.tagName === 'A') fecharMenu(); });

  toggle().addEventListener('click', () => {
    const aberto = document.body.classList.toggle('nav-open');
    toggle().setAttribute('aria-expanded', String(aberto));
  });
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.topnav') || e.target.closest('#nav-toggle')) return;
    fecharMenu();
  });
}

function fecharMenu() {
  document.body.classList.remove('nav-open');
  toggle()?.setAttribute('aria-expanded', 'false');
}

export function marcarNav(hash) {
  document.querySelectorAll('.topnav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === hash || (hash === '#/' && a.dataset.nav === 'home'));
  });
}

// ── Menu de usuário ──────────────────────────────────────────
export function setChrome(logado, user, perfil) {
  document.querySelector('.topbar').classList.toggle('anon', !logado);
  const right = document.querySelector('.topbar-right');
  let menu = right.querySelector('.user-menu');

  if (!logado) { menu?.remove(); fecharMenu(); return; }

  const email = user?.email || perfil?.email || '';
  const papel = PAPEL_ROTULO[perfil?.papel] || 'Leitor';
  const acessoAnterior = ultimoAcessoAnterior();
  const s = source();

  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <button class="user-btn" id="user-btn" type="button" aria-label="Menu do usuário"
              aria-haspopup="true" aria-expanded="false">${USER_SVG}</button>
      <div class="user-panel" id="user-panel" hidden>
        <div class="um-head">
          <span class="um-avatar">${USER_SVG}</span>
          <div class="um-id">
            <b class="um-email"></b>
            <span class="um-papel badge"></span>
          </div>
        </div>
        <div class="um-linha"><span class="um-lbl">Último acesso</span><span class="um-acesso"></span></div>
        <div class="um-linha"><span class="um-lbl">Dados</span><span class="um-origem pill"></span></div>
        <button class="um-sair" type="button">Sair</button>
      </div>`;
    right.appendChild(menu);

    const btn = menu.querySelector('#user-btn');
    const panel = menu.querySelector('#user-panel');
    btn.addEventListener('click', () => {
      const abrir = panel.hidden;
      panel.hidden = !abrir;
      btn.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    menu.querySelector('.um-sair').addEventListener('click', async () => {
      limparPerfil();
      await signOut();
    });
  }

  menu.querySelector('.um-email').textContent = email;
  menu.querySelector('.um-email').title = email;
  const bp = menu.querySelector('.um-papel');
  bp.textContent = papel;
  bp.classList.toggle('admin', Boolean(perfil?.isAdmin));
  menu.querySelector('.um-acesso').textContent = acessoAnterior ? fmtDataHora(acessoAnterior) : 'primeiro acesso';
  const org = menu.querySelector('.um-origem');
  org.textContent = s === 'supabase' ? '● Supabase' : '● dados locais';
  org.classList.toggle('live', s === 'supabase');
  org.classList.toggle('local', s !== 'supabase');
  menu.querySelector('.user-btn').classList.toggle('is-admin', Boolean(perfil?.isAdmin));
}

export function carimboRodape() {
  document.getElementById('build-info').textContent =
    `v${CONFIG.versao} · ${new Date().toLocaleDateString('pt-BR')}`;
}
