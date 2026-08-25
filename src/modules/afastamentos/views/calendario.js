// ============================================================
// FundHub — afastamentos/views/calendario.js  (visão Calendário)
// Grade mensal com chips por dia — mesmo padrão do Apps Script
// afastamentos-gestores. Sobrepõe o evento do calendário escolar, o
// dia não letivo e o veto 🚫 de "não conceder afastamentos".
// ============================================================
import { CORES_AFASTAMENTO } from '../afastamentos.model.js';
import { esc } from '../../../shared/dom.js';
import { DOW, hojeISO } from '../../../shared/format.js';

// `ctx`: { perfil, ano, mes, diasCal, lista, abrirForm } — ver afastamentos.view.js § ctxAtual().
// `ativos` já vem filtrado (busca + segmento) pela casca.
export function pintarCalendario(box, ativos, ctx) {
  const { ano, mes, diasCal, perfil } = ctx;
  const primeiro = new Date(ano, mes - 1, 1).getDay();
  const totalDias = new Date(ano, mes, 0).getDate();
  const hoje = hojeISO();

  let cells = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) cells += `<div class="cal-cell vazio"></div>`;

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const doDia = ativos.filter(a => a.inicio <= iso && (!a.fim || a.fim >= iso));
    const chips = doDia.slice(0, 4).map(a => {
      const cor = CORES_AFASTAMENTO[a.tipo] || 'var(--brand)';
      const nome = a.servidor?.apelido || a.servidor?.nome || '—';
      const pend = a.status === 'importado' ? ' pendente' : '';
      return `<span class="af-chip${perfil?.isAdmin ? ' clicavel' : ''}${pend}" style="background:${esc(cor)}" data-id="${a.id}"
        title="${esc(a.tipo)} — ${esc(a.servidor?.nome || '')}${a.status === 'importado' ? ' (aguardando confirmação)' : ''}">${esc(nome)}</span>`;
    }).join('');
    const mais = doDia.length > 4 ? `<span class="af-mais">+${doDia.length - 4}</span>` : '';

    // Contexto do calendário escolar no mesmo dia (evento previsto, dia não
    // letivo e o marcador de "não conceder afastamentos").
    const d = diasCal[iso];
    const cls = ['cal-cell'];
    if (iso === hoje) cls.push('hoje');
    if (d && d.letivo === false) cls.push('nletivo');
    if (d?.bloqueia_afastamento) cls.push('bloq');
    cells += `<div class="${cls.join(' ')}">
      <div class="cal-num">${dia}${d?.bloqueia_afastamento ? ' <span class="af-veto" title="Não conceder afastamentos">🚫</span>' : ''}</div>
      ${d?.evento ? `<div class="cal-ev" title="${esc(d.evento)}">${esc(d.evento)}</div>` : ''}
      <div class="af-chips">${chips}${mais}</div>
    </div>`;
  }

  box.innerHTML = `<div class="cal-grid af-cal">${cells}</div>`;
  // Só admin edita: para os demais o chip é apenas informativo.
  if (!perfil?.isAdmin) return;
  box.querySelectorAll('.af-chip[data-id]').forEach(c =>
    c.addEventListener('click', () => {
      const a = ctx.lista.find(x => x.id === c.dataset.id);
      if (a) ctx.abrirForm(a);
    }));
}
