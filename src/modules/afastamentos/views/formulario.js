// ============================================================
// FundHub — afastamentos/views/formulario.js  (criar/editar)
// Gaveta de criação e edição. Antes de salvar, integra com o
// Calendário: avisa (não bloqueia) se o período cai em dia marcado
// "não conceder afastamentos" — o admin decide se registra mesmo assim.
// ============================================================
import { TIPOS_AFASTAMENTO, diasAfastamento, criarAfastamento, atualizarAfastamento } from '../afastamentos.model.js';
import { getDiasBloqueiamAfastamento } from '../../calendario/calendario.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

// `ctx`: { servidores, unidades, carregar } — ver afastamentos.view.js § ctxAtual().
export function abrirForm(a, ctx) {
  const novo = !a;
  const optsServ = ctx.servidores.map(s =>
    `<option value="${s.id}" ${a?.servidor_id === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('');
  const optsUni = ctx.unidades.map(u =>
    `<option value="${u.id}" ${a?.unidade_id === u.id ? 'selected' : ''}>${esc(u.apelido || u.nome)}</option>`).join('');
  const optsTipo = TIPOS_AFASTAMENTO.map(t =>
    `<option ${a?.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo afastamento' : 'Editar afastamento')}
    <div class="drawer-body">
      <form id="af-form" class="esc-form">
        <label>Servidor <select id="f-serv" required><option value="">Selecione…</option>${optsServ}</select></label>
        <label>Tipo <select id="f-tipo" required>${optsTipo}</select></label>
        <div class="esc-row">
          <label>Início <input id="f-ini" type="date" value="${esc(a?.inicio || '')}" required /></label>
          <label>Fim (em aberto se vazio) <input id="f-fim" type="date" value="${esc(a?.fim || '')}" /></label>
        </div>
        <p class="form-hint" id="f-dias"></p>
        <label>Unidade (opcional) <select id="f-uni"><option value="">—</option>${optsUni}</select></label>
        <label>Processo (opcional) <input id="f-proc" value="${esc(a?.processo || '')}" placeholder="Nº do processo" /></label>
        <label>Motivo / observação <input id="f-motivo" value="${esc(a?.motivo || '')}" /></label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  const upDias = () => {
    const ini = document.getElementById('f-ini').value;
    const fim = document.getElementById('f-fim').value;
    const d = diasAfastamento({ inicio: ini, fim });
    document.getElementById('f-dias').textContent = d ? `${d} dia${d > 1 ? 's' : ''}` : (ini ? 'Em aberto' : '');
  };
  document.getElementById('f-ini').addEventListener('input', upDias);
  document.getElementById('f-fim').addEventListener('input', upDias);
  upDias();
  document.getElementById('af-form').addEventListener('submit', (e) => salvar(e, a, ctx));
}

async function salvar(e, a, ctx) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const payload = {
    servidor_id: document.getElementById('f-serv').value || null,
    tipo: document.getElementById('f-tipo').value,
    inicio: document.getElementById('f-ini').value,
    fim: document.getElementById('f-fim').value || null,
    unidade_id: document.getElementById('f-uni').value || null,
    processo: document.getElementById('f-proc').value.trim() || null,
    motivo: document.getElementById('f-motivo').value.trim() || null,
  };
  if (!payload.servidor_id || !payload.inicio) return falha(msg, 'Informe servidor e data de início.');
  if (payload.fim && payload.fim < payload.inicio) return falha(msg, 'A data fim não pode ser antes do início.');

  // Integração com o Calendário: avisa (não bloqueia) se o período cai em
  // dia marcado "não conceder afastamentos".
  try {
    const bloq = await getDiasBloqueiamAfastamento(payload.inicio, payload.fim || payload.inicio);
    if (bloq.length) {
      const quais = bloq.slice(0, 3).map(d => fmtData(d.data) + (d.evento ? ` (${d.evento})` : '')).join(', ');
      const ok = await confirmar('Registrar mesmo assim?', {
        detalhe: `O calendário marca ${bloq.length} dia(s) como "não conceder afastamentos": ${quais}${bloq.length > 3 ? '…' : ''}.`,
      });
      if (!ok) return;
    }
  } catch (_) { /* sem calendário, segue */ }

  const nomeServ = ctx.servidores.find(s => s.id === payload.servidor_id)?.nome || '';

  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (a) await atualizarAfastamento(a.id, payload);
    else await criarAfastamento(payload);
    fecharDrawer(); ctx.carregar();
    toast({ titulo: a ? 'Afastamento atualizado' : 'Afastamento lançado', texto: nomeServ, tipo: 'sucesso' });
  } catch (err) {
    // Erro de gravação é resultado da ação, não do campo: vai de
    // toast, que sobrevive à gaveta fechar.
    toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
    btn.disabled = false; btn.textContent = a ? 'Salvar' : 'Criar';
  }
}
