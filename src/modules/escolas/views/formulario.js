// ============================================================
// FundHub - escolas/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { criarUnidade, atualizarUnidade, excluirUnidade, getUnidades } from '../escolas.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { geocodificar, linkMaps, temCoordenada } from '../../locais/geografia.model.js';
import { esc, falhaNoCampo } from '../../../shared/dom.js';
import { modalHead, abrirModal, fecharModal, marcarTocado } from '../../../shared/ui/modal.js';
import { montarMapaPino } from '../../../shared/ui/mapa-pino.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

// Handle do mapa aberto - o módulo tem um modal por vez.
let mapaAtual = null;

// Segmento e oferta são LISTAS, não texto livre: "Emef", "EMEF " e "emef"
// digitados à mão viravam três segmentos nos filtros. O valor que a escola
// já tem entra na lista mesmo que não seja um dos previstos - editar outro
// campo não pode apagar o que estava gravado.
const SEGMENTOS_ESCOLA = ['EMEF', 'EMEI', 'CEI', 'EMEPB', 'CONVENIADA'];
const OFERTAS_BASE = ['EF1', 'EF2', 'EF1/EF2'];
const opcoes = (lista, atual) => ['', ...new Set([...lista, ...(atual ? [atual] : [])])]
  .map(o => `<option value="${esc(o)}" ${o === (atual || '') ? 'selected' : ''}>${o ? esc(o) : 'Selecione…'}</option>`).join('');

// `ctx`: { recarregar } - ver escolas.view.js § ctxAtual() e views/detalhe.js.
// `voltar`: aberto sobre a ficha, salvar devolve para ela (a pilha do modal).
export function abrirForm(u, ctx, { voltar = null } = {}) {
  const novo = !u;
  const v = (k) => esc(u?.[k] ?? '');
  const chk = (k) => (u?.[k] ? 'checked' : '');

  // Os campos são muitos (16). Agrupá-los em blocos com título é só
  // visual - o payload continua o mesmo - mas transforma uma parede
  // de inputs numa ficha que se lê de relance.
  abrirModal(`
    ${modalHead(novo ? 'Nova escola' : 'Editar escola', novo ? '' : esc(u.nome))}
    <div class="modal-body">
      <form id="esc-form" class="esc-form">

        <fieldset class="form-grupo">
          <legend>Identificação</legend>
          <div class="campos auto">
            <label class="col-full">Nome <input name="nome" required value="${v('nome')}" />
              <small class="form-hint">Como aparece nos cards e nas listas.</small></label>
            <label>Apelido <input name="apelido" value="${v('apelido')}" />
              <small class="form-hint">Forma curta de uso interno (ex.: “Alcina”).</small></label>
            <label class="col-full">Nome oficial / SAE <input name="nome_oficial" value="${v('nome_oficial')}" />
              <small class="form-hint">Como consta no SAE - use para conferir relatórios.</small></label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Segmento e oferta</legend>
          <div class="campos auto">
            <label>Segmento <select name="segmento">${opcoes(SEGMENTOS_ESCOLA, u?.segmento)}</select></label>
            <label>Oferta <select name="oferta">${opcoes(OFERTAS_BASE, u?.oferta)}</select></label>
            <label class="switch col-full"><input type="checkbox" name="tem_transporte" ${chk('tem_transporte')} />
              <span class="switch-trilho" aria-hidden="true"></span> Transporte de alunos</label>
            <label class="switch col-full"><input type="checkbox" name="tem_eja" ${chk('tem_eja')} />
              <span class="switch-trilho" aria-hidden="true"></span> Atende EJA</label>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Localização</legend>
          <div class="campos auto">
            <label class="col-full">Endereço <input name="endereco" value="${v('endereco')}" /></label>
            <div class="col-full"><div id="ef-mapa" class="mapa-pino"></div></div>
            <label>Latitude <input name="latitude" type="number" step="any" inputmode="decimal" value="${v('latitude')}" /></label>
            <label>Longitude <input name="longitude" type="number" step="any" inputmode="decimal" value="${v('longitude')}" /></label>
            <div class="col-full geo-linha">
              <button type="button" class="mini-btn" id="ef-geo">${ico('visita', { tam: 13 })} Localizar pelo endereço</button>
              <span class="form-hint" id="ef-geo-dica" aria-live="polite">Clique no mapa ou arraste o pino para acertar o ponto. É a localização que permite ao SATE calcular o tempo de viagem do ônibus.</span>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Contato</legend>
          <div class="campos auto">
            <label class="col-full">E-mail institucional <input name="email" type="email" value="${v('email')}" /></label>
            <div class="col-full">${phonesEditorHtml(u?.telefones)}</div>
          </div>
        </fieldset>

        <fieldset class="form-grupo">
          <legend>Cadastros e links</legend>
          <div class="campos auto">
            <label>INEP <input name="inep" value="${v('inep')}" /></label>
            <label class="col-full">Site APM <input name="site_apm" value="${v('site_apm')}" /></label>
          </div>
        </fieldset>

        <div class="form-foot">
          ${novo ? '' : `<button type="button" class="mini-btn no" id="ef-del">${ico('excluir')} Excluir escola</button>`}
          <span id="ef-msg" class="auth-msg"></span>
          <button type="submit" id="ef-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo', voltar });

  document.getElementById('ef-del')?.addEventListener('click', () => removerEscola(u, ctx));
  // As ofertas que a rede já usa completam a lista (a consulta está em cache).
  getUnidades().then((todas) => {
    const sel = document.getElementById('esc-form')?.oferta;
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = opcoes([...OFERTAS_BASE, ...todas.map(x => x.oferta).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt'))], atual || u?.oferta);
    sel.value = atual;
  }).catch(() => { /* fica a lista base */ });

  montarPhonesEditor(document.getElementById('esc-form'));
  document.getElementById('esc-form').addEventListener('submit', (e) => salvar(e, u, ctx));
  document.getElementById('ef-geo').addEventListener('click', localizar);

  // Mapa com pino (spec 2026-10-03, D15): o que o OpenStreetMap não acha
  // pelo endereço, a pessoa acerta olhando. Sem rede ou com o CDN fora, o
  // mapa não monta e o formulário segue com latitude e longitude à mão.
  const f = document.getElementById('esc-form');
  const mapaEl = document.getElementById('ef-mapa');
  const num = (v) => (String(v).trim() === '' ? null : Number(v));
  mapaAtual = null;
  montarMapaPino(mapaEl, {
    lat: num(f.latitude.value), lng: num(f.longitude.value),
    // O pino é gesto da pessoa: latitude e longitude passam a contar como
    // digitadas (marcarTocado), senão o Esc perderia o ponto sem perguntar.
    aoMover: (lat, lng) => {
      marcarTocado(f.latitude); marcarTocado(f.longitude);
      f.latitude.value = lat.toFixed(6); f.longitude.value = lng.toFixed(6);
    },
  }).then((m) => {
    // O Leaflet carrega de forma assíncrona: se o formulário foi fechado
    // (ou aberto de novo) enquanto isso, esta resposta é de um modal que
    // não existe mais e não pode tomar o lugar do mapa do modal atual.
    if (document.getElementById('ef-mapa') !== mapaEl) return;
    mapaAtual = m;
    if (!m) (mapaEl.closest('.col-full') || mapaEl).setAttribute('hidden', '');
  });
  // Coordenada digitada à mão: o pino acompanha.
  const aoDigitar = () => {
    const lat = num(f.latitude.value), lng = num(f.longitude.value);
    if (temCoordenada(lat, lng)) mapaAtual?.mover(lat, lng);
  };
  f.latitude.addEventListener('change', aoDigitar);
  f.longitude.addEventListener('change', aoDigitar);
}

// Endereço → latitude e longitude, pelo OpenStreetMap. Preenche os campos
// e NÃO grava: quem salva é a pessoa, depois de conferir no mapa - um
// endereço ambíguo pode cair na rua de mesmo nome em outro bairro.
//
// Primeira de duas cópias desta ligação (a outra é a guia Locais do
// SATE): ~25 linhas iguais esperam o terceiro caso para virar
// componente (R13).
async function localizar() {
  const f = document.getElementById('esc-form');
  const btn = document.getElementById('ef-geo');
  const dica = document.getElementById('ef-geo-dica');
  btn.disabled = true;
  dica.textContent = 'Procurando…';
  try {
    const r = await geocodificar(f.endereco.value);
    if (!r) {
      dica.textContent = 'Endereço não encontrado. Dá para copiar as coordenadas do Google Maps: clique com o botão direito no lugar e clique nos números.';
      return;
    }
    marcarTocado(f.latitude); marcarTocado(f.longitude);   // "Localizar" também é gesto dela
    f.latitude.value = r.lat.toFixed(6);
    f.longitude.value = r.lng.toFixed(6);
    mapaAtual?.mover(r.lat, r.lng);
    dica.innerHTML = `Encontrado: ${esc(r.formatado)} · <a href="${esc(linkMaps(r.lat, r.lng))}" target="_blank" rel="noopener">conferir no mapa</a> antes de salvar.`;
  } catch (err) {
    dica.textContent = err?.name === 'AbortError' ? 'O serviço de mapa não respondeu. Tente de novo em instantes.' : (err?.message || String(err));
  } finally {
    btn.disabled = false;
  }
}

// Os dois campos andam juntos: meia coordenada não localiza nada, e
// gravar só a latitude deixaria o trajeto do SATE com uma parada que
// parece ter localização e não tem.
function coordenadas(f) {
  const lat = f.latitude.value.trim(), lng = f.longitude.value.trim();
  return temCoordenada(lat, lng)
    ? { latitude: Number(lat), longitude: Number(lng) }
    : { latitude: null, longitude: null };
}

async function salvar(e, u, ctx) {
  e.preventDefault();
  const f = e.target;
  const msg = document.getElementById('ef-msg'); msg.className = 'auth-msg';
  const payload = {
    nome: f.nome.value.trim(),
    apelido: f.apelido.value.trim() || null,
    nome_oficial: f.nome_oficial.value.trim() || null,
    segmento: f.segmento.value.trim() || null,
    endereco: f.endereco.value.trim() || null,
    ...coordenadas(f),
    email: f.email.value.trim() || null,
    oferta: f.oferta.value.trim() || null,
    inep: f.inep.value.trim() || null,
    site_apm: f.site_apm.value.trim() || null,
    tem_transporte: f.tem_transporte.checked,
    tem_eja: f.tem_eja.checked,
  };
  if (!payload.nome) return falhaNoCampo(msg, f.nome, 'Informe o nome.');
  const telefones = lerPhonesEditor(f);

  const btn = document.getElementById('ef-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = u ? (await atualizarUnidade(u.id, payload), u.id) : (await criarUnidade(payload)).id;
    await sincronizarTelefones({ unidadeId: id }, telefones);
    // Recarrega ANTES de fechar: com `voltar`, fechar reabre a ficha, e ela
    // deve ler a lista já atualizada - não disputar a mesma consulta.
    await ctx.recarregar();
    fecharModal();
    toast({ titulo: u ? 'Escola atualizada' : 'Escola cadastrada', texto: payload.nome, tipo: 'sucesso' });
  } catch (err) {
    // Erro de gravação: inline quando dá para corrigir no formulário
    // aberto, toast quando não dá - reportarErro decide pelo código.
    reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
    btn.disabled = false; btn.textContent = u ? 'Salvar' : 'Criar';
  }
}

export async function removerEscola(u, ctx) {
  const ok = await confirmar(`Excluir a escola "${u.nome}"?`,
    { detalhe: 'Esta ação não pode ser desfeita.', textoOk: 'Excluir', perigo: true });
  if (!ok) return;
  try {
    await excluirUnidade(u.id);
    // A pilha inteira: o formulário abre sobre a ficha, e voltar para a
    // ficha de uma escola que acabou de ser excluída não faz sentido.
    fecharModal({ tudo: true });
    await ctx.recarregar();
    toast({ titulo: 'Escola removida', texto: u.nome, tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível excluir' });
  }
}
