// ============================================================
// FundHub — shell/chrome.js  (moldura do app: topo, menu, rodapé)
// A navegação mora num MENU LATERAL à esquerda, montado a partir do
// registro de módulos e agrupado por seção (Módulos, Minha conta,
// Administração, Documentação). Os links do topo saíram: com o
// número de módulos que o hub tem hoje, a barra virava um amontoado.
//
// O estado aberto/fechado é LEMBRADO entre sessões (localStorage).
// No celular o menu é uma gaveta sobreposta e sempre começa fechado —
// lembrar "aberto" numa tela de 375px seria uma armadilha.
//
// O canto superior direito tem só duas coisas: o sino (inserido pelo
// serviço de notificações) e o MENU DE USUÁRIO — um dropdown que reúne
// e-mail, papel, último acesso, origem dos dados e o botão Sair.
// ============================================================
import { navPorGrupo } from '../core/registry.js';
import { CONFIG } from '../core/config.js';
import { source } from '../core/supabase.js';
import { signOut } from '../core/auth.js';
import { limparPerfil, ultimoAcessoAnterior } from '../core/perfil.js';
import { esc } from '../shared/dom.js';
import { fmtDataHora } from '../shared/format.js';

const CHAVE_MENU = 'fundhub:menu-aberto';
const consultaDesktop = () => window.matchMedia('(min-width: 1100px)');
const DESKTOP = () => consultaDesktop().matches;

const sidebar = () => document.getElementById('sidebar');
const fundo   = () => document.getElementById('sidebar-back');
const toggle  = () => document.getElementById('nav-toggle');

const PAPEL_ROTULO = {
  admin_sme: 'Administrador',
  equipe_sme: 'Equipe SME',
  transporte: 'Transporte',
  gestor_escolar: 'Gestor(a) escolar',
  leitor: 'Leitor',
};

// Ícone de usuário (Feather "user").
const USER_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// ── Menu lateral ─────────────────────────────────────────────
export function montarNav() {
  const grupos = navPorGrupo();
  sidebar().innerHTML = grupos.map(g => `
    <div class="nav-grupo">
      ${g.rotulo ? `<div class="nav-tit">${esc(g.rotulo)}</div>` : ''}
      ${g.itens.map(item).join('')}
    </div>`).join('');

  // Só no celular o clique num link fecha o menu: no desktop ele é
  // parte do layout e fechar a cada navegação seria irritante.
  sidebar().addEventListener('click', (e) => {
    if (e.target.closest('a') && !DESKTOP()) fecharMenu();
  });

  toggle().addEventListener('click', () => {
    if (document.body.classList.contains('menu-aberto')) fecharMenu();
    else abrirMenu();
  });
  fundo().addEventListener('click', () => fecharMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DESKTOP()) fecharMenu();
  });

  // Restaura a última escolha — mas só no desktop (ver cabeçalho).
  const lembrado = localStorage.getItem(CHAVE_MENU);
  if (DESKTOP() && lembrado !== 'false') abrirMenu({ lembrar: false });
  else fecharMenu({ lembrar: false });

  // Ao cruzar o corte de 1100px o menu troca de natureza (gaveta ↔
  // coluna): reavaliar evita ficar com a gaveta aberta no desktop.
  consultaDesktop().addEventListener('change', (ev) => {
    if (ev.matches && localStorage.getItem(CHAVE_MENU) !== 'false') abrirMenu({ lembrar: false });
    else fecharMenu({ lembrar: false });
  });
}

function item(m) {
  return `<a href="${m.rota}" data-rota="${m.rota}">
    <span class="nav-ico" aria-hidden="true">${m.ico}</span>
    <span class="nav-txt">${esc(m.navNome || m.nome)}</span>
  </a>`;
}

function abrirMenu({ lembrar = true } = {}) {
  document.body.classList.add('menu-aberto');
  toggle()?.setAttribute('aria-expanded', 'true');
  if (fundo()) fundo().hidden = DESKTOP();
  if (lembrar) localStorage.setItem(CHAVE_MENU, 'true');
}

function fecharMenu({ lembrar = true } = {}) {
  document.body.classList.remove('menu-aberto');
  toggle()?.setAttribute('aria-expanded', 'false');
  if (fundo()) fundo().hidden = true;
  if (lembrar) localStorage.setItem(CHAVE_MENU, 'false');
}

export function marcarNav(hash) {
  // "#/" é a dashboard: o item certo a destacar é o dela.
  const alvo = (hash === '#/' || hash === '#') ? '#/dashboard' : hash;
  document.querySelectorAll('.sidebar a').forEach(a =>
    a.classList.toggle('active', a.dataset.rota === alvo));
}

// ── Menu de usuário ──────────────────────────────────────────
export function setChrome(logado, user, perfil) {
  document.querySelector('.topbar').classList.toggle('anon', !logado);
  document.body.classList.toggle('sem-menu', !logado);
  const right = document.querySelector('.topbar-right');
  let menu = right.querySelector('.user-menu');

  if (!logado) { menu?.remove(); fecharMenu({ lembrar: false }); return; }

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
        <a class="um-link" href="#/meus-dados">Meus dados</a>
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
    menu.querySelector('.um-link').addEventListener('click', () => { panel.hidden = true; });
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
