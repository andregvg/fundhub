// ============================================================
// FundHub - sate/views/locais.js  (aba Locais)
// Catálogo de destinos das atividades/solicitações. Fonte única do
// endereço + ponto de desembarque + coordenadas de cada local.
// Todos veem; quem aprova o SATE (não é o mesmo que admin do hub, D7)
// edita. Usa modules/locais/locais.model.js.
// ============================================================
import { criarLocal, atualizarLocal, excluirLocal, enderecoCompleto } from '../../locais/locais.model.js';
import { geocodificar, linkMaps, temCoordenada } from '../../locais/geografia.model.js';
import { esc, val, checked, falha } from '../../../shared/dom.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { abrirModal, modalHead, fecharModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { montarMapaPino } from '../../../shared/ui/mapa-pino.js';

let ctx = null;

export function render(contexto) {
  ctx = contexto;
  const { locais } = ctx;
  const podeEditar = ctx.aprovador && !ctx.somenteLeitura;
  const box = ctx.box();

  const barra = podeEditar ? `
    <div class="toolbar">
      <button id="novo-local" class="btn-primary">${ico('adicionar')} Novo local</button>
    </div>` : '';

  box.innerHTML = barra + (locais.length
    ? `<div class="cards">${locais.map(card).join('')}</div>`
    : emptyState(ico('visita', { tam: 32 }), 'Nenhum local cadastrado', podeEditar
        ? 'Clique em “Novo local” para começar. Os destinos das atividades já viram locais no backfill da migration 017.'
        : 'Peça a um administrador para cadastrar os destinos.'));

  if (!podeEditar) return;
  document.getElementById('novo-local')?.addEventListener('click', () => abrirLocal(null));
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirLocal(locais.find(l => l.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(locais.find(l => l.id === b.dataset.del))));
}

function card(l) {
  const maps = l.maps_url || linkMaps(l.latitude, l.longitude);
  const podeEditar = ctx.aprovador && !ctx.somenteLeitura;
  const acoes = podeEditar ? `
    <div class="atv-acoes">
      <button class="mini-btn" data-edit="${esc(l.id)}" aria-label="Editar">${ico('editar')}</button>
      <button class="mini-btn no" data-del="${esc(l.id)}" aria-label="Excluir">${ico('excluir')}</button>
    </div>` : '';
  return `<article class="card atv-card ${l.ativo ? '' : 'inativo'}">
    <div class="card-top"><h3>${ico('visita', { tam: 16 })} ${esc(l.nome)}</h3>${acoes}</div>
    ${enderecoCompleto(l) ? `<div class="addr">${esc(enderecoCompleto(l))}</div>` : ''}
    ${l.desembarque ? `<div class="atv-field"><b>Desembarque:</b> ${esc(l.desembarque)}</div>` : ''}
    <div class="tags">
      ${l.ativo ? '' : '<span class="tag eja">Inativo</span>'}
      ${(l.latitude != null && l.longitude != null) ? `<span class="tag">${ico('meta', { tam: 12 })} Geocodado</span>` : ''}
      ${maps ? `<a class="tag" href="${esc(maps)}" target="_blank" rel="noopener">ver no mapa</a>` : ''}
    </div>
  </article>`;
}

// Exportada para a Task 6: o modal de detalhe da solicitação abre este
// mesmo cadastro, preenchido com o que a escola digitou, mesmo quando a
// página Locais nunca foi desenhada - por isso o terceiro parâmetro
// (`ctxExterno`), e por isso tudo aqui lê do `c` resolvido, nunca do
// `ctx` do módulo direto.
export function abrirLocal(l, { preenchido = {}, aoSalvar = null } = {}, ctxExterno = null) {
  const c = ctxExterno ?? ctx;
  const novo = !l;
  const base = { ...l, ...preenchido };
  const v = (k) => esc(base?.[k] ?? '');
  const lat = Number(base?.latitude);
  const lng = Number(base?.longitude);

  abrirModal(`
    ${modalHead(novo ? 'Novo local' : 'Editar local', novo ? '' : esc(base.nome))}
    <div class="modal-body">
      <form id="local-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos auto">
            <label class="col-full">Nome <input id="l-nome" required value="${v('nome')}" placeholder="Ex.: Theatro Pedro II" /></label>
            <label class="col-full">Ponto de desembarque <input id="l-desemb" value="${v('desembarque')}" placeholder="Onde o ônibus para" /></label>
            <label class="switch col-full"><input type="checkbox" id="l-ativo" ${(base?.ativo ?? true) ? 'checked' : ''} />
              <span class="switch-trilho" aria-hidden="true"></span> Ativo</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Endereço</legend>
          <div class="campos auto">
            <label class="col-full">Endereço <input id="l-end" value="${v('endereco')}" placeholder="Ex.: Rua Exemplo" /></label>
            <label>Número <input id="l-num" inputmode="numeric" value="${v('numero')}" placeholder="Ex.: 123" /></label>
            <label>Bairro <input id="l-bairro" value="${v('bairro')}" placeholder="Ex.: Centro" /></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Localização</legend>
          <div class="campos auto">
            <div class="col-full"><div id="l-mapa" class="mapa-pino"></div></div>
            <label>Latitude <input id="l-lat" type="number" step="any" inputmode="decimal" value="${Number.isFinite(lat) ? lat : ''}" /></label>
            <label>Longitude <input id="l-lng" type="number" step="any" inputmode="decimal" value="${Number.isFinite(lng) ? lng : ''}" /></label>
            <div class="col-full geo-linha">
              <button type="button" class="mini-btn" id="l-geo">${ico('visita', { tam: 13 })} Localizar pelo endereço</button>
              <span class="form-hint" id="l-geo-dica" aria-live="polite">Clique no mapa ou arraste o pino para acertar o ponto de desembarque.</span>
            </div>
            <div class="col-full" id="l-maps-linha"></div>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Observação</legend>
          <div class="campos auto">
            <label class="col-full">Observação <input id="l-obs" value="${v('obs')}" /></label>
          </div>
        </fieldset>

        <div class="form-foot">
          <span id="l-msg" class="auth-msg"></span>
          <button type="submit" id="l-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo' });

  atualizarLinkMaps(Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null);

  document.getElementById('local-form').addEventListener('submit', (e) => salvar(e, l, c, aoSalvar));
  document.getElementById('l-geo').addEventListener('click', localizar);
  document.getElementById('l-lat').addEventListener('change', aoMudarCoordenadaAMao);
  document.getElementById('l-lng').addEventListener('change', aoMudarCoordenadaAMao);

  const mapaEl = document.getElementById('l-mapa');
  montarMapaPino(mapaEl, {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    aoMover,
  }).then((m) => {
    // Resposta tardia de um modal que já não existe não toma o lugar do atual.
    if (document.getElementById('l-mapa') !== mapaEl) return;
    mapaAtual = m;
    if (!m) (mapaEl.closest('.col-full') || mapaEl).setAttribute('hidden', '');
  });
}

// Handle do mapa aberto no momento - módulo tem um modal por vez.
let mapaAtual = null;

function aoMover(lat, lng) {
  document.getElementById('l-lat').value = lat.toFixed(6);
  document.getElementById('l-lng').value = lng.toFixed(6);
  atualizarLinkMaps(lat, lng);
}

function aoMudarCoordenadaAMao() {
  const lat = parseFloat(val('l-lat'));
  const lng = parseFloat(val('l-lng'));
  atualizarLinkMaps(isNaN(lat) ? null : lat, isNaN(lng) ? null : lng);
  if (!isNaN(lat) && !isNaN(lng)) mapaAtual?.mover(lat, lng);
}

function atualizarLinkMaps(lat, lng) {
  const linha = document.getElementById('l-maps-linha');
  if (!linha) return;
  const url = temCoordenada(lat, lng) ? linkMaps(lat, lng) : null;
  linha.innerHTML = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Abrir no Google Maps</a>` : '';
}

function enderecoDoForm() {
  return enderecoCompleto({ endereco: val('l-end'), numero: val('l-num'), bairro: val('l-bairro') });
}

// Endereço → latitude e longitude, pelo OpenStreetMap. Preenche os campos
// e move o pino, mas NÃO grava: quem salva é a pessoa, depois de
// conferir no mapa - um endereço ambíguo pode cair na rua de mesmo nome
// em outro bairro.
//
// Segunda cópia desta ligação (a primeira é o formulário de Escolas):
// ~25 linhas iguais esperam o terceiro caso para virar componente (R13).
async function localizar() {
  const btn = document.getElementById('l-geo');
  const dica = document.getElementById('l-geo-dica');
  btn.disabled = true;
  dica.textContent = 'Procurando…';
  try {
    const r = await geocodificar(enderecoDoForm());
    if (!r) {
      dica.textContent = 'Endereço não encontrado. Dá para copiar as coordenadas do Google Maps: clique com o botão direito no lugar e clique nos números.';
      return;
    }
    aoMover(r.lat, r.lng);
    mapaAtual?.mover(r.lat, r.lng);
    dica.innerHTML = `Encontrado: ${esc(r.formatado)} · conferir no mapa acima antes de salvar.`;
  } catch (err) {
    dica.textContent = err?.name === 'AbortError' ? 'O serviço de mapa não respondeu. Tente de novo em instantes.' : (err?.message || String(err));
  } finally {
    btn.disabled = false;
  }
}

async function salvar(e, l, c, aoSalvar) {
  e.preventDefault();
  const msg = document.getElementById('l-msg'); msg.className = 'auth-msg';
  const nome = val('l-nome');
  if (!nome) return falha(msg, 'Informe o nome do local.');
  const lat = parseFloat(val('l-lat'));
  const lng = parseFloat(val('l-lng'));

  const payload = {
    nome,
    endereco: val('l-end') || null,
    numero: val('l-num') || null,
    bairro: val('l-bairro') || null,
    desembarque: val('l-desemb') || null,
    latitude: isNaN(lat) ? null : lat,
    longitude: isNaN(lng) ? null : lng,
    obs: val('l-obs') || null,
    ativo: checked('l-ativo'),
  };

  const btn = document.getElementById('l-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const salvo = l ? await atualizarLocal(l.id, payload) : await criarLocal(payload);
    await c.recarregarLocais();
    fecharModal();
    if (aoSalvar) await aoSalvar(salvo);
    else render(c);
  } catch (err) {
    if (err?.code === '42703') {
      falha(msg, 'O banco ainda não tem os campos número e bairro. Avise a Gerência.');
    } else {
      falha(msg, 'Erro: ' + (err.message || err));
    }
    btn.disabled = false; btn.textContent = l ? 'Salvar' : 'Criar';
  }
}

async function remover(l) {
  if (!l) return;
  const ok = await confirmar(`Excluir o local "${l.nome}"?`, { textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirLocal(l.id);
    await ctx.recarregarLocais();
    render(ctx);
  } catch (err) {
    toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'erro' });
  }
}
