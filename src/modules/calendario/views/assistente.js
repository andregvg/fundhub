// ============================================================
// FundHub - calendario/views/assistente.js
// O assistente "Montar o ano letivo": a pessoa diz o período, o que cai em
// fim de semana, os feriados, os recessos e as reposições, vê a prévia da
// contagem de dias letivos e grava tudo de uma vez. As regras são de
// anoletivo.model.js; aqui só se desenha e se lê o formulário.
// ============================================================
import { feriadosNacionais, montarAno } from '../anoletivo.model.js';
import { upsertDias, getDiasCalendario } from '../calendario.model.js';
import { esc } from '../../../shared/dom.js';
import { MESES, fmtData } from '../../../shared/format.js';
import { modalHead, abrirModal, fecharModal } from '../../../shared/ui/modal.js';
import { reportarErro } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';
import { ico } from '../../../shared/ui/icones.js';

// Cada lista tem o mesmo desenho: linhas de campos com um × e um botão de
// acrescentar. O que muda é o que cada linha pergunta.
const LISTAS = {
  fer: {
    titulo: 'Outros feriados', dica: 'Os municipais e qualquer outro dia sem aula.',
    campos: `<label>Data <input type="date" data-c="data" /></label>
      <label class="ano-nome">Nome <input data-c="nome" placeholder="Ex.: Aniversário da cidade" /></label>`,
  },
  rec: {
    titulo: 'Recessos', dica: 'Um período sem aula. Se vale só para parte do dia, preencha o trecho em que HÁ aula.',
    campos: `<label>De <input type="date" data-c="de" /></label>
      <label>Até <input type="date" data-c="ate" /></label>
      <label class="ano-nome">Nome <input data-c="nome" placeholder="Ex.: Recesso de julho" /></label>
      <label>Aula das <input type="time" data-c="aulaDe" /></label>
      <label>às <input type="time" data-c="aulaAte" /></label>`,
  },
  ext: {
    titulo: 'Dias letivos extras', dica: 'Reposição: um sábado, ou um dia de recesso ou feriado que terá aula (inteiro ou só em parte).',
    campos: `<label>Data <input type="date" data-c="data" /></label>
      <label class="ano-nome">Nome <input data-c="nome" placeholder="Ex.: Reposição" /></label>
      <label>Aula das <input type="time" data-c="aulaDe" /></label>
      <label>às <input type="time" data-c="aulaAte" /></label>`,
  },
};

const listaHtml = (id) => `
  <fieldset class="form-grupo">
    <legend>${LISTAS[id].titulo}</legend>
    <div class="campos">
      <small class="form-hint">${LISTAS[id].dica}</small>
      <div class="ano-linhas" id="ano-${id}"></div>
      <div><button type="button" class="mini-btn" data-add="${id}">${ico('adicionar', { tam: 13 })} Acrescentar</button></div>
    </div>
  </fieldset>`;

const linhaHtml = (id) => `<div class="ano-linha" data-linha>${LISTAS[id].campos}
  <button type="button" class="mini-btn no" data-tirar aria-label="Remover">${ico('excluir')}</button></div>`;

export function abrirAssistente({ aoGravar = () => {} } = {}) {
  abrirModal(`
    ${modalHead('Montar o ano letivo', 'Marca os dias sem aula de uma vez', { icone: 'assistente' })}
    <div class="modal-body">
      <form id="ano-form" class="esc-form">
        <fieldset class="form-grupo">
          <legend>Período</legend>
          <div class="campos duas">
            <label>Início do ano letivo <input id="ano-ini" type="date" required /></label>
            <label>Fim do ano letivo <input id="ano-fim" type="date" required /></label>
          </div>
        </fieldset>
        <fieldset class="form-grupo">
          <legend>Fins de semana</legend>
          <div class="campos">
            <label class="inline"><input type="checkbox" id="ano-sab" checked /> Sábados não são letivos</label>
            <label class="inline"><input type="checkbox" id="ano-dom" checked /> Domingos não são letivos</label>
          </div>
        </fieldset>
        <fieldset class="form-grupo">
          <legend>Feriados nacionais</legend>
          <div class="campos">
            <small class="form-hint">Desmarque o que, na sua rede, tem aula. Carnaval e Corpus Christi são ponto facultativo.</small>
            <div id="ano-nac"><small class="form-hint">Informe o período para ver os feriados.</small></div>
          </div>
        </fieldset>
        ${listaHtml('fer')}${listaHtml('rec')}${listaHtml('ext')}
        <fieldset class="form-grupo">
          <legend>Ao gravar</legend>
          <div class="campos">
            <label class="inline"><input type="checkbox" id="ano-manter" checked /> Manter os dias que já têm registro</label>
            <small class="form-hint">Desmarcado, o que está gravado nestas datas é substituído.</small>
          </div>
        </fieldset>
        <div id="ano-previa" class="ano-previa" aria-live="polite"></div>
        <div class="form-foot"><span id="ano-msg" class="auth-msg"></span>
          <button type="submit" id="ano-gravar" class="btn-primary" disabled>Gravar</button></div>
      </form>
    </div>`, { tamanho: 'largo' });

  const form = document.getElementById('ano-form');
  const desmarcados = new Set();   // feriados nacionais que a pessoa tirou
  let existentes = {}, consulta = 0, calculado = null;

  const linhasDe = (id) => [...document.querySelectorAll(`#ano-${id} [data-linha]`)].map(l =>
    Object.fromEntries([...l.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.value])));

  const pintarNacionais = () => {
    const ini = form.querySelector('#ano-ini').value, fim = form.querySelector('#ano-fim').value;
    const box = document.getElementById('ano-nac');
    if (!ini || !fim || fim < ini) return;
    const anos = [];
    for (let a = Number(ini.slice(0, 4)); a <= Number(fim.slice(0, 4)); a++) anos.push(a);
    box.innerHTML = anos.map(a => `<div class="ano-nac-ano"><b>${a}</b><div class="ano-nac-lista">`
      + feriadosNacionais(a).map(f => `<label class="inline"><input type="checkbox" data-nac="${f.data}" ${desmarcados.has(f.data) ? '' : 'checked'} />
          ${esc(fmtData(f.data).slice(0, 5))} · ${esc(f.nome)}</label>`).join('')
      + '</div></div>').join('');
  };

  const recalcular = () => {
    const previa = document.getElementById('ano-previa'), btn = document.getElementById('ano-gravar');
    const ini = form.querySelector('#ano-ini').value, fim = form.querySelector('#ano-fim').value;
    const nomeDe = new Map(anosNacionais(ini, fim).map(f => [f.data, f.nome]));
    try {
      calculado = montarAno({
        inicio: ini, fim,
        sabadoNaoLetivo: form.querySelector('#ano-sab').checked, domingoNaoLetivo: form.querySelector('#ano-dom').checked,
        feriados: [
          ...[...form.querySelectorAll('[data-nac]')].filter(c => c.checked).map(c => ({ data: c.dataset.nac, nome: nomeDe.get(c.dataset.nac) })),
          ...linhasDe('fer').filter(f => f.data).map(f => ({ data: f.data, nome: f.nome || 'Feriado' })),
        ],
        recessos: linhasDe('rec'), extras: linhasDe('ext'),
        existentes, preservar: form.querySelector('#ano-manter').checked,
      });
    } catch (err) {
      calculado = null; btn.disabled = true;
      previa.innerHTML = ini || fim ? `<div class="sol-aviso">${esc(err.message)}</div>` : '';
      return;
    }
    const r = calculado.resumo, faltam = r.exigidos - r.letivos;
    previa.innerHTML = `
      <div class="ano-previa-tit"><b>${r.letivos}</b> dias letivos${r.parciais ? ` (${r.parciais} em parte)` : ''}
        <small>· ${r.exigidos} é o mínimo exigido</small></div>
      ${faltam > 0 ? `<div class="sol-aviso">Faltam ${faltam} dias para chegar a ${r.exigidos}.</div>` : ''}
      <ul class="ano-previa-lista">
        <li><b>${r.naoLetivos}</b> dias sem aula no período</li>
        <li><b>${calculado.linhas.length}</b> dias serão gravados${r.preservados ? `; <b>${r.preservados}</b> já registrados ficam como estão` : ''}</li>
      </ul>
      <div class="ano-meses">${r.porMes.map(m => `<span class="chip">${esc(MESES[Number(m.mes.slice(5)) - 1].slice(0, 3))}/${esc(m.mes.slice(2, 4))} <b>${m.n}</b></span>`).join('')}</div>`;
    btn.disabled = false;
  };

  const anosNacionais = (ini, fim) => {
    if (!ini || !fim || fim < ini) return [];
    const out = [];
    for (let a = Number(ini.slice(0, 4)); a <= Number(fim.slice(0, 4)); a++) out.push(...feriadosNacionais(a));
    return out;
  };

  // Mudou o período: os feriados nacionais do ano e o que já está gravado nele.
  const aoMudarPeriodo = async () => {
    pintarNacionais();
    const ini = form.querySelector('#ano-ini').value, fim = form.querySelector('#ano-fim').value;
    const meu = ++consulta;
    if (ini && fim && fim >= ini) {
      const dados = await getDiasCalendario(ini, fim).catch(() => ({}));
      if (meu !== consulta) return;
      existentes = dados;
    }
    recalcular();
  };

  form.addEventListener('change', (e) => {
    if (e.target.dataset.nac) { e.target.checked ? desmarcados.delete(e.target.dataset.nac) : desmarcados.add(e.target.dataset.nac); }
    if (e.target.id === 'ano-ini' || e.target.id === 'ano-fim') aoMudarPeriodo(); else recalcular();
  });
  form.addEventListener('input', (e) => { if (e.target.dataset.c) recalcular(); });
  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      document.getElementById(`ano-${add.dataset.add}`).insertAdjacentHTML('beforeend', linhaHtml(add.dataset.add));
      return;
    }
    if (e.target.closest('[data-tirar]')) { e.target.closest('[data-linha]').remove(); recalcular(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!calculado) return;
    const btn = document.getElementById('ano-gravar'), msg = document.getElementById('ano-msg');
    msg.className = 'auth-msg';
    btn.disabled = true; btn.textContent = 'Gravando…';
    try {
      const n = await upsertDias(calculado.linhas);
      fecharModal();
      aoGravar();
      toast({ titulo: 'Ano letivo montado', texto: `${n} dia(s) gravado(s).`, tipo: 'sucesso' });
    } catch (err) {
      // A faixa de aula (dia em parte) precisa da migration 051.
      if (['42703', 'PGRST204'].includes(err?.code)) {
        reportarErro(new Error('O banco ainda não aceita dia letivo em parte. Avise a Gerência para rodar a atualização 051.'), { msg, titulo: 'Não foi possível gravar' });
      } else reportarErro(err, { msg, titulo: 'Não foi possível gravar' });
      btn.disabled = false; btn.textContent = 'Gravar';
    }
  });
}
