// ============================================================
// FundHub — shell/chrome.js  (moldura do app: topo, navegação, rodapé)
// A barra de navegação é montada a partir do registro de módulos e
// depende do perfil (itens `admin` só aparecem para admin).
// Em telas pequenas ela vira um menu sanfonado (botão ☰).
// ============================================================
import { modulosNav } from '../core/registry.js';
import { source } from '../core/supabase.js';
import { signOut } from '../core/auth.js';
import { limparPerfil } from '../core/perfil.js';
import { esc } from '../shared/dom.js';

const topnav = () => document.getElementById('topnav');
const toggle = () => document.getElementById('nav-toggle');

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
  // Toque fora do menu fecha (só relevante no mobile).
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

// Destaca o item da rota atual.
export function marcarNav(hash) {
  document.querySelectorAll('.topnav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === hash || (hash === '#/' && a.dataset.nav === 'home'));
  });
}

// ── Topo direito: origem dos dados e usuário ─────────────────
export function pilulaOrigem() {
  const el = document.getElementById('data-source');
  const s = source();
  el.textContent = s === 'supabase' ? '● Supabase' : '● dados locais';
  el.classList.remove('live', 'local');
  el.classList.add(s === 'supabase' ? 'live' : 'local');
}

export function setChrome(logado, user, perfil) {
  document.querySelector('.topbar').classList.toggle('anon', !logado);
  const right = document.querySelector('.topbar-right');
  let chip = right.querySelector('.user-chip');

  if (!logado) { chip?.remove(); fecharMenu(); return; }
  if (!user) return; // dev-local: sem sessão, sem chip

  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'user-chip';
    chip.innerHTML = `<span class="uemail"></span><button class="logout" type="button" title="Sair">Sair</button>`;
    chip.querySelector('.logout').addEventListener('click', async () => {
      limparPerfil();
      await signOut();
    });
    right.appendChild(chip);
  }
  chip.querySelector('.uemail').textContent = user.email;
  chip.querySelector('.uemail').title = perfil?.isAdmin ? 'Administrador SME' : (perfil?.papel || '');
  chip.classList.toggle('is-admin', Boolean(perfil?.isAdmin));
}

export function carimboRodape() {
  document.getElementById('build-info').textContent = new Date().toLocaleDateString('pt-BR');
}
