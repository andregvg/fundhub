// ============================================================
// FundHub — servidores/views/lista.js  (busca, filtros e cards)
// ============================================================
import { vinculosAbertos, cargoDe } from '../servidores.model.js';
import { rotulaCargo } from '../vinculos.model.js';
import { esc, norm } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';

// Vínculos abertos — é o que a tela mostra por padrão.
const vinculosVigentes = vinculosAbertos;

function combina(s, ctx) {
  const { filtro, seg, idxUnidades } = ctx;
  const vig = vinculosVigentes(s);
  if (filtro.papel && !vig.some(v => v.papel === filtro.papel)) return false;
  if (filtro.lotacao && (s.lotacao || 'escola') !== filtro.lotacao) return false;
  if (filtro.semVinculo && vig.length) return false;

  // Recorte por segmento: entra quem atua em ALGUMA escola do
  // segmento. Quem é da sede não tem escola — e por isso continua
  // visível, senão o filtro esconderia justamente a equipe da SME.
  if (seg && seg.selecionados().length && (s.lotacao || 'escola') !== 'sede') {
    const bate = vig.some(v => seg.combina(idxUnidades[v.unidade_id]));
    if (!bate) return false;
  }

  if (filtro.q) {
    const alvo = norm([
      s.nome, s.apelido, s.email, cargoDe(s), s.codigo_funcional,
      ...(s.telefones || []).map(t => t.numero),
      ...vig.map(v => `${v.unidade?.nome} ${v.unidade?.apelido} ${rotulaCargo(v.papel)}`),
    ].join(' '));
    if (!alvo.includes(norm(filtro.q))) return false;
  }
  return true;
}

// `ctx`: { perfil, filtro, seg, idxUnidades, abrirDetalhe } — ver servidores.view.js § ctxAtual().
export function pintarLista(box, lista, ctx) {
  const vis = lista.filter(s => combina(s, ctx)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('sv-count').textContent = `${vis.length} de ${lista.length} servidores`;

  if (!lista.length) {
    box.innerHTML = emptyState('👥', 'Nenhum servidor cadastrado',
      ctx.perfil?.isAdmin ? 'Clique em “Novo servidor” para começar.' : 'Peça a um administrador para cadastrar a equipe.');
    return;
  }
  box.innerHTML = vis.map(card).join('')
    || emptyState('🔎', 'Nenhum servidor encontrado', 'Ajuste a busca ou os filtros.');
  box.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => ctx.abrirDetalhe(c.dataset.id)));
}

function card(s) {
  const daSede = (s.lotacao || 'escola') === 'sede';
  const vig = vinculosVigentes(s);
  const papeis = [...new Set(vig.map(v => v.papel))]
    .map(p => `<span class="seg">${esc(rotulaCargo(p))}</span>`).join('');

  // Quem é da sede não tem vínculo com escola: mostrar "sem vínculo"
  // seria um falso alerta. O que identifica essa pessoa é o cargo.
  const lugares = daSede
    ? `<span class="tag">🏛 ${esc(cargoDe(s) || 'Sede da SME')}</span>`
    : vig.length
      ? vig.map(v => `<span class="tag">${esc(v.unidade?.apelido || v.unidade?.nome || '—')}</span>`).join('')
      : `<span class="tag eja">⚠️ Sem vínculo</span>`;

  // Nome completo em caixa alta (como nos sistemas oficiais); o
  // apelido logo abaixo, em caixa normal — não precisa de destaque.
  return `<article class="card" data-id="${esc(s.id)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(s.nome)}</h3>
      ${papeis}
    </div>
    ${s.apelido ? `<div class="apelido">${esc(s.apelido)}</div>` : ''}
    <div class="tags">${lugares}</div>
  </article>`;
}
