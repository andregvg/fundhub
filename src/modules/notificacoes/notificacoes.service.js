// ============================================================
// FundHub — modules/notificacoes/notificacoes.service.js
// Sino no topo + toasts para novos pedidos e mudanças de status,
// via Supabase Realtime. O RLS garante que cada usuário só recebe
// eventos das linhas que já poderia ver.
//
// Serviço (sem tela): main.js chama iniciar() após o login e parar()
// no logout — o contrato de todo módulo com `servico: true`.
// ============================================================
import { subscribeSolicitacoes, STATUS } from '../sate/sate.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { getAtividades } from '../sate/atividades.model.js';
import { esc } from '../../shared/dom.js';
import { horaAgora } from '../../shared/format.js';
import { toast, limparToasts } from '../../shared/ui/toast.js';

const MAX_EVENTOS = 25;

let unsub = null, ligado = false;
let eventos = [], naoLidas = 0, aberto = false;
const nomeUnidade = {}, nomeAtividade = {};

export async function iniciar() {
  if (ligado) return;
  ligado = true;
  montarSino();

  // Mapas id → nome, para descrever o evento sem uma consulta por notificação.
  const [unidades, atividades] = await Promise.all([
    getUnidades().catch(() => []),
    getAtividades().catch(() => []),
  ]);
  unidades.forEach(u => { if (u.id) nomeUnidade[u.id] = u.apelido || u.nome; });
  atividades.forEach(a => { nomeAtividade[a.id] = a.nome; });

  unsub = subscribeSolicitacoes(aoEvento);
}

export function parar() {
  unsub?.();
  unsub = null; ligado = false; aberto = false;
  eventos = []; naoLidas = 0;
  document.querySelector('.bell-wrap')?.remove();
  limparToasts();
}

function aoEvento(payload) {
  const ev = descrever(payload);
  if (!ev) return;
  eventos.unshift(ev);
  if (eventos.length > MAX_EVENTOS) eventos.pop();
  if (aberto) renderLista();
  else { naoLidas++; atualizarBadge(); }
  toast(ev);
}

function descrever(p) {
  const row = p.new || p.old || {};
  const escola = nomeUnidade[row.unidade_id] || 'Escola';
  const atividade = nomeAtividade[row.atividade_id] || row.atividade_livre || 'atividade';

  let titulo, tipo;
  if (p.eventType === 'INSERT') { titulo = 'Nova solicitação'; tipo = 'novo'; }
  else if (p.eventType === 'DELETE') { titulo = 'Solicitação removida'; tipo = 'del'; }
  else {
    titulo = STATUS[row.status] || 'Atualizada';
    tipo = row.status === 'confirmado' ? 'ok' : (row.status === 'negado' ? 'no' : 'upd');
  }
  return { titulo, tipo, texto: `${escola} · ${atividade}`, hora: horaAgora() };
}

// ── Sino ─────────────────────────────────────────────────────
function montarSino() {
  const right = document.querySelector('.topbar-right');
  if (!right || right.querySelector('.bell-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'bell-wrap';
  wrap.innerHTML = `
    <button class="bell" id="bell" type="button" title="Notificações" aria-label="Notificações">
      🔔<span class="bell-badge" id="bell-badge" hidden>0</span>
    </button>
    <div class="bell-panel" id="bell-panel" hidden>
      <div class="bell-head">Notificações</div>
      <div id="bell-lista" class="bell-lista"></div>
    </div>`;
  right.insertBefore(wrap, right.firstChild);

  document.getElementById('bell').addEventListener('click', () => (aberto ? fechar() : abrir()));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) fechar(); });
}

function abrir() {
  aberto = true; naoLidas = 0; atualizarBadge();
  document.getElementById('bell-panel').hidden = false;
  renderLista();
}

function fechar() {
  aberto = false;
  const p = document.getElementById('bell-panel');
  if (p) p.hidden = true;
}

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
    ? eventos.map(e => `
      <div class="bell-item t-${e.tipo}">
        <div class="bi-tit">${esc(e.titulo)} <span class="bi-hora">${esc(e.hora)}</span></div>
        <div class="bi-txt">${esc(e.texto)}</div>
      </div>`).join('')
    : `<div class="bell-vazio">Sem notificações ainda.</div>`;
}
