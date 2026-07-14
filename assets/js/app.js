// ============================================================
// FundHub — app.js  (roteador + hub)
// Roteamento por hash (#/rota) para funcionar no GitHub Pages sob
// qualquer base path (/fundhub hoje, domínio próprio depois) sem
// precisar de reescrita no servidor.
// ============================================================
import { source, hasSupabase } from './core/supabase.js';
import { getUser, onAuthChange, renderLogin, isInstitucional, signOut } from './core/auth.js';
import { initNotifications, stopNotifications } from './tools/notifications.js';
import { renderDashboard } from './tools/dashboard.js';
import { renderEscolas } from './tools/escolas.js';
import { renderSate } from './tools/sate.js';
import { renderViagens } from './tools/viagens.js';
import { renderCalendario } from './tools/calendario.js';

// Catálogo de módulos do hub (14 áreas do FundHub).
const MODULOS = [
  { id: 'dashboard',    ico: '📊', nome: 'Dashboard do dia',        desc: 'Acompanhamento em tempo real.', rota: '#/dashboard', ativo: true },
  { id: 'escolas',      ico: '🏫', nome: 'Escolas',                 desc: 'Cadastro das 144 unidades escolares.', rota: '#/escolas', ativo: true },
  { id: 'gestores',     ico: '👥', nome: 'Gestores & Coordenadores', desc: 'Equipe gestora, vínculos e contatos.' },
  { id: 'calendario',   ico: '📅', nome: 'Calendário Escolar',       desc: 'Dias letivos, eventos e bloqueios de data.', rota: '#/calendario', ativo: true },
  { id: 'horarios',     ico: '🕒', nome: 'Horários de Trabalho',     desc: 'Jornada da equipe gestora, validada por regra.' },
  { id: 'afastamentos', ico: '🌴', nome: 'Afastamentos',             desc: 'Férias, licenças e afastamentos.' },
  { id: 'sate',         ico: '🚌', nome: 'SATE · Transporte',        desc: 'Agendamento de transporte extraclasse.', rota: '#/sate', ativo: true },
  { id: 'viagens',      ico: '📄', nome: 'Programação de Viagens',    desc: 'Viagens confirmadas para a empresa de transporte.', rota: '#/viagens', ativo: true },
  { id: 'projetos',     ico: '🔬', nome: 'Projetos & Pesquisas',     desc: 'Ofertas às escolas, anuências e interesse.' },
  { id: 'ocorrencias',  ico: '📞', nome: 'Ocorrências',              desc: 'Registro de atendimentos telefônicos.' },
  { id: 'atas',         ico: '📝', nome: 'Atas de Atendimento',      desc: 'Redação e impressão em papel timbrado.' },
  { id: 'visitas',      ico: '📋', nome: 'Relatórios de Visita',     desc: 'Visitas técnicas às escolas.' },
  { id: 'notificacoes', ico: '🔔', nome: 'Notificações',            desc: 'Alertas em tempo real do dia.' },
  { id: 'usuarios',     ico: '🔐', nome: 'Usuários & Acessos',       desc: 'Gestão de perfis e permissões.' },
];

const app = document.getElementById('app');

function renderHome() {
  const tiles = MODULOS.map(m => {
    const badge = m.ativo
      ? `<span class="badge ativo">ativo</span>`
      : `<span class="badge breve">em breve</span>`;
    const inner = `${badge}
      <div class="ico">${m.ico}</div>
      <h3>${m.nome}</h3>
      <p>${m.desc}</p>`;
    return m.ativo
      ? `<a class="tile" href="${m.rota}">${inner}</a>`
      : `<div class="tile soon">${inner}</div>`;
  }).join('');

  app.innerHTML = `
    <section class="hero">
      <h1>Bem-vindo ao FundHub</h1>
      <p>Hub de aplicações gerenciais da Gerência de Ensino Fundamental. Comece pelo módulo
         <strong>Escolas</strong>; os demais entram em operação nas próximas etapas.</p>
    </section>
    <div class="tiles">${tiles}</div>
  `;
}

const routes = {
  '': renderHome,
  '#/': renderHome,
  '#/dashboard': () => renderDashboard(app),
  '#/escolas': () => renderEscolas(app),
  '#/sate': () => renderSate(app),
  '#/viagens': () => renderViagens(app),
  '#/calendario': () => renderCalendario(app),
};

async function route() {
  const hash = location.hash || '#/';
  app.innerHTML = `<div class="loading">Carregando…</div>`;
  const handler = routes[hash] || renderHome;
  await handler();
  // marca nav ativa
  document.querySelectorAll('.topnav a').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === hash || (hash === '#/' && a.dataset.nav === 'home')));
  window.scrollTo(0, 0);
}

function setSourcePill() {
  const el = document.getElementById('data-source');
  const s = source();
  el.textContent = s === 'supabase' ? '● Supabase' : '● dados locais';
  el.classList.remove('live', 'local');
  el.classList.add(s === 'supabase' ? 'live' : 'local');
}

// ── Controle de sessão / gate ────────────────────────────────
function setChrome(logged, user) {
  document.querySelector('.topnav').style.visibility = logged ? 'visible' : 'hidden';
  const right = document.querySelector('.topbar-right');
  const chip = right.querySelector('.user-chip');
  if (logged && user) {
    if (!chip) {
      const el = document.createElement('div');
      el.className = 'user-chip';
      el.innerHTML = `<span class="uemail"></span><button class="logout" title="Sair">Sair</button>`;
      el.querySelector('.logout').addEventListener('click', async () => { await signOut(); });
      right.appendChild(el);
    }
    right.querySelector('.uemail').textContent = user.email;
  } else if (chip) {
    chip.remove();
    stopNotifications();
  }
}

function mountApp(user) {
  setChrome(true, user);
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
  if (hasSupabase()) initNotifications();
}

async function boot() {
  document.getElementById('build-info').textContent = new Date().toLocaleDateString('pt-BR');
  setSourcePill();

  // Modo dev local (sem Supabase configurado): sem gate.
  if (!hasSupabase()) { mountApp(null); return; }

  onAuthChange(async (user) => {
    if (user && isInstitucional(user.email)) {
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname + '#/');
      }
      mountApp(user);
    } else if (user) {
      await signOut();
    } else {
      setChrome(false);
      renderLogin(app);
    }
  });

  const user = await getUser();
  if (user && isInstitucional(user.email)) {
    mountApp(user);
  } else {
    if (user) await signOut();
    setChrome(false);
    renderLogin(app);
  }
}

boot();
