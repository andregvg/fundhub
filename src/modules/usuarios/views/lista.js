// ============================================================
// FundHub — usuarios/views/lista.js  (aba Usuários = a allowlist)
// CRUD da tabela perfil + último acesso de cada um (fuso São Paulo).
//
// O formulário tem quatro decisões por pessoa:
//   papel      — de onde vem o mapa de permissões (o preset);
//   segmentos  — o recorte de atuação que pré-preenche os filtros;
//   servidor   — o cadastro funcional correspondente, se houver;
//   exceções   — ajustes de módulo que sobrepõem o preset do papel.
//
// As exceções ficam recolhidas de propósito: o caminho normal é
// escolher o papel certo. Se você se pegar criando exceção para
// muita gente, o sinal é que falta um papel novo — não mais exceção.
// ============================================================
import {
  getPapeis, getPresets, getPerfis, criarPerfil, atualizarPerfil, excluirPerfil,
} from '../usuarios.model.js';
import { getServidores } from '../../servidores/servidores.model.js';
import { MODULOS, chavePerm } from '../../../core/registry.js';
import { NIVEIS, OCULTO, rotulaNivel } from '../../../core/permissoes.js';
import { SEGMENTOS, ATALHOS, expandir, atalhoDe, rotuloSelecao } from '../../../core/segmentos.js';
import { esc, val, checked, falha } from '../../../shared/dom.js';
import { fmtDataHora } from '../../../shared/format.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { isInstitucional } from '../../../core/auth.js';

let lista = [], papeis = [], presets = {}, servidores = [];
let rotulos = {};

// Módulos que aceitam permissão configurável (os serviços de fundo e
// as páginas universais ficam de fora — não há o que decidir neles).
const CONFIGURAVEIS = () =>
  MODULOS.filter(m => m.rota && !['modulos', 'meus_dados', 'meus-dados'].includes(m.id));

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

  [papeis, presets, servidores] = await Promise.all([
    getPapeis(), getPresets(), getServidores().catch(() => []),
  ]);
  rotulos = Object.fromEntries(papeis.map(p => [p.chave, p.rotulo]));

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
  const papel = rotulos[p.papel] || p.papel;
  const admin = p.papel === 'admin_sme';
  const segs = expandir(p.segmentos);
  const excecoes = Object.keys(p.permissoes || {}).length;

  return `<div class="solic us-item ${p.ativo ? '' : 'inativo'}">
    <div class="solic-main">
      <div class="di-top">
        <b>${esc(p.nome || p.servidor?.nome || p.email)}</b>
        <span class="tag ${admin ? 'us-admin' : ''}">${esc(papel)}</span>
        ${p.ativo ? '' : '<span class="tag st-negado">inativo</span>'}
        ${segs.length ? `<span class="tag">${esc(rotuloSelecao(segs))}</span>` : ''}
        ${excecoes ? `<span class="tag st-em_analise">${excecoes} exceção(ões)</span>` : ''}
      </div>
      <div class="di-meta">${esc(p.email)}</div>
      ${p.servidor ? `<div class="di-meta">👥 ${esc(p.servidor.nome)}${p.servidor.cargo ? ` · ${esc(p.servidor.cargo)}` : ''}</div>` : ''}
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
  const papelAtual = p?.papel || 'leitor';
  const segsAtuais = expandir(p?.segmentos);
  const excecoes = { ...(p?.permissoes || {}) };

  const optsPapel = papeis
    .map(x => `<option value="${esc(x.chave)}" ${papelAtual === x.chave ? 'selected' : ''}>${esc(x.rotulo)}</option>`)
    .join('');

  const optsServidor = [`<option value="">— sem vínculo com cadastro funcional —</option>`]
    .concat([...servidores]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(s => `<option value="${esc(s.id)}" ${p?.servidor_id === s.id ? 'selected' : ''}>${esc(s.nome)}</option>`))
    .join('');

  abrirDrawer(`
    ${drawerHead(novo ? 'Adicionar acesso' : 'Editar acesso', esc(p?.email || ''))}
    <div class="drawer-body">
      <form id="us-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos">
            <label>E-mail institucional
              <input id="f-email" type="email" value="${esc(p?.email || '')}" ${novo ? '' : 'readonly'} required
                     placeholder="nome@educacao.pmrp.sp.gov.br" /></label>
            <label>Nome de exibição <input id="f-nome" value="${esc(p?.nome || '')}" /></label>
            <label>Cadastro funcional (servidor)
              <select id="f-servidor">${optsServidor}</select>
              <small class="form-hint">Ligar ao servidor permite que a pessoa edite os
                próprios contatos em “Meus dados”.</small></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Acesso</legend>
          <div class="campos">
            <label>Papel <select id="f-papel">${optsPapel}</select>
              <small class="form-hint" id="f-papel-desc"></small></label>
            <label class="inline"><input type="checkbox" id="f-ativo" ${(p ? p.ativo : true) ? 'checked' : ''} /> Acesso ativo</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Segmentos de atuação</legend>
          <div class="campos">
            <div id="f-segs"></div>
            <small class="form-hint">Pré-preenche os filtros dos módulos. Não restringe
              o acesso — a pessoa pode ampliar o filtro na tela. Vazio = todos.</small>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Permissões por módulo</legend>
          <div class="campos">
            <details id="f-perm-box">
              <summary class="perm-summary">Ver e ajustar (o padrão vem do papel)</summary>
              <div class="perm-lista" id="f-perms"></div>
            </details>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="f-msg" class="auth-msg"></span>
          <button type="submit" id="f-save" class="btn-primary">${novo ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`);

  // ── Segmentos: atalhos + básicos, no mesmo desenho do filtro ──
  let segs = [...segsAtuais];
  const boxSegs = document.getElementById('f-segs');
  const pintarSegs = () => {
    const ativo = atalhoDe(segs);
    boxSegs.innerHTML = `
      <div class="fseg">
        ${ATALHOS.map(a => `<button type="button" class="chip atalho ${ativo === a.id ? 'on' : ''}" data-atalho="${a.id}">${esc(a.rotulo)}</button>`).join('')}
        <span class="fseg-sep" aria-hidden="true"></span>
        ${SEGMENTOS.map(s => `<button type="button" class="chip ${segs.includes(s.codigo) ? 'on' : ''}" data-seg="${s.codigo}">${s.ico} ${esc(s.rotulo)}</button>`).join('')}
      </div>`;
  };
  boxSegs.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.atalho) {
      const a = ATALHOS.find(x => x.id === b.dataset.atalho);
      segs = atalhoDe(segs) === a.id ? [] : [...a.segmentos];
    } else if (b.dataset.seg) {
      const c = b.dataset.seg;
      segs = segs.includes(c) ? segs.filter(x => x !== c) : expandir([...segs, c]);
    }
    pintarSegs();
  });
  pintarSegs();

  // ── Permissões: preset do papel + exceções ──
  const selPapel = document.getElementById('f-papel');
  const pintarPerms = () => {
    const preset = presets[selPapel.value] || {};
    const admin = selPapel.value === 'admin_sme';
    document.getElementById('f-papel-desc').textContent =
      papeis.find(x => x.chave === selPapel.value)?.descricao || '';

    document.getElementById('f-perms').innerHTML = admin
      ? `<p class="form-hint">Administrador tem escrita em tudo — não há o que ajustar.</p>`
      : CONFIGURAVEIS().map(m => {
          const herdado = preset[chavePerm(m)] || OCULTO;
          const atual = excecoes[chavePerm(m)] ?? '';
          return `<div class="perm-linha">
            <span class="perm-nome">${m.ico} ${esc(m.navNome || m.nome)}</span>
            <select class="perm-sel" data-mod="${esc(chavePerm(m))}">
              <option value="" ${atual === '' ? 'selected' : ''}>Padrão do papel (${esc(rotulaNivel(herdado))})</option>
              ${NIVEIS.map(n => `<option value="${n.valor}" ${atual === n.valor ? 'selected' : ''}>${esc(n.rotulo)}</option>`).join('')}
            </select>
          </div>`;
        }).join('');
  };
  selPapel.addEventListener('change', pintarPerms);
  document.getElementById('f-perms').addEventListener('change', (e) => {
    const sel = e.target.closest('.perm-sel'); if (!sel) return;
    if (sel.value) excecoes[sel.dataset.mod] = sel.value;
    else delete excecoes[sel.dataset.mod];
  });
  pintarPerms();

  document.getElementById('us-form')
    .addEventListener('submit', (e) => salvar(e, p, () => segs, () => excecoes));
}

async function salvar(e, p, lerSegs, lerExcecoes) {
  e.preventDefault();
  const msg = document.getElementById('f-msg'); msg.className = 'auth-msg';
  const email = val('f-email').toLowerCase();
  if (!email) return falha(msg, 'Informe o e-mail.');
  if (!isInstitucional(email)) return falha(msg, 'Use um e-mail do domínio institucional (@educacao.pmrp.sp.gov.br).');

  const payload = {
    email,
    nome: val('f-nome') || null,
    papel: document.getElementById('f-papel').value,
    ativo: checked('f-ativo'),
    segmentos: lerSegs(),
    permissoes: lerExcecoes(),
    servidor_id: document.getElementById('f-servidor').value || null,
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
