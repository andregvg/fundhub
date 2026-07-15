// ============================================================
// FundHub — usuarios/views/lista.js  (aba Usuários = a allowlist)
// CRUD da tabela perfil + último acesso de cada um (fuso São Paulo).
// ============================================================
import {
  PAPEIS, getPerfis, criarPerfil, atualizarPerfil, excluirPerfil,
} from '../usuarios.model.js';
import { esc, val, checked, falha } from '../../../shared/dom.js';
import { fmtDataHora } from '../../../shared/format.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { isInstitucional } from '../../../core/auth.js';

let lista = [];

export async function render(ctx) {
  ctx.box().innerHTML = `
    <div class="toolbar">
      <span class="count" id="us-count"></span>
      <button id="us-novo" class="btn-primary">+ Adicionar acesso</button>
    </div>
    <div id="us-lista">${loading()}</div>
    ${drawerHtml()}`;

  montarDrawer();
  document.getElementById('us-novo').addEventListener('click', () => abrirForm(null));
  await carregar();
}

async function carregar() {
  const box = document.getElementById('us-lista');
  try { lista = await getPerfis(); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  document.getElementById('us-count').textContent = `${lista.length} acesso(s) cadastrado(s)`;
  if (!lista.length) {
    box.innerHTML = emptyState('🔐', 'Nenhum acesso cadastrado', 'Clique em “Adicionar acesso”.');
    return;
  }
  box.innerHTML = lista.map(item).join('');
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirForm(lista.find(p => p.email === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(lista.find(p => p.email === b.dataset.del))));
}

function item(p) {
  const papel = PAPEIS[p.papel] || p.papel;
  const admin = p.papel === 'admin_sme';
  return `<div class="solic us-item ${p.ativo ? '' : 'inativo'}">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(p.nome || p.email)}</b>
        <span class="tag ${admin ? 'us-admin' : ''}">${esc(papel)}</span>
        ${p.ativo ? '' : '<span class="tag st-negado">inativo</span>'}
      </div>
      <div class="di-meta">${esc(p.email)}</div>
      <div class="di-meta">Último acesso: ${esc(fmtDataHora(p.ultimo_acesso))}</div>
    </div>
    <div class="solic-acoes">
      <button class="mini-btn" data-edit="${esc(p.email)}" aria-label="Editar">✎</button>
      <button class="mini-btn no" data-del="${esc(p.email)}" aria-label="Remover">🗑</button>
    </div>
  </div>`;
}

function abrirForm(p) {
  const novo = !p;
  const opts = Object.entries(PAPEIS)
    .map(([k, v]) => `<option value="${k}" ${(p?.papel || 'leitor') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Adicionar acesso' : 'Editar acesso')}
    <div class="drawer-body">
      <form id="us-form" class="esc-form">
        <label>E-mail institucional
          <input id="f-email" type="email" value="${esc(p?.email || '')}" ${novo ? '' : 'readonly'} required
                 placeholder="nome@educacao.pmrp.sp.gov.br" /></label>
        <label>Nome <input id="f-nome" value="${esc(p?.nome || '')}" /></label>
        <label>Papel <select id="f-papel">${opts}</select></label>
        <label class="inline"><input type="checkbox" id="f-ativo" ${(p ? p.ativo : true) ? 'checked' : ''} /> Acesso ativo</label>
        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save">${novo ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? `<p class="form-hint" style="margin-top:14px">O e-mail precisa ser do domínio institucional.
        Papel <b>Administrador</b> pode escrever; os demais só leem.</p>` : ''}
    </div>`);

  document.getElementById('us-form').addEventListener('submit', (e) => salvar(e, p));
}

async function salvar(e, p) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const email = val('f-email').toLowerCase();
  if (!email) return falha(msg, 'Informe o e-mail.');
  if (!isInstitucional(email)) return falha(msg, 'Use um e-mail do domínio institucional (@educacao.pmrp.sp.gov.br).');

  const payload = {
    email, nome: val('f-nome') || null,
    papel: document.getElementById('f-papel').value,
    ativo: checked('f-ativo'),
  };
  const btn = document.getElementById('f-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (p) await atualizarPerfil(p.email, payload);
    else await criarPerfil(payload);
    fecharDrawer(); carregar();
  } catch (err) {
    falha(msg, err.message || String(err));
    btn.disabled = false; btn.textContent = p ? 'Salvar' : 'Adicionar';
  }
}

async function remover(p) {
  if (!confirm(`Remover o acesso de "${p.email}"? Ele deixará de conseguir entrar no FundHub.`)) return;
  try { await excluirPerfil(p.email); carregar(); }
  catch (err) { alert('Não foi possível remover: ' + (err.message || err)); }
}
