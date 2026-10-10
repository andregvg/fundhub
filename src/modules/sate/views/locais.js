// ============================================================
// FundHub - sate/views/locais.js  (aba Locais)
// Catálogo de destinos das atividades/solicitações. Fonte única do
// endereço + ponto de desembarque + coordenadas de cada local.
// Todos veem; quem aprova o SATE (não é o mesmo que admin do hub, D7)
// edita. Usa modules/locais/locais.model.js.
// ============================================================
import { destinosAConferir } from '../sate.model.js';
import { agruparDestinos } from '../regras.model.js';
import { criarLocal, atualizarLocal, excluirLocal, enderecoCompleto } from '../../locais/locais.model.js';
import { localizarEndereco, buscarCep, cepNaCidade, linkMaps, temCoordenada } from '../../locais/geografia.model.js';
import { esc, val, checked, falha, falhaNoCampo } from '../../../shared/dom.js';
import { fmtCep, cepDe } from '../../../shared/format.js';
import { emptyState } from '../../../shared/ui/feedback.js';
import { abrirModal, modalHead, fecharModal, marcarTocado } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';
import { montarMapaPino } from '../../../shared/ui/mapa-pino.js';
import { ligarCep } from '../../../shared/ui/campo-cep.js';

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

  box.innerHTML = barra + (podeEditar ? '<div id="loc-conferir"></div>' : '') + (locais.length
    ? `<div class="cards">${locais.map(card).join('')}</div>`
    : emptyState(ico('visita', { tam: 32 }), 'Nenhum local cadastrado', podeEditar
        ? 'Clique em “Novo local” para começar. Os destinos das atividades já viram locais no backfill da migration 017.'
        : 'Peça a um administrador para cadastrar os destinos.'));

  if (!podeEditar) return;
  pintarAConferir();
  document.getElementById('novo-local')?.addEventListener('click', () => abrirLocal(null));
  box.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => abrirLocal(locais.find(l => l.id === b.dataset.edit))));
  box.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => remover(locais.find(l => l.id === b.dataset.del))));
}

// Destinos que as escolas digitaram e ainda não são local do cadastro
// (spec 2026-10-10-sate-endereco-e-cep, D8). Uma linha por LUGAR. Sem
// pendência, o bloco não aparece. Falha de leitura também não: a aba
// Locais não pode quebrar por causa de um bloco de apoio.
async function pintarAConferir() {
  const box = document.getElementById('loc-conferir');
  if (!box) return;
  const grupos = agruparDestinos(await destinosAConferir().catch(() => []));
  if (document.getElementById('loc-conferir') !== box || !grupos.length) return;
  box.innerHTML = `
    <section class="panel loc-conferir">
      <h2>A conferir</h2>
      <p class="form-hint">Destinos que as escolas digitaram e ainda não são um local do cadastro.</p>
      ${grupos.map((g, i) => `
        <div class="solic">
          <div class="solic-main"><b>${esc(g.nome)}</b>
            <div class="di-meta">${esc(enderecoCompleto(g)) || 'sem endereço'} · em ${g.pedidos.length === 1 ? '1 pedido' : `${g.pedidos.length} pedidos`}</div></div>
          <div class="solic-acoes"><button type="button" class="mini-btn" data-conferir="${i}">Conferir</button></div>
        </div>`).join('')}
    </section>`;
  box.querySelectorAll('[data-conferir]').forEach(b => b.addEventListener('click', async () => {
    // Dinâmico: conferir-local.js importa este arquivo (abrirLocal).
    const { abrirConferirLocal } = await import('./conferir-local.js');
    abrirConferirLocal(grupos[Number(b.dataset.conferir)], ctx, async () => {
      await ctx.recarregarLocais();
      render(ctx);
    });
  }));
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
    ${enderecoCompleto(l) ? `<div class="addr">${esc(enderecoCompleto(l))}${l.cep ? ` · CEP ${esc(fmtCep(l.cep))}` : ''}</div>` : ''}
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
            <label>CEP <input id="l-cep" inputmode="numeric" autocomplete="postal-code" maxlength="9"
                value="${esc(fmtCep(base?.cep))}" placeholder="00000-000" />
              <small class="form-hint" id="l-cep-dica" aria-live="polite">Preenche rua e bairro e ajuda a achar o lugar no mapa.</small></label>
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
              <button type="button" class="mini-btn" id="l-cep-pino" hidden>${ico('visita', { tam: 13 })} Mover o pino para este CEP</button>
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
  ligarCep(document.getElementById('l-cep'), {
    buscar: buscarCep, dica: document.getElementById('l-cep-dica'), aoAchar: aoAcharCep,
  });

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

// Chamado pelo pino e por "Localizar": os dois são gesto da pessoa, então
// latitude e longitude passam a contar como digitadas (marcarTocado) antes de
// receberem o valor - senão o Esc perderia o ponto sem perguntar.
function aoMover(lat, lng) {
  marcarTocado(document.getElementById('l-lat')); marcarTocado(document.getElementById('l-lng'));
  document.getElementById('l-lat').value = lat.toFixed(6);
  document.getElementById('l-lng').value = lng.toFixed(6);
  atualizarLinkMaps(lat, lng);
}

// O CEP não destrói o que já foi conferido (spec 2026-10-10, D6): rua e
// bairro só entram em campo VAZIO, o número nunca é tocado, e um pino que
// já existe só se move pelo botão. Preencher por CEP é gesto da pessoa -
// os campos escritos contam como digitados (marcarTocado).
function aoAcharCep(r, dizer) {
  const preencher = (id, valor) => {
    const c = document.getElementById(id);
    if (!c || c.value.trim() || !valor) return;
    marcarTocado(c); c.value = valor;
  };
  preencher('l-end', r.rua);
  preencher('l-bairro', r.bairro);

  const onde = [r.rua, r.bairro].filter(Boolean).join(' - ') || 'CEP sem logradouro';
  const fora = cepNaCidade(r) ? '' : ` · CEP de ${[r.cidade, r.uf].filter(Boolean).join('/')}`;
  dizer(`Encontrado: ${onde}${fora}`);

  const botao = document.getElementById('l-cep-pino');
  botao.hidden = true;
  if (r.lat == null) return;
  const temPino = temCoordenada(val('l-lat'), val('l-lng'));
  const mover = () => { aoMover(r.lat, r.lng); mapaAtual?.mover(r.lat, r.lng); botao.hidden = true; };
  if (!temPino) return mover();
  botao.hidden = false;
  botao.onclick = mover;
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
async function localizar() {
  const btn = document.getElementById('l-geo');
  const dica = document.getElementById('l-geo-dica');
  btn.disabled = true;
  dica.textContent = 'Procurando…';
  try {
    const r = await localizarEndereco(enderecoDoForm(), { pausaMs: 1100 });
    if (!r.achado) {
      dica.textContent = r.motivo === 'aproximado'
        ? 'Só encontrei o bairro, não a rua. Informe o CEP ou acerte o pino à mão.'
        : 'Endereço não encontrado. Informe o CEP, ou copie as coordenadas do Google Maps: clique com o botão direito no lugar e clique nos números.';
      return;
    }
    aoMover(r.achado.lat, r.achado.lng);
    mapaAtual?.mover(r.achado.lat, r.achado.lng);
    dica.textContent = `Encontrado: ${r.achado.formatado} · ${r.precisao === 'rua'
      ? 'achei a rua, não o número: acerte o pino no mapa antes de salvar.'
      : 'conferir no mapa acima antes de salvar.'}`;
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
  if (!nome) return falhaNoCampo(msg, '#l-nome', 'Informe o nome do local.');
  const cepTexto = val('l-cep');
  const cep = cepDe(cepTexto);
  if (cepTexto && !cep) return falhaNoCampo(msg, '#l-cep', 'CEP incompleto: são 8 dígitos.');
  const lat = parseFloat(val('l-lat'));
  const lng = parseFloat(val('l-lng'));

  const payload = {
    nome,
    endereco: val('l-end') || null,
    numero: val('l-num') || null,
    bairro: val('l-bairro') || null,
    // Só entra quando foi preenchido, ou quando havia um e foi apagado:
    // quem não mexe no CEP salva igual com ou sem a migration 047.
    ...(cep || l?.cep ? { cep } : {}),
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
    if (['42703', 'PGRST204'].includes(err?.code)) {
      falha(msg, 'O banco ainda não tem o campo CEP. Avise a Gerência.');
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
