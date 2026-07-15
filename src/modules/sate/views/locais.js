// ============================================================
// FundHub — sate/views/locais.js  (aba Locais — admin)
// Catálogo de destinos das atividades/solicitações. Fonte única do
// endereço + ponto de desembarque + coordenadas de cada local.
// Todos veem; admin edita. Usa modules/locais/locais.model.js.
// ============================================================
import { criarLocal, atualizarLocal, excluirLocal, linkMaps } from '../../locais/locais.model.js';
import { esc, val, checked, falha } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';

let ctx = null;

export function render(contexto) {
  ctx = contexto;
  const { perfil, locais } = ctx;
  const box = ctx.box();

  const barra = perfil?.isAdmin ? `
    <div class="toolbar">
      <span class="count">Destinos das atividades e solicitações — geocode uma vez, reutilize.</span>
      <button id="novo-local" class="btn-primary">+ Novo local</button>
    </div>` : '';

  box.innerHTML = barra + (locais.length
    ? `<div class="cards">${locais.map(card).join('')}</div>`
    : emptyState('📍', 'Nenhum local cadastrado', perfil?.isAdmin
        ? 'Clique em “Novo local” para começar. Os destinos das atividades já viram locais no backfill da migration 017.'
        : 'Peça a um administrador para cadastrar os destinos.'));

  if (!perfil?.isAdmin) return;
  document.getElementById('novo-local')?.addEventListener('click', () => abrirForm(null));
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirForm(locais.find(l => l.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(locais.find(l => l.id === b.dataset.del))));
}

function card(l) {
  const maps = l.maps_url || linkMaps(l.latitude, l.longitude);
  const admin = ctx.perfil?.isAdmin ? `
    <div class="atv-acoes">
      <button class="mini-btn" data-edit="${l.id}" aria-label="Editar">✎</button>
      <button class="mini-btn no" data-del="${l.id}" aria-label="Excluir">🗑</button>
    </div>` : '';
  return `<article class="card atv-card ${l.ativo ? '' : 'inativo'}">
    <div class="card-top"><h3>📍 ${esc(l.nome)}</h3>${admin}</div>
    ${l.endereco ? `<div class="addr">${esc(l.endereco)}</div>` : ''}
    ${l.desembarque ? `<div class="atv-field"><b>Desembarque:</b> ${esc(l.desembarque)}</div>` : ''}
    <div class="tags">
      ${l.ativo ? '' : '<span class="tag eja">Inativo</span>'}
      ${(l.latitude != null && l.longitude != null) ? '<span class="tag">📌 Geocodado</span>' : ''}
      ${maps ? `<a class="tag" href="${esc(maps)}" target="_blank" rel="noopener">ver no mapa</a>` : ''}
    </div>
  </article>`;
}

function abrirForm(l) {
  const novo = !l;
  const v = (k) => esc(l?.[k] ?? '');

  ctx.box().innerHTML = `
    <button class="mini-btn" id="local-voltar" type="button">← Voltar aos locais</button>
    <form id="local-form" class="sate-form" style="margin-top:14px">
      <div class="form-grid">
        <label class="col-2">Nome <input id="l-nome" required value="${v('nome')}" placeholder="Ex.: Theatro Pedro II" /></label>
        <label class="col-2">Endereço <input id="l-end" value="${v('endereco')}" placeholder="Rua, nº - bairro" /></label>
        <label class="col-2">Ponto de desembarque <input id="l-des" value="${v('desembarque')}" placeholder="Onde o ônibus para" /></label>
        <label>Latitude <input id="l-lat" type="number" step="any" inputmode="decimal" value="${v('latitude')}" /></label>
        <label>Longitude <input id="l-lng" type="number" step="any" inputmode="decimal" value="${v('longitude')}" /></label>
        <label class="col-2">Observação <input id="l-obs" value="${v('obs')}" /></label>
        <label class="inline col-2"><input type="checkbox" id="l-ativo" ${(l ? l.ativo : true) ? 'checked' : ''} /> Ativo</label>
      </div>
      <div class="form-foot">
        <span id="l-msg" class="auth-msg"></span>
        <button type="submit" id="l-save">${novo ? 'Criar' : 'Salvar'}</button>
      </div>
    </form>`;

  document.getElementById('local-voltar').addEventListener('click', () => render(ctx));
  document.getElementById('local-form').addEventListener('submit', (e) => salvar(e, l));
}

async function salvar(e, l) {
  e.preventDefault();
  const msg = document.getElementById('l-msg'); msg.className = 'auth-msg';
  const nome = val('l-nome');
  if (!nome) return falha(msg, 'Informe o nome do local.');
  const lat = parseFloat(val('l-lat'));
  const lng = parseFloat(val('l-lng'));

  const payload = {
    nome,
    endereco: val('l-end') || null,
    desembarque: val('l-des') || null,
    latitude: isNaN(lat) ? null : lat,
    longitude: isNaN(lng) ? null : lng,
    obs: val('l-obs') || null,
    ativo: checked('l-ativo'),
  };

  const btn = document.getElementById('l-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (l) await atualizarLocal(l.id, payload);
    else await criarLocal(payload);
    await ctx.recarregarLocais();
    render(ctx);
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = l ? 'Salvar' : 'Criar';
  }
}

async function remover(l) {
  if (!l || !confirm(`Excluir o local "${l.nome}"?`)) return;
  try {
    await excluirLocal(l.id);
    await ctx.recarregarLocais();
    render(ctx);
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
