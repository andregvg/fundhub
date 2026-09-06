// ============================================================
// FundHub - calendario/views/escalas.js
// Quais datas são TDC e em que fase do revezamento. É esta tela que
// dá sentido às abas de escala do módulo Horários: a jornada é
// escrita contra o NOME do dia, e é aqui que o nome é dado.
//
// Duas visões:
//   Rede   - as datas oficiais, valendo para todas as escolas;
//   Escola - as remarcações daquela unidade sobrepondo a rede.
//
// A geração nunca grava direto: propõe uma tabela que o admin edita
// e da qual pode descartar linhas.
// ============================================================
import { gerarPropostaTDC, getEscalasRede, getEscalasUnidade, definirEscalaRede,
  definirEscalaUnidade, limparEscalaUnidade, getCalendarioMes } from '../calendario.model.js';
import { getEscalas, rotulaEscala, ESCALAS_PADRAO } from '../../horarios/escalas.model.js';
import { getLocais } from '../../escolas/escolas.model.js';
import { abrirTiposEscala } from './tipos-escala.js';
import { esc } from '../../../shared/dom.js';
import { fmtData, fmtExtenso, hojeISO } from '../../../shared/format.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';

const anoAtual = () => Number(hojeISO().slice(0, 4));

// Sentinela do <select> da visão Escola para "cancelado" (escala nula
// gravada em escala_unidade). Não precisa ser uma chave "impossível de
// digitar" no formulário - quem garante de verdade que uma chave real
// nunca colide com isto é o CHECK da migration 025
// (`chave = lower(btrim(chave)) and chave <> ''`, sem espaço em branco
// e sempre minúsculo); o `pattern` do formulário é só UX (R15).
const CANCELADO = '__CANCELADO__';

let unidadeId = '';     // '' = visão da rede
let ano = anoAtual();
let proposta = null;    // [{ data, escala }] enquanto está sendo editada
let ctxAtual = null;
let catalogo = [];      // getEscalas() - rótulos vêm daqui, nunca de ESCALAS_PADRAO direto
let busca = null;       // instância de criarBuscaSelecao - destruída a cada reentrada na aba
let geracao = 0;        // token de reentrância - ver renderEscalas

export async function renderEscalas(box, ctx) {
  const minhaGeracao = ++geracao;
  ctxAtual = ctx;
  proposta = null;

  box.innerHTML = `
    <div class="toolbar">
      <div id="cal-esc-uni"></div>
      <label class="search compacta">${ico('calendario')}
        <input type="number" id="cal-esc-ano" min="2020" max="2099" value="${ano}"
               aria-label="Ano" /></label>
      ${ctx.podeEditar ? `<button type="button" class="btn-secundario" id="cal-esc-gerar">
        ${ico('adicionar')} Gerar TDC do ano</button>` : ''}
      ${ctx.podeEditar ? `<button type="button" class="mini-btn" id="cal-esc-tipos">
        ${ico('editar', { tam: 14 })} Tipos de escala</button>` : ''}
    </div>
    <p class="form-hint" id="cal-esc-dica"></p>
    <div id="cal-esc-corpo">${loading()}</div>`;

  // O catálogo é carregado uma vez por abertura da tela; carregar()
  // e pintarProposta() leem `catalogo`, nunca ESCALAS_PADRAO direto -
  // senão um rótulo renomeado pelo admin não apareceria aqui. Uma
  // falha de rede isolada (não a degradação 42P01 que getEscalas() já
  // trata) cai no mesmo padrão dos três de sempre - nunca em `[]`, que
  // deixaria cada <select> da visão Rede com só a opção "Sem escala"
  // e um clique acidental apagaria a escala da rede inteira.
  catalogo = await getEscalas().catch(() => [...ESCALAS_PADRAO]);
  // Entre este e o próximo `await`, outra reentrada (troca de aba de
  // volta antes deste resolver) pode ter religado os mesmos ids -
  // quem chegar por último ganha; os demais desistem aqui.
  if (minhaGeracao !== geracao) return;
  document.getElementById("cal-esc-tipos")?.addEventListener("click", () => abrirTiposEscala({ onMudou: aoMudarCatalogo }));

  const locais = await getLocais().catch(() => []);
  if (minhaGeracao !== geracao) return;
  // `destruir()` só remove o listener de `document` da instância
  // anterior - destruir bem aqui, síncrono com a criação logo abaixo,
  // garante que mesmo com reentrada quem chega por último sempre
  // destrói o que estava lá antes de instalar o seu (sem isso, trocar
  // de aba e voltar empilharia um listener de clique-fora por
  // reentrada - o mesmo bug que travou o seletor da gaveta de jornada
  // no B-1).
  busca?.destruir();
  busca = criarBuscaSelecao(document.getElementById('cal-esc-uni'), {
    opcoes: [{ id: '', rotulo: 'Toda a rede', detalhe: 'calendário oficial' }].concat(
      // Escala é por escola: as gerências/subsecretarias internas não entram.
      [...locais].filter(l => l.tipo !== 'interno').sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
        .map(l => ({ id: l.id, rotulo: l.nome, busca: l.apelido || '' }))),
    valor: unidadeId,
    placeholder: 'Toda a rede',
    onChange: (id) => { unidadeId = id; proposta = null; carregar(); },
  });

  document.getElementById('cal-esc-ano').addEventListener('change', (e) => {
    const v = Math.min(2099, Math.max(2020, Number(e.target.value) || anoAtual()));
    e.target.value = v;
    ano = v; proposta = null; carregar();
  });
  document.getElementById('cal-esc-gerar')?.addEventListener('click', gerar);

  carregar();
}

async function carregar() {
  const dica = document.getElementById('cal-esc-dica');
  const corpo = document.getElementById('cal-esc-corpo');
  if (!dica || !corpo) return;   // aba/rota trocou antes de chegar aqui
  dica.textContent = unidadeId
    ? 'O que estiver "seguindo a rede" muda junto com o calendário oficial. O que for remarcado ou cancelado vale só para esta escola.'
    : 'As datas abaixo valem para toda a rede. Cada escola pode remarcar ou cancelar as suas.';
  corpo.innerHTML = loading();

  const de = `${ano}-01-01`, ate = `${ano}-12-31`;
  try {
    if (!unidadeId) {
      pintarRede(await getEscalasRede(de, ate));
    } else {
      const [rede, unidade] = await Promise.all([
        getEscalasRede(de, ate), getEscalasUnidade(unidadeId, de, ate)]);
      pintarEscola(rede, unidade);
    }
  } catch (err) { if (document.getElementById('cal-esc-corpo')) corpo.innerHTML = erroBox(err); }
}

function pintarRede(rows) {
  const corpo = document.getElementById('cal-esc-corpo');
  if (!corpo) return;
  if (!rows.length) {
    corpo.innerHTML = emptyState(ico('calendario', { tam: 32 }), 'Nenhuma data de TDC',
      ctxAtual.podeEditar ? 'Gere a proposta do ano acima para começar.' : 'Nenhuma data de TDC cadastrada.');
    return;
  }
  corpo.innerHTML = `
    <div class="cal-esc-linhas">
      ${rows.map(r => `
        <div class="cal-esc-linha" data-data="${esc(r.data)}">
          <span class="cal-esc-data">${esc(fmtExtenso(r.data))}</span>
          ${ctxAtual.podeEditar ? `
            <select class="cal-esc-sel" aria-label="Escala de ${esc(fmtData(r.data))}">
              ${catalogo.filter(e => e.chave !== 'normal').map(e =>
                `<option value="${esc(e.chave)}" ${r.escala === e.chave ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}
            </select>
            <button type="button" class="mini-btn no cal-esc-del" aria-label="Remover ${esc(fmtData(r.data))} do calendário de TDC">${ico('excluir', { tam: 14 })}</button>`
          : `<span class="tag">${esc(rotulaEscala(r.escala, catalogo))}</span>`}
        </div>`).join('')}
    </div>`;

  corpo.querySelectorAll('.cal-esc-sel').forEach(s => s.addEventListener('change', () => salvarRede(s)));
  corpo.querySelectorAll('.cal-esc-del').forEach(b =>
    b.addEventListener('click', () => removerDataRede(b.closest('.cal-esc-linha').dataset.data)));
}

async function salvarRede(select) {
  const data = select.closest('.cal-esc-linha').dataset.data;
  select.disabled = true;
  try {
    await definirEscalaRede(data, select.value);
    toast({ titulo: 'Escala da rede atualizada', texto: fmtData(data), tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
  } finally {
    carregar();
  }
}

// "Sem escala" era uma opção do <select> que apagava a linha - remoção
// disfarçada. Agora é um botão explícito: a data volta a valer a
// jornada Normal para toda a rede. Os horários de TDC gravados não são
// tocados (a jornada aponta para o NOME da escala, não para a data).
async function removerDataRede(data) {
  const ok = await confirmar(`Remover ${fmtData(data)} do calendário de TDC?`, {
    detalhe: 'A data volta a valer a jornada Normal para toda a rede. Os horários de TDC já cadastrados não são apagados - só deixam de valer nesta data.',
    textoOk: 'Remover', perigo: true,
  });
  if (!ok) return;
  try {
    await definirEscalaRede(data, null);
    toast({ titulo: 'Data removida', texto: fmtData(data), tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível remover', texto: err.message || String(err), tipo: 'erro' });
  } finally {
    carregar();
  }
}

// Três estados por linha (o que faz escala_unidade existir):
//   sem linha em escala_unidade      → "Segue a rede";
//   linha com escala                 → "Remarcado" para aquela escala;
//   linha com escala nula            → "Cancelado" (vence a rede).
function pintarEscola(rede, unidade) {
  const corpo = document.getElementById('cal-esc-corpo');
  if (!corpo) return;
  const redeMap = new Map(rede.map(r => [r.data, r.escala]));
  const uniMap = new Map(unidade.map(r => [r.data, r.escala]));
  const datas = [...new Set([...redeMap.keys(), ...uniMap.keys()])].sort();

  if (!datas.length) {
    corpo.innerHTML = emptyState(ico('calendario', { tam: 32 }), 'Nenhuma data de TDC',
      'Não há datas de TDC nem na rede, nem remarcadas por esta escola.');
    return;
  }

  corpo.innerHTML = `
    <div class="cal-esc-linhas">
      ${datas.map(data => {
        const temOverride = uniMap.has(data);
        const rotuloRede = rotulaEscala(redeMap.get(data) || 'normal', catalogo);
        const valor = !temOverride ? '' : (uniMap.get(data) === null ? CANCELADO : uniMap.get(data));
        return `
          <div class="cal-esc-linha" data-data="${esc(data)}">
            <span class="cal-esc-data">${esc(fmtExtenso(data))}</span>
            ${ctxAtual.podeEditar ? `
              <select class="cal-esc-sel-uni" aria-label="Escala de ${esc(fmtData(data))} nesta escola">
                <option value="" ${valor === '' ? 'selected' : ''}>Segue a rede (${esc(rotuloRede)})</option>
                ${catalogo.filter(e => e.chave !== 'normal').map(e =>
                  `<option value="${esc(e.chave)}" ${valor === e.chave ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}
                <option value="${CANCELADO}" ${valor === CANCELADO ? 'selected' : ''}>Sem TDC nesta escola</option>
              </select>` : `<span class="tag">${!temOverride ? esc(`Segue a rede (${rotuloRede})`)
                : (uniMap.get(data) === null ? 'Sem TDC nesta escola' : esc(rotulaEscala(uniMap.get(data), catalogo)))}</span>`}
          </div>`;
      }).join('')}
    </div>`;

  corpo.querySelectorAll('.cal-esc-sel-uni').forEach(s => s.addEventListener('change', () => salvarEscola(s)));
}

async function salvarEscola(select) {
  const data = select.closest('.cal-esc-linha').dataset.data;
  select.disabled = true;
  try {
    if (select.value === '') await limparEscalaUnidade(unidadeId, data);
    else if (select.value === CANCELADO) await definirEscalaUnidade(unidadeId, data, null);
    else await definirEscalaUnidade(unidadeId, data, select.value);
    toast({ titulo: 'Escala da escola atualizada', texto: fmtData(data), tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível salvar', texto: err.message || String(err), tipo: 'erro' });
  } finally {
    carregar();
  }
}

async function gerar() {
  const corpo = document.getElementById('cal-esc-corpo');
  corpo.innerHTML = loading('Montando a proposta…');
  try {
    // Um não letivo não pode virar TDC. Buscar os 12 meses e reunir os
    // dias marcados como não letivos.
    const meses = await Promise.all(
      Array.from({ length: 12 }, (_, i) => getCalendarioMes(ano, i + 1)));
    const naoLetivos = new Set(meses.flat().filter(d => !d.letivo).map(d => d.data));
    // As chaves da proposta vêm do catálogo real, não do fallback do
    // gerador - se o admin já tiver acrescentado uma terceira
    // variante de TDC, a alternância passa a considerar as três.
    const chaves = catalogo.filter(e => e.chave !== 'normal').map(e => e.chave);
    proposta = gerarPropostaTDC(ano, { naoLetivos, chaves });
    pintarProposta();
  } catch (err) { corpo.innerHTML = erroBox(err); }
}

function pintarProposta() {
  const corpo = document.getElementById('cal-esc-corpo');
  if (!corpo) return;
  if (!proposta.length) {
    corpo.innerHTML = emptyState(ico('calendario', { tam: 32 }), 'Nenhuma data proposta',
      'Nenhuma quarta-feira letiva foi encontrada neste ano.');
    return;
  }
  corpo.innerHTML = `
    <div class="cal-prop">
      <p class="form-hint">${proposta.length} datas propostas. Troque a escala de
        qualquer linha ou descarte a que não valer. Nada é gravado até você
        confirmar.</p>
      <div class="cal-prop-linhas">
        ${proposta.map((p, i) => `
          <div class="cal-prop-linha" data-i="${i}">
            <span class="cal-prop-data">${esc(fmtExtenso(p.data))}</span>
            <select class="cal-prop-esc" aria-label="Escala de ${esc(fmtData(p.data))}">
              ${catalogo.filter(e => e.chave !== 'normal').map(e =>
                `<option value="${esc(e.chave)}" ${p.escala === e.chave ? 'selected' : ''}>${esc(e.rotulo)}</option>`).join('')}
            </select>
            <button type="button" class="mini-btn no cal-prop-x"
                    aria-label="Descartar ${esc(fmtData(p.data))}">${ico('excluir', { tam: 14 })}</button>
          </div>`).join('')}
      </div>
      <div class="form-foot">
        <button type="button" class="btn-secundario" id="cal-prop-cancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="cal-prop-gravar">Gravar ${proposta.length} datas</button>
      </div>
    </div>`;

  // #cal-esc-corpo é reescrito por inteiro a cada chamada (aqui e em
  // carregar()) - os nós antigos (e os listeners abaixo) somem junto,
  // então religar sobre os elementos novos não empilha nada.
  corpo.querySelectorAll('.cal-prop-x').forEach(b => b.addEventListener('click', () => {
    proposta.splice(Number(b.closest('.cal-prop-linha').dataset.i), 1);
    pintarProposta();
  }));
  corpo.querySelectorAll('.cal-prop-esc').forEach(s => s.addEventListener('change', () => {
    proposta[Number(s.closest('.cal-prop-linha').dataset.i)].escala = s.value;
  }));
  document.getElementById('cal-prop-cancelar').addEventListener('click', () => {
    proposta = null; carregar();
  });
  document.getElementById('cal-prop-gravar').addEventListener('click', gravarProposta);
}

async function gravarProposta() {
  const ok = await confirmar(`Gravar ${proposta.length} data(s) de TDC?`, {
    detalhe: unidadeId
      ? 'As datas gravam como remarcação desta escola, por cima do calendário da rede.'
      : 'As datas gravam no calendário da rede, valendo para todas as escolas.',
    textoOk: 'Gravar',
  });
  if (!ok) return;

  // O diálogo do confirmar() fica preso a document.body - sobrevive a uma
  // troca de aba/rota enquanto está aberto. Se a pessoa confirmar já fora
  // desta tela, #cal-esc-corpo pode não existir mais.
  const corpo = document.getElementById('cal-esc-corpo');
  if (!corpo) return;
  corpo.innerHTML = loading('Gravando…');
  const total = proposta.length;
  let falhas = 0;
  // Grava linha a linha e segue mesmo se uma falhar - uma importação
  // que para no meio deixa o calendário pela metade sem ninguém saber.
  for (const p of proposta) {
    try {
      if (unidadeId) await definirEscalaUnidade(unidadeId, p.data, p.escala);
      else await definirEscalaRede(p.data, p.escala);
    } catch { falhas++; }
  }
  proposta = null;
  toast({
    titulo: falhas ? 'Proposta gravada com pendências' : 'Proposta gravada',
    texto: falhas ? `${falhas} de ${total} data(s) não gravaram.` : `${total} data(s) gravadas.`,
    tipo: falhas ? 'atencao' : 'sucesso',
  });
  carregar();
}

// Ao mudar o catálogo pela gaveta de tipos: relê e repinta a tela de
// fundo (proposta aberta, ou a tabela do que já está gravado).
async function aoMudarCatalogo() {
  catalogo = await getEscalas().catch(() => [...ESCALAS_PADRAO]);
  if (proposta) pintarProposta(); else carregar();
}
