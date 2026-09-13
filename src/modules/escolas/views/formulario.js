// ============================================================
// FundHub - escolas/views/formulario.js  (criar, editar, excluir)
// ============================================================
import { criarUnidade, atualizarUnidade, excluirUnidade } from '../escolas.model.js';
import { sincronizarTelefones } from '../../telefones/telefones.model.js';
import { geocodificar, linkMaps, temCoordenada } from '../../locais/locais.model.js';
import { esc, falha } from '../../../shared/dom.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { phonesEditorHtml, montarPhonesEditor, lerPhonesEditor } from '../../../shared/ui/phones.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

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
            <label>Segmento <input name="segmento" list="segs" value="${v('segmento')}" />
              <datalist id="segs"><option>EMEF</option><option>EMEI</option><option>CEI</option><option>EMEPB</option><option>CONVENIADA</option></datalist>
            </label>
            <label>Oferta <input name="oferta" placeholder="EF1/EF2" value="${v('oferta')}" /></label>
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
            <label>Latitude <input name="latitude" type="number" step="any" inputmode="decimal" value="${v('latitude')}" /></label>
            <label>Longitude <input name="longitude" type="number" step="any" inputmode="decimal" value="${v('longitude')}" /></label>
            <div class="col-full geo-linha">
              <button type="button" class="mini-btn" id="ef-geo">${ico('visita', { tam: 13 })} Localizar pelo endereço</button>
              <span class="form-hint" id="ef-geo-dica" aria-live="polite">A localização é o que permite ao SATE calcular o tempo de viagem do ônibus.</span>
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
          <span id="ef-msg" class="auth-msg"></span>
          <button type="submit" id="ef-save" class="btn-primary">${novo ? 'Criar' : 'Salvar'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'largo', voltar });

  montarPhonesEditor(document.getElementById('esc-form'));
  document.getElementById('esc-form').addEventListener('submit', (e) => salvar(e, u, ctx));
  document.getElementById('ef-geo').addEventListener('click', localizar);
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
    f.latitude.value = r.lat.toFixed(6);
    f.longitude.value = r.lng.toFixed(6);
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
  if (!payload.nome) return falha(msg, 'Informe o nome.');
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
    fecharModal();
    await ctx.recarregar();
    toast({ titulo: 'Escola removida', texto: u.nome, tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível excluir' });
  }
}
