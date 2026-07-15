// ============================================================
// FundHub — sate/views/catalogo.js  (aba Catálogo)
// Atividades extraclasse geridas pela SME. Todos veem; admin edita.
// ============================================================
import { criarAtividade, atualizarAtividade, excluirAtividade } from '../atividades.model.js';
import { esc, slug, val, checked, falha } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';

let ctx = null;

export function render(contexto) {
  ctx = contexto;
  const { perfil, atividades } = ctx;
  const box = ctx.box();

  const barra = perfil?.isAdmin ? `
    <div class="toolbar">
      <span class="count">Catálogo de atividades geridas pela SME.</span>
      <button id="nova-atv" class="btn-primary">+ Nova atividade</button>
    </div>` : '';

  box.innerHTML = barra + (atividades.length
    ? `<div class="cards">${atividades.map(card).join('')}</div>`
    : emptyState('🚌', 'Catálogo vazio', perfil?.isAdmin
        ? 'Clique em “Nova atividade” ou rode o seed no SQL Editor.'
        : 'Peça a um administrador para cadastrar as atividades.'));

  if (!perfil?.isAdmin) return;
  document.getElementById('nova-atv')?.addEventListener('click', () => abrirForm(null));
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirForm(atividades.find(a => a.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(atividades.find(a => a.id === b.dataset.del))));
}

function card(a) {
  const cor = a.cor || 'var(--brand)';
  const tags = [
    a.usa_onibus ? `<span class="tag bus">🚌 Usa ônibus</span>` : `<span class="tag">🏫 Na escola</span>`,
    a.gerida_sme ? `<span class="tag">Gerida pela SME</span>` : `<span class="tag">Definida pela escola</span>`,
    a.precisa_declaracao ? `<span class="tag eja">📄 Declaração</span>` : '',
    a.min_participantes ? `<span class="tag">Mín. ${esc(a.min_participantes)}</span>` : '',
  ].join('');
  const admin = ctx.perfil?.isAdmin ? `
    <div class="atv-acoes">
      <button class="mini-btn" data-edit="${a.id}" aria-label="Editar">✎</button>
      <button class="mini-btn no" data-del="${a.id}" aria-label="Excluir">🗑</button>
    </div>` : '';
  return `<article class="card atv-card" style="border-top:3px solid ${esc(cor)}">
    <div class="card-top"><h3>${esc(a.nome)}</h3>${admin}</div>
    ${a.descricao ? `<div class="addr">${esc(a.descricao)}</div>` : ''}
    ${a.publico_alvo ? `<div class="atv-field"><b>Público-alvo:</b> ${esc(a.publico_alvo)}</div>` : ''}
    ${a.lanche ? `<div class="atv-field"><b>Lanche:</b> ${esc(a.lanche)}</div>` : ''}
    <div class="tags">${tags}</div>
  </article>`;
}

function abrirForm(a) {
  const novo = !a;
  const v = (k) => esc(a?.[k] ?? '');
  const chk = (k, padrao) => ((a ? a[k] : padrao) ? 'checked' : '');
  const optsLocais = (ctx.locais || [])
    .map(l => `<option value="${l.id}" ${a?.local_id === l.id ? 'selected' : ''}>${esc(l.nome)}${l.ativo ? '' : ' (inativo)'}</option>`)
    .join('');

  ctx.box().innerHTML = `
    <button class="mini-btn" id="atv-voltar" type="button">← Voltar ao catálogo</button>
    <form id="atv-form" class="sate-form" style="margin-top:14px">
      <div class="form-grid">
        <label class="col-2">Nome <input id="a-nome" required value="${v('nome')}" /></label>
        <label class="col-2">Descrição <input id="a-desc" value="${v('descricao')}" /></label>
        <label class="col-2">Público-alvo <input id="a-pub" value="${v('publico_alvo')}" /></label>
        <label>Lanche <input id="a-lanche" value="${v('lanche')}" /></label>
        <label>Mín. participantes <input id="a-min" type="number" inputmode="numeric" min="0" value="${v('min_participantes')}" /></label>
        <label class="col-2">Local (destino)
          <select id="a-local-id">
            <option value="">— sem local —</option>
            ${optsLocais}
          </select>
          <small class="form-hint">Cadastre e edite destinos na aba <b>Locais</b>.</small>
        </label>
        <label>Cor <input id="a-cor" type="color" value="${a?.cor || '#1d4ed8'}" /></label>
        <div class="esc-row col-2">
          <label class="inline"><input type="checkbox" id="a-onibus" ${chk('usa_onibus', true)} /> Usa ônibus</label>
          <label class="inline"><input type="checkbox" id="a-sme" ${chk('gerida_sme', true)} /> Gerida pela SME</label>
          <label class="inline"><input type="checkbox" id="a-decl" ${chk('precisa_declaracao', false)} /> Declaração impressa</label>
          <label class="inline"><input type="checkbox" id="a-ativo" ${chk('ativo', true)} /> Ativa</label>
        </div>
      </div>
      <div class="form-foot">
        <span id="a-msg" class="auth-msg"></span>
        <button type="submit" id="a-save">${novo ? 'Criar' : 'Salvar'}</button>
      </div>
    </form>`;

  document.getElementById('atv-voltar').addEventListener('click', () => render(ctx));
  document.getElementById('atv-form').addEventListener('submit', (e) => salvar(e, a));
}

async function salvar(e, a) {
  e.preventDefault();
  const msg = document.getElementById('a-msg'); msg.className = 'auth-msg';

  const nome = val('a-nome');
  if (!nome) return falha(msg, 'Informe o nome da atividade.');
  const min = parseInt(val('a-min'), 10);

  // Local escolhido do catálogo: grava local_id + snapshot de nome/endereço
  // (mantém local_nome/local_endereco legados coerentes p/ Viagens).
  const local = (ctx.locais || []).find(l => l.id === val('a-local-id'));
  const payload = {
    nome,
    descricao: val('a-desc') || null,
    publico_alvo: val('a-pub') || null,
    lanche: val('a-lanche') || null,
    min_participantes: isNaN(min) ? null : min,
    local_id: local ? local.id : null,
    local_nome: local ? local.nome : null,
    local_endereco: local ? (local.endereco || null) : null,
    cor: document.getElementById('a-cor').value,
    usa_onibus: checked('a-onibus'),
    gerida_sme: checked('a-sme'),
    precisa_declaracao: checked('a-decl'),
    ativo: checked('a-ativo'),
  };
  if (!a) payload.chave = slug(nome) || 'atv_' + Date.now();

  const btn = document.getElementById('a-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (a) await atualizarAtividade(a.id, payload);
    else await criarAtividade(payload);
    await ctx.recarregarAtividades();
    render(ctx);
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = a ? 'Salvar' : 'Criar';
  }
}

async function remover(a) {
  if (!a || !confirm(`Excluir a atividade "${a.nome}"?`)) return;
  try {
    await excluirAtividade(a.id);
    await ctx.recarregarAtividades();
    render(ctx);
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
