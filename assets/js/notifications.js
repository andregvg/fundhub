// ============================================================
// FundHub — notifications.js  (notificações em tempo real)
// Sino no topo + balões (toasts) para novos pedidos e alterações de
// solicitações, via Supabase Realtime. O RLS garante que cada usuário
// só recebe eventos das linhas que pode ver.
// ============================================================
import { subscribeSolicitacoes, getUnidades, getAtividades } from './data.js';

const STATUS = { solicitado: 'Solicitado', em_analise: 'Em análise', aguardando_transporte_adaptado: 'Aguardando adaptado', confirmado: 'Confirmado', negado: 'Negado', cancelado: 'Cancelado' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let started = false, unsub = null;
let eventos = [], naoLidas = 0, aberto = false;
const uMap = {}, aMap = {};

export async function initNotifications() {
  if (started) return;
  started = true;
  montarSino();
  try {
    const [us, as] = await Promise.all([getUnidades().catch(() => []), getAtividades().catch(() => [])]);
    us.forEach(u => { if (u.id) uMap[u.id] = u.apelido || u.nome; });
    as.forEach(a => { aMap[a.id] = a.nome; });
  } catch (_) {}
  unsub = subscribeSolicitacoes(onEvent);
}

export function stopNotifications() {
  if (unsub) unsub();
  unsub = null; started = false; eventos = []; naoLidas = 0;
  document.querySelector('.bell-wrap')?.remove();
  document.getElementById('toasts')?.remove();
}

function onEvent(payload) {
  const ev = descrever(payload);
  if (!ev) return;
  eventos.unshift(ev);
  if (eventos.length > 25) eventos.pop();
  if (!aberto) { naoLidas++; atualizarBadge(); }
  if (aberto) renderLista();
  toast(ev);
}

function descrever(p) {
  const row = p.new || p.old || {};
  const escola = uMap[row.unidade_id] || 'Escola';
  const atividade = aMap[row.atividade_id] || row.atividade_livre || 'atividade';
  let titulo, tipo;
  if (p.eventType === 'INSERT') { titulo = 'Nova solicitação'; tipo = 'novo'; }
  else if (p.eventType === 'DELETE') { titulo = 'Solicitação removida'; tipo = 'del'; }
  else { titulo = STATUS[row.status] || 'Atualizada'; tipo = row.status === 'confirmado' ? 'ok' : (row.status === 'negado' ? 'no' : 'upd'); }
  return { titulo, tipo, texto: `${escola} · ${atividade}`, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
}

// ── UI ───────────────────────────────────────────────────────
function montarSino() {
  const right = document.querySelector('.topbar-right');
  if (!right || right.querySelector('.bell-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'bell-wrap';
  wrap.innerHTML = `
    <button class="bell" id="bell" title="Notificações">🔔<span class="bell-badge" id="bell-badge" hidden>0</span></button>
    <div class="bell-panel" id="bell-panel" hidden>
      <div class="bell-head">Notificações</div>
      <div id="bell-lista" class="bell-lista"></div>
    </div>`;
  right.insertBefore(wrap, right.firstChild);
  document.getElementById('bell').addEventListener('click', toggle);
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fechar(); });

  const toasts = document.createElement('div');
  toasts.id = 'toasts';
  document.body.appendChild(toasts);
}

function toggle() { aberto ? fechar() : abrir(); }
function abrir() {
  aberto = true; naoLidas = 0; atualizarBadge();
  document.getElementById('bell-panel').hidden = false;
  renderLista();
}
function fechar() { aberto = false; const p = document.getElementById('bell-panel'); if (p) p.hidden = true; }

function atualizarBadge() {
  const b = document.getElementById('bell-badge');
  if (!b) return;
  b.textContent = String(naoLidas);
  b.hidden = naoLidas === 0;
}

function renderLista() {
  const el = document.getElementById('bell-lista');
  if (!el) return;
  el.innerHTML = eventos.length
    ? eventos.map(e => `<div class="bell-item t-${e.tipo}">
        <div class="bi-tit">${esc(e.titulo)} <span class="bi-hora">${esc(e.hora)}</span></div>
        <div class="bi-txt">${esc(e.texto)}</div></div>`).join('')
    : `<div class="bell-vazio">Sem notificações ainda.</div>`;
}

function toast(e) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `toast t-${e.tipo}`;
  t.innerHTML = `<b>${esc(e.titulo)}</b><span>${esc(e.texto)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5000);
}
