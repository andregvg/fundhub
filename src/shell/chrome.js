// ============================================================
// FundHub - shell/chrome.js  (moldura do app: topo, menu, rodapé)
// A navegação mora num MENU LATERAL à esquerda, montado a partir do
// registro de módulos e agrupado por seção (Módulos, Minha conta,
// Administração, Documentação). Os links do topo saíram: com o
// número de módulos que o hub tem hoje, a barra virava um amontoado.
//
// O estado aberto/fechado é LEMBRADO entre sessões (localStorage).
// No celular o menu é uma gaveta sobreposta e sempre começa fechado -
// lembrar "aberto" numa tela de 375px seria uma armadilha.
//
// O canto superior direito tem só duas coisas: o sino (inserido pelo
// serviço de notificações) e o MENU DE USUÁRIO - um dropdown que reúne
// e-mail, papel, último acesso, origem dos dados e o botão Sair.
// ============================================================
import { navPorGrupo, caminhoDaRota } from '../core/registry.js';
import { recarregarRota } from '../core/router.js';
import { CONFIG } from '../core/config.js';
import { source } from '../core/supabase.js';
import { signOut } from '../core/auth.js';
import { limparPerfil, ultimoAcessoAnterior } from '../core/perfil.js';
import { esc } from '../shared/dom.js';
import { fmtDataHora, fmtData, hojeISO, agoraISO } from '../shared/format.js';
import { ico } from '../shared/ui/icones.js';
import { limparCaches } from '../shared/cache.js';
import { toast } from '../shared/ui/toast.js';

const CHAVE_MENU = 'fundhub:menu-aberto';
const consultaDesktop = () => window.matchMedia('(min-width: 1100px)');
const DESKTOP = () => consultaDesktop().matches;

const sidebar = () => document.getElementById('sidebar');
const fundo   = () => document.getElementById('sidebar-back');
const toggle  = () => document.getElementById('nav-toggle');

// Papéis reais (migration 021_permissoes_segmentos.sql, tabela `papel`).
const PAPEL_ROTULO = {
  admin_sme: 'Administrador',
  equipe_sme: 'Equipe SME',
  transporte: 'Transporte',
  gestor_escolar: 'Gestor(a) escolar',
  leitor: 'Leitor',
};

// ── Menu lateral ─────────────────────────────────────────────
export function montarNav() {
  const grupos = navPorGrupo();
  sidebar().innerHTML = grupos.map(g => `
    <div class="nav-grupo">
      ${g.rotulo ? `<div class="nav-tit">${esc(g.rotulo)}</div>` : ''}
      ${g.itens.map(item).join('')}
    </div>`).join('');

  toggle().innerHTML = ico('menu', { tam: 20 });

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

  // Restaura a última escolha - mas só no desktop (ver cabeçalho).
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
    <span class="nav-ico">${ico(m.ico, { tam: 18 })}</span>
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
  const caminho = caminhoDaRota(hash);
  // "#/" é a dashboard: o item certo a destacar é o dela.
  const alvo = (caminho === '#/' || caminho === '#') ? '#/dashboard' : caminho;
  document.querySelectorAll('.sidebar a').forEach(a =>
    a.classList.toggle('active', a.dataset.rota === alvo));
}

// ── Menu de usuário ──────────────────────────────────────────
export function setChrome(logado, user, perfil) {
  document.querySelector('.topbar').classList.toggle('anon', !logado);
  document.body.classList.toggle('sem-menu', !logado);
  const right = document.querySelector('.topbar-right');
  let menu = right.querySelector('.user-menu');

  if (!logado) { menu?.remove(); right.querySelector('.atualizar-wrap')?.remove(); fecharMenu({ lembrar: false }); return; }

  montarAtualizar(right);

  const email = user?.email || perfil?.email || '';
  const papel = PAPEL_ROTULO[perfil?.papel] || 'Leitor';
  const acessoAnterior = ultimoAcessoAnterior();
  const s = source();

  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <button class="topbar-acao user-btn" id="user-btn" type="button" aria-label="Menu do usuário"
              aria-haspopup="true" aria-expanded="false">${ico('servidor', { tam: 20 })}</button>
      <div class="user-panel" id="user-panel" hidden>
        <div class="um-head">
          <span class="um-avatar">${ico('servidor', { tam: 20 })}</span>
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

// ── Botão Atualizar ──────────────────────────────────────────
// Limpa os caches dos models e re-renderiza a rota atual - não é
// location.reload(): login, aba e filtro sobrevivem. O carimbo diz
// quando os dados vieram do banco pela última vez.
//
// marcarAtualizacao() NÃO é chamada aqui na montagem: o carimbo
// nasce vazio e só é preenchido depois que a primeira rota termina
// de renderizar (ver o onRoute passado a startRouter, em main.js).
// Chamar aqui gravaria a hora do relógio antes de qualquer dado ter
// chegado - a mentira que o comentário de marcarAtualizacao() abaixo
// descreve. Da segunda navegação em diante o onRoute não marca mais
// (cache de módulo sobrevive à troca de rota); só o clique abaixo
// volta a marcar, porque é o único caminho que chama limparCaches().
function montarAtualizar(right) {
  if (right.querySelector('.atualizar-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'atualizar-wrap';
  wrap.innerHTML = `
    <span class="atualizado" id="atualizado"></span>
    <button class="topbar-acao" id="btn-atualizar" type="button"
            aria-label="Atualizar os dados desta tela">${ico('atualizar', { tam: 18 })}</button>`;
  right.appendChild(wrap);

  wrap.querySelector('#btn-atualizar').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('girando');
    btn.disabled = true;
    try {
      limparCaches();
      await recarregarRota();
      // Chamada explícita: o onRoute do roteador só marca a primeira
      // rota depois do boot (ver main.js). Daqui em diante este clique
      // é o único caminho que volta a atualizar o carimbo.
      marcarAtualizacao();
    } catch (err) {
      toast({ titulo: 'Não foi possível atualizar', texto: err.message || String(err), tipo: 'erro' });
    } finally {
      btn.classList.remove('girando');
      btn.disabled = false;
    }
  });
}

// O carimbo diz quando estes dados vieram do banco. Se ele mostrasse
// a hora do relógio sem os caches terem sido invalidados, mentiria.
// Por isso só é chamada de um único lugar: o onRoute do roteador,
// depois que a view terminou de renderizar (ver main.js).
export function marcarAtualizacao() {
  const el = document.getElementById('atualizado');
  if (el) el.textContent = `atualizado ${fmtDataHora(agoraISO())}`;
}

// ── Carimbo da versão (rodapé) ───────────────────────────────
// O rodapé mostra SÓ a versão. Antes ele imprimia `hojeISO()` ao lado
// dela, o que fazia a data de hoje passar por "data da versão" - todo
// dia dizia uma coisa diferente sobre a mesma versão.
//
// A data de verdade vem de `versao.json`, um bilhete de ~600 bytes que
// o workflow de deploy escreve a partir do commit que subiu
// `CONFIG.versao` (ver .github/workflows/pages.yml). É buscado no
// PRIMEIRO hover/foco, nunca no boot: quem não passa o mouse não paga
// requisição nenhuma, e quem passa paga uma só por sessão.
//
// Sem o arquivo (dev-local, ou antes do primeiro deploy) a caixinha
// mostra só a versão. Degrada, não quebra.
const CHANGELOG_URL = 'https://github.com/andregvg/fundhub/blob/main/CHANGELOG.md';

let _carimbo;            // undefined = não buscado ainda; null = indisponível

async function lerCarimbo() {
  if (_carimbo !== undefined) return _carimbo;
  _carimbo = null;                                  // não tenta de novo se falhar
  try {
    // Relativo ao documento SEM o hash: com `#/rota` no fim, uma URL
    // sem barra final resolveria para o diretório pai (a raiz), e o
    // /dev/ acabaria lendo o carimbo da produção.
    const alvo = new URL('versao.json', location.href.split('#')[0]);
    const r = await fetch(alvo, { cache: 'no-cache' });
    if (r.ok) _carimbo = await r.json();
  } catch (_) { /* sem carimbo: a caixinha mostra só a versão */ }
  return _carimbo;
}

function cartaoHtml(c) {
  const linhas = (c?.resumo || []).map(t => `<li>${esc(t)}</li>`).join('');
  return `
    <b class="bc-versao">Versão ${esc(CONFIG.versao)}</b>
    <span class="bc-data">${c?.data
      ? `no ar desde ${esc(fmtDataHora(c.data))}`
      : '<i>data indisponível fora do site publicado</i>'}</span>
    ${linhas ? `<ul class="bc-resumo">${linhas}</ul>` : ''}
    <a class="bc-link" href="${CHANGELOG_URL}" target="_blank" rel="noopener noreferrer">
      ${ico('externo', { tam: 13 })} Histórico completo</a>`;
}

export function carimboRodape() {
  // A data de hoje, no canto oposto. Ela é só "hoje" - longe da versão,
  // não há como confundi-la com a data em que a versão entrou em vigor,
  // que era o defeito de quando as duas andavam coladas.
  const hoje = document.getElementById('hoje-info');
  if (hoje) hoje.textContent = fmtData(hojeISO());

  const btn = document.getElementById('build-info');
  const card = document.getElementById('build-card');
  if (!btn || !card) return;

  btn.textContent = `v${CONFIG.versao}`;
  btn.setAttribute('aria-label', `Versão ${CONFIG.versao} - ver o que mudou`);

  let pintado = false;
  const abrir = async () => {
    if (!pintado) { card.innerHTML = cartaoHtml(await lerCarimbo()); pintado = true; }
    card.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };
  const fechar = () => { card.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  // Hover para quem usa mouse, foco para quem usa teclado, clique para
  // quem está no celular - onde hover não existe.
  const wrap = document.getElementById('build-wrap');
  wrap.addEventListener('mouseenter', abrir);
  wrap.addEventListener('mouseleave', fechar);
  btn.addEventListener('focus', abrir);
  btn.addEventListener('click', () => (card.hidden ? abrir() : fechar()));
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget)) fechar();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}
