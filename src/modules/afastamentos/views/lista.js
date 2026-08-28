// ============================================================
// FundHub — afastamentos/views/lista.js  (visão Lista)
// A lista filtrada + as ações por linha: editar, cancelar, reativar,
// excluir e confirmar um afastamento importado da planilha.
// ============================================================
import {
  CORES_AFASTAMENTO, diasAfastamento,
  cancelarAfastamento, reativarAfastamento, excluirAfastamento, confirmarAfastamento,
} from '../afastamentos.model.js';
import { esc } from '../../../shared/dom.js';
import { fmtData } from '../../../shared/format.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

// `ctx`: { perfil, lista, abrirForm, carregar } — ver afastamentos.view.js § ctxAtual().
export function pintarLista(box, filtrada, ctx) {
  if (!filtrada.length) {
    box.innerHTML = emptyState(ico('afastamento', { tam: 32 }), 'Nenhum afastamento', 'Nada a exibir para o filtro atual.');
    return;
  }
  box.innerHTML = filtrada.map(a => item(a, ctx.perfil)).join('');
  ligarAcoes(box, ctx);
}

function item(a, perfil) {
  const cor = CORES_AFASTAMENTO[a.tipo] || 'var(--brand)';
  const nome = a.servidor?.nome || '—';
  const dias = diasAfastamento(a);
  const periodo = a.fim ? `${fmtData(a.inicio)} a ${fmtData(a.fim)}` : `desde ${fmtData(a.inicio)} (em aberto)`;
  const unidade = a.unidade?.apelido || a.unidade?.nome;
  const cancelado = a.status === 'cancelado';
  const importado = a.status === 'importado';
  const meta = [
    periodo,
    dias ? `${dias} dia${dias > 1 ? 's' : ''}` : '',
    unidade, a.processo ? `proc. ${a.processo}` : '',
    a.origem && a.origem !== 'manual' ? `via ${a.origem}` : '', a.motivo,
  ].filter(Boolean).map(esc).join(' · ');
  const acoes = perfil?.isAdmin ? `
    <div class="solic-acoes">
      ${cancelado ? `
        <button class="mini-btn ok" data-reativar="${a.id}" aria-label="Reativar">${ico('atualizar')}</button>
        <button class="mini-btn no" data-excluir="${a.id}" aria-label="Excluir definitivamente">${ico('excluir')}</button>`
      : `
        ${importado ? `<button class="mini-btn ok" data-confirmar="${a.id}" aria-label="Confirmar">${ico('ok')}</button>` : ''}
        <button class="mini-btn" data-edit="${a.id}" aria-label="Editar">${ico('editar')}</button>
        <button class="mini-btn no" data-cancelar="${a.id}" aria-label="Cancelar">${ico('fechar')}</button>`}
    </div>` : '';
  return `<div class="solic ${cancelado ? 'inativo' : ''}" style="border-left:3px solid ${esc(cor)}">
    <div class="solic-main">
      <div class="di-top"><b>${esc(nome)}</b>
        <span class="tag" style="color:${esc(cor)}">${esc(a.tipo)}</span>
        ${cancelado ? '<span class="tag eja">Cancelado</span>' : ''}
        ${importado ? '<span class="tag bus">Aguardando confirmação</span>' : ''}</div>
      <div class="di-meta">${meta}</div>
    </div>${acoes}</div>`;
}

function ligarAcoes(box, ctx) {
  const acha = (id) => ctx.lista.find(a => a.id === id);
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => ctx.abrirForm(acha(b.dataset.edit))));
  box.querySelectorAll('[data-cancelar]').forEach(b =>
    b.addEventListener('click', () => cancelar(acha(b.dataset.cancelar), ctx)));
  box.querySelectorAll('[data-reativar]').forEach(b =>
    b.addEventListener('click', () => reativar(acha(b.dataset.reativar), ctx)));
  box.querySelectorAll('[data-excluir]').forEach(b =>
    b.addEventListener('click', () => excluir(acha(b.dataset.excluir), ctx)));
  box.querySelectorAll('[data-confirmar]').forEach(b =>
    b.addEventListener('click', () => confirmarImportado(acha(b.dataset.confirmar), ctx)));
}

async function confirmarImportado(a, ctx) {
  if (!a) return;
  try { await confirmarAfastamento(a.id); ctx.carregar(); }
  catch (err) { toast({ titulo: 'Não foi possível confirmar', texto: err.message || String(err), tipo: 'no' }); }
}

async function cancelar(a, ctx) {
  if (!a) return;
  const ok = await confirmar(`Cancelar este afastamento de "${a.servidor?.nome || 'servidor'}"?`,
    { detalhe: 'Ele sai das visões ativas, mas o histórico é preservado.', textoOk: 'Cancelar afastamento', perigo: true });
  if (!ok) return;
  try { await cancelarAfastamento(a.id); ctx.carregar(); }
  catch (err) { toast({ titulo: 'Não foi possível cancelar', texto: err.message || String(err), tipo: 'no' }); }
}

async function reativar(a, ctx) {
  if (!a) return;
  try { await reativarAfastamento(a); ctx.carregar(); }
  catch (err) { toast({ titulo: 'Não foi possível reativar', texto: err.message || String(err), tipo: 'no' }); }
}

async function excluir(a, ctx) {
  if (!a) return;
  const ok = await confirmar('Excluir DEFINITIVAMENTE este afastamento?',
    { detalhe: 'Esta ação não pode ser desfeita (o cancelamento preserva o histórico).', textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try { await excluirAfastamento(a.id); ctx.carregar(); }
  catch (err) { toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'no' }); }
}
