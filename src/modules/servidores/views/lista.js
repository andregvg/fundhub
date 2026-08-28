// ============================================================
// FundHub — servidores/views/lista.js  (busca, filtros e cards)
// ============================================================
import { vinculosAbertos, lotacaoDe } from '../servidores.model.js';
import { rotulaCargo } from '../vinculos.model.js';
import { esc, norm } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

function combina(s, ctx) {
  const { filtro, seg, idxUnidades, filtroUnidade } = ctx;
  const abertos = vinculosAbertos(s);

  // Recorte vindo da URL (?unidade=…): só quem está nesta unidade.
  if (filtroUnidade && !abertos.some(v => v.unidade_id === filtroUnidade)) return false;

  if (filtro.cargo && !abertos.some(v => rotulaCargo(v.papel) === filtro.cargo)) return false;
  if (filtro.local && !abertos.some(v => v.unidade_id === filtro.local)) return false;
  if (filtro.semVinculo && abertos.length) return false;

  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. A sede não tem segmento — e por isso continua visível,
  // senão o filtro esconderia justamente a equipe da SME.
  if (seg && seg.selecionados().length) {
    const soSede = abertos.length && abertos.every(v => v.unidade?.tipo === 'sede');
    if (!soSede && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
  }

  if (filtro.q) {
    const alvo = norm([
      s.nome, s.apelido, s.email, s.codigo_funcional, lotacaoDe(s),
      ...(s.telefones || []).map(t => t.numero),
      ...abertos.map(v => `${v.unidade?.nome} ${v.unidade?.apelido} ${rotulaCargo(v.papel)}`),
    ].join(' '));
    if (!alvo.includes(norm(filtro.q))) return false;
  }
  return true;
}

// `ctx`: { perfil, filtro, seg, idxUnidades, filtroUnidade, abrirDetalhe } — ver servidores.view.js § ctxAtual().
export function pintarLista(box, lista, ctx) {
  const vis = lista.filter(s => combina(s, ctx)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('sv-count').textContent = `${vis.length} de ${lista.length} servidores`;

  if (!lista.length) {
    box.innerHTML = emptyState(ico('equipe', { tam: 32 }), 'Nenhum servidor cadastrado',
      ctx.perfil?.isAdmin ? 'Clique em “Novo servidor” para começar.' : 'Peça a um administrador para cadastrar a equipe.');
    return;
  }
  box.innerHTML = vis.map(card).join('')
    || emptyState(ico('buscar', { tam: 32 }), 'Nenhum servidor encontrado', 'Ajuste a busca ou os filtros.');
  box.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => ctx.abrirDetalhe(c.dataset.id)));
}

function card(s) {
  const abertos = vinculosAbertos(s);
  const cargos = [...new Set(abertos.map(v => rotulaCargo(v.papel)).filter(Boolean))]
    .map(c => `<span class="seg">${esc(c)}</span>`).join('');

  const lugares = abertos.length
    ? abertos.map(v => `<span class="tag">${v.unidade?.tipo === 'sede' ? ico('sede', { tam: 12 }) + ' ' : ''}${
        esc(v.unidade?.apelido || v.unidade?.nome || '—')}</span>`).join('')
    : `<span class="tag eja">${ico('atencao', { tam: 12 })} Sem vínculo</span>`;

  // Nome completo em caixa alta (como nos sistemas oficiais); o
  // apelido logo abaixo, em caixa normal — não precisa de destaque.
  return `<article class="card" data-id="${esc(s.id)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(s.nome)}</h3>
      ${cargos}
    </div>
    ${s.apelido ? `<div class="apelido">${esc(s.apelido)}</div>` : ''}
    <div class="tags">${lugares}</div>
  </article>`;
}
