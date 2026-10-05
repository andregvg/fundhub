// ============================================================
// FundHub - servidores/views/lista.js  (busca, filtros e cards)
// ============================================================
import { vinculosAbertos, localDeTrabalhoDe, rotulaVinculo, cargoExibidoDe } from '../servidores.model.js';
import { rotulaCargo, FUNCOES } from '../vinculos.model.js';
import { esc, norm } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';
import { exibirTelefone, paraE164 } from '../../../shared/ui/phones.js';
import { eLocalInterno } from '../../escolas/escolas.model.js';
import { mostrarTelefonesNoCard, mostrarEmailNoCard } from '../servidores.config.js';

export function combina(s, ctx) {
  const { filtro, seg, idxUnidades, filtroUnidade } = ctx;
  const abertos = vinculosAbertos(s);

  // Recorte vindo da URL (?unidade=…): só quem está nesta unidade.
  if (filtroUnidade && !abertos.some(v => v.unidade_id === filtroUnidade)) return false;

  if (filtro.cargo && !abertos.some(v => rotulaCargo(v.papel) === filtro.cargo)) return false;
  if (filtro.local && !abertos.some(v => v.unidade_id === filtro.local)) return false;
  if (filtro.semVinculo && abertos.length) return false;

  // Recorte por segmento: entra quem atua em ALGUMA escola do segmento.
  // Quem NÃO tem âncora de segmento - sem vínculo aberto, ou só vínculo
  // com a sede / local interno da SME - passa em qualquer recorte:
  // senão o filtro esconderia a equipe da SME e todo servidor
  // recém-criado, que ainda não tem onde casar.
  if (seg && seg.selecionados().length) {
    const semAncora = !abertos.some(v => v.unidade?.tipo === 'escola' && v.unidade_id);
    if (!semAncora && !abertos.some(v => seg.combina(idxUnidades[v.unidade_id]))) return false;
  }

  if (filtro.q) {
    const alvo = norm([
      s.nome, s.apelido, s.email, s.codigo_funcional, localDeTrabalhoDe(s),
      ...(s.telefones || []).flatMap(t => [t.numero, exibirTelefone(t.numero)]),
      ...abertos.map(v => `${v.unidade?.nome} ${v.unidade?.apelido} ${rotulaCargo(v.papel)}`),
      // O que o card mostra ("Gestor(a) 1") e como a função se chama no
      // formulário ("Gestor 1"): quem busca por qualquer um dos dois acha.
      cargoExibidoDe(s),
      ...abertos.map(v => FUNCOES.find(f => f.valor === v.funcao)?.rotulo),
    ].join(' '));
    if (!alvo.includes(norm(filtro.q))) return false;
  }
  return true;
}

// `ctx`: { perfil, filtro, seg, idxUnidades, filtroUnidade, abrirDetalhe } - ver servidores.view.js § ctxAtual().
export function pintarLista(box, lista, ctx) {
  const vis = lista.filter(s => combina(s, ctx)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  document.getElementById('sv-count').textContent = `${vis.length} de ${lista.length} servidores`;

  if (!lista.length) {
    box.innerHTML = emptyState(ico('equipe', { tam: 32 }), 'Nenhum servidor cadastrado',
      ctx.perfil?.isAdmin ? 'Clique em “Novo servidor” para começar.' : 'Peça a um administrador para cadastrar a equipe.');
    return;
  }
  box.innerHTML = vis.map(s => card(s, ctx.podeEditar)).join('')
    || emptyState(ico('buscar', { tam: 32 }), 'Nenhum servidor encontrado', 'Ajuste a busca ou os filtros.');
  box.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', (e) => {
      if (e.target.closest('.card-editar')) { ctx.editarServidor(c.dataset.id); return; }
      if (e.target.closest('a, button')) return;   // telefone e e-mail do card são links próprios
      ctx.abrirDetalhe(c.dataset.id);
    }));
}

function card(s, podeEditar) {
  const abertos = vinculosAbertos(s);
  // Exibição: com a função ("Gestor(a) 1"). O filtro e a busca acima comparam o cargo puro.
  const cargos = [...new Set(abertos.map(v => rotulaVinculo({ ...v, papel: rotulaCargo(v.papel) })).filter(Boolean))]
    .map(c => `<span class="seg">${esc(c)}</span>`).join('');

  const lugares = abertos.length
    ? abertos.map(v => `<span class="tag">${v.unidade && eLocalInterno(v.unidade) ? ico('sede', { tam: 12 }) + ' ' : ''}${
        esc(v.unidade?.apelido || v.unidade?.nome || 'sem local')}</span>`).join('')
    : `<span class="tag eja">${ico('atencao', { tam: 12 })} Sem local de trabalho</span>`;

  const tel = mostrarTelefonesNoCard()
    ? (s.telefones || []).find(t => t.principal) || (s.telefones || [])[0]
    : null;

  // Nome completo em caixa alta (como nos sistemas oficiais) e, logo
  // abaixo, como falar com a pessoa: telefone principal e e-mail, cada um
  // ligado ou desligado na engrenagem. O apelido saiu do card (a busca
  // continua achando por ele), como no card da escola.
  const contato = [
    tel ? `<span>${ico('celular', { tam: 12 })} <a href="tel:${esc(paraE164(tel.numero) || tel.numero)}">${esc(exibirTelefone(tel.numero))}</a></span>` : '',
    mostrarEmailNoCard() && s.email ? `<span>${ico('email', { tam: 12 })} <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></span>` : '',
  ].join('');
  return `<article class="card" data-id="${esc(s.id)}" tabindex="0">
    <div class="card-top">
      <h3 class="nome-oficial">${esc(s.nome)}</h3>
      ${cargos}
      ${podeEditar ? `<button type="button" class="mini-btn card-editar" aria-label="Editar ${esc(s.nome)}" title="Editar servidor">${ico('editar')}</button>` : ''}
    </div>
    ${contato ? `<div class="card-contato">${contato}</div>` : ''}
    <div class="tags">${lugares}</div>
  </article>`;
}
