// ============================================================
// FundHub - sate/views/frota-painel.js
// O cadastro da frota, dentro da engrenagem do módulo.
// Spec: 2026-09-08-sate-solicitacoes-design.md § D5.
//
// Fica na engrenagem, e não numa aba, porque configurar é interrupção
// curta - é o critério que o hub já usa para escolher entre as duas
// (spec de configurações por módulo, D8).
//
// Três coisas, na ordem em que se pensa nelas:
//   1. qual é a frota vigente, e trocar por outra;
//   2. quais são os reforços com prazo, e criar um;
//   3. os rótulos que dão nome a tudo isso.
// ============================================================
import {
  getRotulos, criarRotulo, arquivarRotulo, excluirRotulo,
  getFrotaAberta, getFrotas, abrirFrota, criarLote, excluirFrota, TIPOS, rotulaTipo,
} from '../frota.model.js';
import { esc, val, falha } from '../../../shared/dom.js';
import { fmtData, hojeISO } from '../../../shared/format.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

export async function pintarFrota(box) {
  if (!box) return;
  box.innerHTML = loading();

  let rotulos, abertas, lotes;
  try {
    [rotulos, abertas, lotes] = await Promise.all([
      getRotulos({ incluirArquivados: true }),
      Promise.all(TIPOS.map(t => getFrotaAberta(t.id))),
      getFrotas({}).then(l => l.filter(f => f.fim)),
    ]);
  } catch (err) { box.innerHTML = erroBox(err); return; }

  const ativos = rotulos.filter(r => r.ativo);
  const optsRotulo = ativos.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('');
  const optsTipo = TIPOS.map(t => `<option value="${esc(t.id)}">${esc(t.rotulo)}</option>`).join('');

  box.innerHTML = `
    <div class="cfg-frota">

      <div class="lbl">Frota vigente</div>
      ${TIPOS.map((t, i) => linhaAberta(t, abertas[i])).join('')}
      <p class="form-hint">Só existe uma frota vigente por tipo de veículo. Cadastrar
        uma nova encerra a anterior na véspera do início.</p>
      <form class="fr-nova" data-form="abrir">
        <label class="lbl">Rótulo <select data-c="rotulo">${optsRotulo}</select></label>
        <label class="lbl">Tipo <select data-c="tipo">${optsTipo}</select></label>
        <label class="lbl">Veículos <input type="number" min="1" data-c="qtd" value="9" /></label>
        <label class="lbl">A partir de <input type="date" data-c="inicio" value="${hojeISO()}" /></label>
        <button type="submit" class="mini-btn">${ico('adicionar')} Abrir frota</button>
      </form>

      <hr class="sep" />

      <div class="lbl">Reforços com prazo</div>
      ${lotes.length ? lotes.map(linhaLote).join('')
        : '<p class="form-hint">Nenhum reforço cadastrado. A Feira do Livro e outros eventos entram aqui.</p>'}
      <form class="fr-nova" data-form="lote">
        <label class="lbl">Rótulo <select data-c="rotulo">${optsRotulo}</select></label>
        <label class="lbl">Tipo <select data-c="tipo">${optsTipo}</select></label>
        <label class="lbl">Veículos <input type="number" min="1" data-c="qtd" value="1" /></label>
        <label class="lbl">De <input type="date" data-c="inicio" value="${hojeISO()}" /></label>
        <label class="lbl">Até <input type="date" data-c="fim" value="${hojeISO()}" /></label>
        <button type="submit" class="mini-btn">${ico('adicionar')} Acrescentar</button>
      </form>

      <hr class="sep" />

      <div class="lbl">Rótulos</div>
      <p class="form-hint">O rótulo explica de onde vieram os veículos de um dia
        (“9 Regular + 16 Feira do Livro”). Um que já foi usado não pode ser
        excluído - arquive-o, e as frotas antigas mantêm o nome.</p>
      ${rotulos.map(linhaRotulo).join('')}
      <form class="fr-nova" data-form="rotulo">
        <label class="lbl">Novo rótulo <input type="text" data-c="nome" placeholder="Ex.: Cirem" /></label>
        <button type="submit" class="mini-btn">${ico('adicionar')} Criar</button>
      </form>

      <p class="auth-msg" id="fr-msg"></p>
    </div>`;

  box.addEventListener('submit', (e) => aoEnviar(e, box));
  box.addEventListener('click', (e) => aoClicar(e, box));
}

const linhaAberta = (tipo, f) => `
  <div class="fr-linha">
    <span class="tag">${esc(tipo.rotulo)}</span>
    ${f
      ? `<b>${f.quantidade}</b> veículo(s) · ${esc(f.rotulo?.nome || 'sem rótulo')}
         <span class="di-meta">desde ${esc(fmtData(f.inicio))}</span>`
      : '<span class="vazio">nenhuma frota vigente</span>'}
  </div>`;

const linhaLote = (f) => `
  <div class="fr-linha" data-lote="${esc(f.id)}">
    <span class="tag">${esc(rotulaTipo(f.tipo))}</span>
    <b>+${f.quantidade}</b> · ${esc(f.rotulo?.nome || 'sem rótulo')}
    <span class="di-meta">${esc(fmtData(f.inicio))} → ${esc(fmtData(f.fim))}</span>
    ${f.solicitacao_id ? '<span class="tag st-em_analise">de uma aprovação</span>' : ''}
    <button type="button" class="mini-btn no" data-del-lote="${esc(f.id)}" aria-label="Remover reforço">${ico('excluir')}</button>
  </div>`;

const linhaRotulo = (r) => `
  <div class="fr-linha ${r.ativo ? '' : 'inativo'}" data-rotulo="${esc(r.id)}">
    <b>${esc(r.nome)}</b>
    ${r.ativo ? '' : '<span class="tag st-negado">arquivado</span>'}
    <button type="button" class="mini-btn" data-arq="${esc(r.id)}" data-ativo="${r.ativo ? '1' : '0'}">
      ${r.ativo ? 'Arquivar' : 'Reativar'}</button>
    <button type="button" class="mini-btn no" data-del-rotulo="${esc(r.id)}" aria-label="Excluir rótulo">${ico('excluir')}</button>
  </div>`;

// Lê os campos `data-c` de um formulário do painel.
const campos = (form) => Object.fromEntries(
  [...form.querySelectorAll('[data-c]')].map(el => [el.dataset.c, el.value]));

async function aoEnviar(e, box) {
  e.preventDefault();
  const form = e.target.closest('[data-form]');
  if (!form) return;
  const msg = box.querySelector('#fr-msg'); msg.className = 'auth-msg';
  const c = campos(form);

  try {
    if (form.dataset.form === 'abrir') {
      if (!c.rotulo) return falha(msg, 'Escolha um rótulo (crie um abaixo, se preciso).');
      await abrirFrota({
        rotuloId: c.rotulo, quantidade: Number(c.qtd), inicio: c.inicio, tipo: c.tipo,
      });
      toast({ titulo: 'Frota vigente atualizada', tipo: 'sucesso' });
    } else if (form.dataset.form === 'lote') {
      if (!c.rotulo) return falha(msg, 'Escolha um rótulo.');
      if (c.fim < c.inicio) return falha(msg, 'A data de fim não pode ser antes do início.');
      await criarLote({
        rotuloId: c.rotulo, quantidade: Number(c.qtd), inicio: c.inicio, fim: c.fim, tipo: c.tipo,
      });
      toast({ titulo: 'Reforço acrescentado', tipo: 'sucesso' });
    } else if (form.dataset.form === 'rotulo') {
      await criarRotulo(c.nome);
      toast({ titulo: 'Rótulo criado', texto: c.nome, tipo: 'sucesso' });
    }
    pintarFrota(box);
  } catch (err) {
    reportarErro(err, { msg, titulo: 'Não foi possível salvar' });
  }
}

async function aoClicar(e, box) {
  const arq = e.target.closest('[data-arq]');
  if (arq) {
    try {
      await arquivarRotulo(arq.dataset.arq, arq.dataset.ativo !== '1');
      pintarFrota(box);
    } catch (err) { reportarErro(err, { titulo: 'Não foi possível arquivar' }); }
    return;
  }

  const delR = e.target.closest('[data-del-rotulo]');
  if (delR) {
    if (!(await confirmar('Excluir este rótulo?', {
      detalhe: 'Só é possível excluir rótulo que nunca foi usado em uma frota.',
      textoOk: 'Excluir', perigo: true,
    }))) return;
    try { await excluirRotulo(delR.dataset.delRotulo); pintarFrota(box); }
    catch (err) { reportarErro(err, { titulo: 'Não foi possível excluir' }); }
    return;
  }

  const delL = e.target.closest('[data-del-lote]');
  if (delL) {
    if (!(await confirmar('Remover este reforço?', {
      detalhe: 'Os veículos deixam de contar no saldo daqueles dias.',
      textoOk: 'Remover', perigo: true,
    }))) return;
    try { await excluirFrota(delL.dataset.delLote); pintarFrota(box); }
    catch (err) { reportarErro(err, { titulo: 'Não foi possível remover' }); }
  }
}
