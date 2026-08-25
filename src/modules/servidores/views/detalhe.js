// ============================================================
// FundHub — servidores/views/detalhe.js  (gaveta de detalhe + vínculos)
// A gaveta é o centro do módulo: abre a pessoa e, dentro dela, os
// vínculos com escolas — que é onde a escola de fato entra na história.
// ============================================================
import { PAPEIS, ANO_LETIVO, rotulaPapel, rotulaLotacao, criarVinculo, encerrarVinculo, excluirVinculo } from '../servidores.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { hojeISO, fmtData } from '../../../shared/format.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { telefonesTexto } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

// `ctx`: { lista, unidades, podeEditar, recarregar, abrirFormServidor, removerServidor }
// — ver servidores.view.js § ctxAtual().
export function detalhe(id, ctx) {
  const s = ctx.lista.find(x => x.id === id);
  if (!s) return;

  const campo = (l, v) => v ? `<div class="field"><div class="lbl">${l}</div><div class="val">${v}</div></div>` : '';
  const acoes = ctx.podeEditar ? `
    <div class="drawer-acoes">
      <button class="mini-btn" id="sv-edit">✎ Editar</button>
      <button class="mini-btn no" id="sv-del">🗑 Excluir</button>
    </div>` : '';

  abrirDrawer(`
    ${drawerHead(`<span class="nome-oficial">${esc(s.nome)}</span>`, esc(s.apelido || ''))}
    <div class="drawer-body">
      ${acoes}
      ${campo('Lotação', esc(rotulaLotacao(s.lotacao)) + (s.cargo ? ` · ${esc(s.cargo)}` : ''))}
      ${campo('E-mail', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
      ${campo('Telefones', (s.telefones || []).length ? telefonesTexto(s.telefones) : '')}
      ${campo('Código funcional', esc(s.codigo_funcional || ''))}
      ${campo('CPF', esc(s.cpf || ''))}
      ${campo('RG', esc(s.rg || ''))}
      ${campo('Ingresso na rede', s.inicio_rede ? esc(fmtData(s.inicio_rede)) : '')}
      <hr class="sep" />
      <div class="vinc-head">
        <div class="field" style="margin:0"><div class="lbl">Vínculos com escolas</div></div>
        ${ctx.podeEditar ? `<button class="mini-btn" id="sv-vinc">+ Vincular a uma escola</button>` : ''}
      </div>
      <div class="people" id="sv-vinculos">${listaVinculos(s, ctx.podeEditar)}</div>
    </div>`);

  if (!ctx.podeEditar) return;
  document.getElementById('sv-edit').addEventListener('click', () => ctx.abrirFormServidor(s));
  document.getElementById('sv-del').addEventListener('click', () => ctx.removerServidor(s));
  document.getElementById('sv-vinc').addEventListener('click', () => formVinculo(s, ctx));
  ligarAcoesVinculo(s, ctx);
}

function listaVinculos(s, podeEditar) {
  if (!s.vinculos.length) return '<p class="count">Nenhum vínculo cadastrado.</p>';

  // Vigentes primeiro; o histórico fica abaixo, apagado.
  const ordenados = [...s.vinculos].sort((a, b) =>
    (b.ativo - a.ativo) || (b.ano - a.ano) || String(a.papel).localeCompare(b.papel));

  return ordenados.map(v => {
    const encerrado = !v.ativo || v.ano !== ANO_LETIVO;
    const periodo = [
      v.ingresso ? `desde ${fmtData(v.ingresso)}` : '',
      v.fim ? `até ${fmtData(v.fim)}` : '',
    ].filter(Boolean).join(' · ');
    const acoes = podeEditar ? `
      <div class="vinc-acoes">
        ${v.ativo ? `<button class="mini-btn" data-encerrar="${v.id}">Encerrar</button>` : ''}
        <button class="mini-btn no" data-del-vinc="${v.id}" aria-label="Excluir vínculo">🗑</button>
      </div>` : '';
    return `<div class="person ${encerrado ? 'inativo' : ''}">
      <div class="role">${esc(rotulaPapel(v.papel))} · ${esc(v.ano)}${v.ativo ? '' : ' · encerrado'}</div>
      <div class="pname">${esc(v.unidade?.nome || '—')}</div>
      <div class="pmeta">
        ${periodo ? `<span>${esc(periodo)}</span>` : ''}
        ${acoes}
      </div>
    </div>`;
  }).join('');
}

function ligarAcoesVinculo(s, ctx) {
  const box = document.getElementById('sv-vinculos');
  box.querySelectorAll('[data-encerrar]').forEach(b =>
    b.addEventListener('click', () => encerrar(s, b.dataset.encerrar, ctx)));
  box.querySelectorAll('[data-del-vinc]').forEach(b =>
    b.addEventListener('click', () => removerVinculo(s, b.dataset.delVinc, ctx)));
}

// ── Formulário: vínculo ──────────────────────────────────────
function formVinculo(s, ctx) {
  const opts = [...ctx.unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead('Vincular a uma escola', esc(s.nome))}
    <div class="drawer-body">
      <form id="vc-form" class="esc-form">
        <label>Escola <select id="v-uni" required><option value="">Selecione…</option>${opts}</select></label>
        <label>Papel <select id="v-papel" required>
          ${PAPEIS.map(p => `<option value="${p}">${esc(rotulaPapel(p))}</option>`).join('')}
        </select></label>
        <div class="esc-row">
          <label>Ano letivo <input id="v-ano" type="number" inputmode="numeric" value="${ANO_LETIVO}" required /></label>
          <label>Data de ingresso <input id="v-ingresso" type="date" /></label>
        </div>
        <div class="form-foot">
          <span id="v-msg" class="auth-msg"></span>
          <button type="submit" id="v-save">Vincular</button>
        </div>
      </form>
    </div>`);

  document.getElementById('vc-form').addEventListener('submit', (e) => salvarVinculo(e, s, ctx));
}

async function salvarVinculo(e, s, ctx) {
  e.preventDefault();
  const msg = document.getElementById('v-msg'); msg.className = 'auth-msg';
  const unidade_id = document.getElementById('v-uni').value;
  const ano = parseInt(document.getElementById('v-ano').value, 10);
  if (!unidade_id) return falha(msg, 'Selecione a escola.');
  if (!(ano > 2000)) return falha(msg, 'Informe um ano letivo válido.');

  const btn = document.getElementById('v-save'); btn.disabled = true; btn.textContent = 'Vinculando…';
  try {
    await criarVinculo({
      servidor_id: s.id,
      unidade_id,
      papel: document.getElementById('v-papel').value,
      ano,
      ingresso: document.getElementById('v-ingresso').value || null,
    });
    const novoCtx = await ctx.recarregar();
    detalhe(s.id, novoCtx);   // volta ao detalhe, já com o vínculo novo
  } catch (err) {
    falha(msg, err.message || String(err));
    btn.disabled = false; btn.textContent = 'Vincular';
  }
}

async function encerrar(s, vinculoId, ctx) {
  const fim = prompt('Data de encerramento do vínculo (AAAA-MM-DD):', hojeISO());
  if (!fim) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return toast({ titulo: 'Data inválida', texto: 'Use o formato AAAA-MM-DD.', tipo: 'no' });
  }
  try {
    await encerrarVinculo(vinculoId, fim);
    const novoCtx = await ctx.recarregar();
    detalhe(s.id, novoCtx);
  } catch (err) {
    toast({ titulo: 'Não foi possível encerrar', texto: err.message || String(err), tipo: 'no' });
  }
}

async function removerVinculo(s, vinculoId, ctx) {
  const ok = await confirmar('Excluir este vínculo?',
    { detalhe: 'Para preservar o histórico, prefira "Encerrar".', textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirVinculo(vinculoId);
    const novoCtx = await ctx.recarregar();
    detalhe(s.id, novoCtx);
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'no' });
  }
}
