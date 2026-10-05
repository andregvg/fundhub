// ============================================================
// FundHub - sate/views/frota-form.js
// Os modais da página Frota: Nova/Editar frota e Rótulos.
// Spec: 2026-09-26-sate-frota-e-disponibilidade-design.md § D2.
//
// Um formulário para os dois jeitos de frota: SEM fim = em aberto (abre
// pela abrir_frota(), que encerra a anterior do MESMO rótulo e tipo); COM
// fim = lote que soma. A pessoa não precisa saber a diferença de
// mecanismo - só se a frota tem prazo.
// ============================================================
import {
  TIPOS, getRotulos, criarRotulo, arquivarRotulo, excluirRotulo,
  abrirFrota, criarLote, editarFrota,
} from '../frota.model.js';
import { esc, val, falhaNoCampo } from '../../../shared/dom.js';
import { hojeISO } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { reportarErro, loading } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

const NOVO = '__novo__';

export async function abrirFormFrota({ frota = null, aoSalvar }) {
  const f = frota;
  const rotulos = await getRotulos().catch(() => []);
  // Editando uma frota de rótulo ARQUIVADO: ele não vem na lista ativa,
  // mas precisa aparecer selecionado.
  const lista = f && !rotulos.some(r => r.id === f.rotulo_id)
    ? [...rotulos, { id: f.rotulo_id, nome: f.rotulo?.nome || 'rótulo arquivado' }] : rotulos;

  abrirModal(`
    ${modalHead(f ? 'Editar frota' : 'Nova frota', f ? esc(f.rotulo?.nome || '') : 'Veículos disponíveis para o SATE')}
    <div class="modal-body">
      <form id="ff-form" class="esc-form">
        <div class="form-grid">
          <label class="col-full">Rótulo
            <select id="ff-rotulo" required>
              <option value="">Selecione…</option>
              ${lista.map(r => `<option value="${esc(r.id)}" ${f?.rotulo_id === r.id ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')}
              <option value="${NOVO}">+ Novo rótulo…</option>
            </select>
            <small class="form-hint">De onde vêm os veículos ("Regular", "Feira do Livro").</small></label>
          <label class="col-full" id="ff-novo-w" hidden>Nome do novo rótulo
            <input id="ff-novo" type="text" maxlength="60" /></label>
          <label>Tipo
            <select id="ff-tipo">${TIPOS.map(t => `<option value="${esc(t.id)}" ${f?.tipo === t.id ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}</select></label>
          <label>Veículos <input id="ff-qtd" type="number" min="1" inputmode="numeric" value="${esc(String(f?.quantidade ?? ''))}" required /></label>
          <label>Início <input id="ff-inicio" type="date" value="${esc(f?.inicio || hojeISO())}" required /></label>
          <label>Fim <input id="ff-fim" type="date" value="${esc(f?.fim || '')}" />
            <small class="form-hint">Vazio = em aberto, sem data para acabar.</small></label>
          <label class="col-full">Observação <input id="ff-obs" type="text" value="${esc(f?.observacao || '')}" /></label>
        </div>
        <p class="form-hint" id="ff-dica">${f ? 'Para mudar a quantidade a partir de um dia, use Nova frota com o mesmo rótulo: a anterior é encerrada na véspera.' : 'Sem fim, esta frota substitui a aberta do mesmo rótulo e tipo a partir do início.'}</p>
        <div class="form-foot">
          <span id="ff-msg" class="auth-msg"></span>
          <button type="submit" class="btn-primary" id="ff-ok">${f ? 'Salvar' : 'Cadastrar frota'}</button>
        </div>
      </form>
    </div>`, { tamanho: 'medio' });

  const sel = document.getElementById('ff-rotulo');
  sel.addEventListener('change', () => {
    document.getElementById('ff-novo-w').hidden = sel.value !== NOVO;
    if (sel.value === NOVO) document.getElementById('ff-novo').focus();
  });

  document.getElementById('ff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ff-msg'); msg.className = 'auth-msg';
    const qtd = parseInt(val('ff-qtd'), 10);
    const inicio = val('ff-inicio'), fim = val('ff-fim') || null;
    if (!sel.value) return falhaNoCampo(msg, sel, 'Escolha ou crie o rótulo.');
    if (sel.value === NOVO && !val('ff-novo')) return falhaNoCampo(msg, '#ff-novo', 'Informe o nome do novo rótulo.');
    if (!qtd || qtd < 1) return falhaNoCampo(msg, '#ff-qtd', 'Informe quantos veículos.');
    if (!inicio) return falhaNoCampo(msg, '#ff-inicio', 'Informe o início.');
    if (fim && fim < inicio) return falhaNoCampo(msg, '#ff-fim', 'A data de fim não pode ser antes do início.');

    const btn = document.getElementById('ff-ok'); btn.disabled = true;
    try {
      let rotuloId = sel.value;
      if (sel.value === NOVO) {
        const nome = val('ff-novo');
        const r = await criarRotulo(nome);
        rotuloId = r.id;
        // Rótulo criado: vira opção de verdade e fica selecionado ANTES
        // de tentar salvar a frota. Sem isto, se o salvamento falhar
        // (ex.: já existe frota em aberto com esse tipo), o formulário
        // continua com "+ Novo rótulo…" marcado e tentar de novo recria
        // o rótulo - que já existe, e falha com "Já existe um rótulo…".
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = nome;
        sel.querySelector(`option[value="${NOVO}"]`).before(opt);
        sel.value = r.id;
        document.getElementById('ff-novo-w').hidden = true;
      }
      const dados = { rotuloId, tipo: document.getElementById('ff-tipo').value, quantidade: qtd, inicio, fim, observacao: val('ff-obs') || null };
      let aviso = '';
      if (f) {
        await editarFrota(f.id, dados);
        // Regra do controlador (spec D2): a tela não consulta viagens
        // agendadas antes de avisar - qualquer redução PODE deixar dia já
        // marcado sem veículo, mesmo que nenhuma viagem seja afetada de
        // fato. Custo aceito: um aviso ocasional sem efeito real.
        const reduziuQtd = qtd < f.quantidade;
        const atrasouInicio = inicio > f.inicio;
        const encurtouFim = fim ? (!f.fim || fim < f.fim) : false;
        if (reduziuQtd || atrasouInicio || encurtouFim) {
          aviso = 'Dias já agendados podem ficar sem veículo - confira a Disponibilidade.';
        }
      }
      else if (fim) await criarLote(dados);
      else await abrirFrota(dados);
      fecharModal();
      toast({
        titulo: f ? 'Frota atualizada' : 'Frota cadastrada',
        texto: aviso,
        tipo: aviso ? 'atencao' : 'sucesso',
      });
      aoSalvar?.();
    } catch (err) {
      reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
      btn.disabled = false;
    }
  });
}

// Rótulos: arquivar some da escolha e preserva o nome nas frotas antigas;
// excluir só o que nunca foi usado (o banco recusa o resto).
//
// Os ouvintes ficam no #rt-corpo, que não é recriado - só o conteúdo dele
// é. Ligar dentro de pintarRotulos() empilharia um ouvinte por repintura.
export async function abrirRotulos({ aoFechar } = {}) {
  abrirModal(`
    ${modalHead('Rótulos', 'O nome que explica de onde vieram os veículos')}
    <div class="modal-body"><div id="rt-corpo">${loading()}</div></div>`, { tamanho: 'estreito' });
  const box = document.getElementById('rt-corpo');
  const depois = async () => { await pintarRotulos(); aoFechar?.(); };

  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await criarRotulo(val('rt-nome')); await depois(); }
    catch (err) { reportarErro(err, { msg: document.getElementById('rt-msg'), titulo: 'Não foi possível criar' }); }
  });
  box.addEventListener('click', async (e) => {
    const arq = e.target.closest('[data-arq]');
    const del = e.target.closest('[data-del]');
    if (!arq && !del) return;
    try {
      if (arq) await arquivarRotulo(arq.dataset.arq, arq.dataset.ativo !== '1');
      else {
        if (!(await confirmar('Excluir este rótulo?', {
          detalhe: 'Só é possível excluir rótulo que nunca foi usado em uma frota.', textoOk: 'Excluir', perigo: true,
        }))) return;
        await excluirRotulo(del.dataset.del);
      }
      await depois();
    } catch (err) { reportarErro(err, { titulo: 'Não foi possível concluir' }); }
  });
  await pintarRotulos();
}

async function pintarRotulos() {
  const box = document.getElementById('rt-corpo');
  if (!box) return;
  const rotulos = await getRotulos({ incluirArquivados: true }).catch(() => []);
  box.innerHTML = `
    <div class="rt-lista">
      ${rotulos.map(r => `<div class="fr-lote ${r.ativo ? '' : 'inativo'}">
        <b>${esc(r.nome)}</b>
        ${r.ativo ? '' : '<span class="tag st-negado">arquivado</span>'}
        <span class="fr-orfa-acoes">
          <button type="button" class="mini-btn" data-arq="${esc(r.id)}" data-ativo="${r.ativo ? '1' : '0'}">${r.ativo ? 'Arquivar' : 'Reativar'}</button>
          <button type="button" class="mini-btn no" data-del="${esc(r.id)}" aria-label="Excluir rótulo ${esc(r.nome)}">${ico('excluir')}</button>
        </span>
      </div>`).join('') || '<p class="form-hint">Nenhum rótulo ainda.</p>'}
    </div>
    <form id="rt-form" class="esc-form rt-novo">
      <label for="rt-nome">Novo rótulo</label>
      <input id="rt-nome" type="text" maxlength="60" placeholder="Ex.: Cirem" />
      <button type="submit" class="mini-btn">${ico('adicionar')} Criar</button>
    </form>
    <p class="auth-msg" id="rt-msg"></p>`;
}
