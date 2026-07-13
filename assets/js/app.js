// ============================================================
// SMEHub — app.js  (roteador + hub)
// Roteamento por hash (#/rota) para funcionar no GitHub Pages sob
// qualquer base path (/fundhub hoje, domínio próprio depois) sem
// precisar de reescrita no servidor.
// ============================================================
import { renderEscolas } from './escolas.js';
import { source } from './data.js';

// Catálogo de módulos do hub (14 áreas do SMEHub).
const MODULOS = [
  { id: 'escolas',      ico: '🏫', nome: 'Escolas',                 desc: 'Cadastro das 144 unidades escolares.', rota: '#/escolas', ativo: true },
  { id: 'gestores',     ico: '👥', nome: 'Gestores & Coordenadores', desc: 'Equipe gestora, vínculos e contatos.' },
  { id: 'calendario',   ico: '📅', nome: 'Calendário Escolar',       desc: 'Calendário integrado ao Google Calendar.' },
  { id: 'horarios',     ico: '🕒', nome: 'Horários de Trabalho',     desc: 'Jornada da equipe gestora, validada por regra.' },
  { id: 'afastamentos', ico: '🌴', nome: 'Afastamentos',             desc: 'Férias, licenças e afastamentos.' },
  { id: 'sate',         ico: '🚌', nome: 'SATE · Transporte',        desc: 'Agendamento de transporte extraclasse.' },
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
      <h1>Bem-vindo ao SMEHub</h1>
      <p>Hub de aplicações gerenciais da Gerência de Ensino Fundamental. Comece pelo módulo
         <strong>Escolas</strong>; os demais entram em operação nas próximas etapas.</p>
    </section>
    <div class="tiles">${tiles}</div>
  `;
}

const routes = {
  '': renderHome,
  '#/': renderHome,
  '#/escolas': () => renderEscolas(app),
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
  el.classList.add(s === 'supabase' ? 'live' : 'local');
}

document.getElementById('build-info').textContent = new Date().toLocaleDateString('pt-BR');
setSourcePill();
window.addEventListener('hashchange', route);
route();
