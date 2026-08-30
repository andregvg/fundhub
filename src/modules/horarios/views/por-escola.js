// ============================================================
// FundHub - horarios/views/por-escola.js
// Aba "Por escola": escolhida a unidade, UMA grade com a semana de
// todos os servidores exibidos, faixas para os blocos que se
// sobrepõem, tira de cobertura sob cada dia e a divergência marcada
// no minuto exato.
//
// A cobertura é regra de ESCOLA - a sede da SME não entra nela.
// ============================================================
import {
  DIAS, getBlocos, COBERTURA_INICIO, COBERTURA_FIM,
  validarDia, totalDoDia, duracao,
} from '../horarios.model.js';
// getExibicao/definirCobertura moram em exibicao.model.js e
// ordenarParaGrade/posicaoNaBarra/marcasDaBarra em grade.model.js
// desde a divisão da Task 6 (R11 - horarios.model.js estourou 250
// linhas). Ver progress.md, Ruling 13.
import { getExibicao, definirCobertura } from '../exibicao.model.js';
import { ordenarParaGrade, posicaoNaBarra, marcasDaBarra } from '../grade.model.js';
import { getServidoresDaUnidade, vinculosAbertos } from '../../servidores/servidores.model.js';
import { getCargosGestao, rotulaCargo } from '../../servidores/vinculos.model.js';
import { getUnidades } from '../../escolas/escolas.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { loading, emptyState, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { gradeHtml, legendaHtml, ligarSelecao } from './grade.js';
// abrirJornada (Task 8, views/jornada.js) ainda não existe - o lápis
// do chip abre um editor provisório que reaproveita formBloco/linhaDia
// (abaixo). Task 8 troca abrirEdicaoServidor por abrirJornada.
import { formBloco } from './bloco.js';

let unidades = [], idxUnidades = {}, seg = null, busca = null;
let servidores = [], blocos = [], exibicao = [], cargosGestao = new Set();
let linhas = [];           // saída de ordenarParaGrade já filtrada por exibir
let unidadeId = '';
let ultimoParam;   // valor de ctx.unidadeId visto no último render - distingue
                    // navegação nova (deep link mudou) de troca de aba (mesmo ctx).
let ctxAtual = null;

export async function renderPorEscola(box, ctx) {
  ctxAtual = ctx;
  if (ctx.unidadeId !== ultimoParam) {
    unidadeId = ctx.unidadeId || '';
    ultimoParam = ctx.unidadeId;
  }

  busca?.destruir();
  box.innerHTML = `
    <div class="toolbar">
      <div id="h-uni-box"></div>
      <span class="count" id="h-count"></span>
    </div>
    <div id="h-seg" class="toolbar-linha"></div>
    <div id="h-corpo"></div>`;

  // Delegados no container ESTÁVEL (#h-corpo não é recriado por
  // `carregar()`, só o innerHTML muda) - ligar uma vez só aqui evita
  // empilhar listener a cada recarga.
  const corpo = document.getElementById('h-corpo');
  ligarSelecao(corpo);
  ligarEventosCorpo(corpo);

  try {
    unidades = await getUnidades();
    idxUnidades = indexarUnidades(unidades);
  } catch (err) { corpo.innerHTML = erroBox(err); return; }

  // O seletor respeita o segmento: quem cuida da Educação Infantil não
  // precisa rolar por 90 EMEFs para achar o seu CEI. A sede não tem
  // segmento - fica sempre visível, filtro nenhum a esconde.
  seg = criarFiltroSegmento(document.getElementById('h-seg'), {
    perfil: ctx.perfil, chaveMemoria: 'fundhub:seg:horarios',
    onChange: () => { montarBusca(); if (!unidadeId) limparCorpo(); },
  });
  montarBusca();

  if (unidadeId) carregar(); else limparCorpo();
}

function opcoesUnidade() {
  const lista = ctxAtual.locais.filter(l =>
    l.tipo === 'sede' || seg.combinaPorUnidade(l.id, idxUnidades));
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(l => ({ id: l.id, rotulo: l.nome, detalhe: l.tipo === 'sede' ? 'SME' : '', busca: l.apelido || '' }));
}

function montarBusca() {
  const opcoes = opcoesUnidade();
  if (unidadeId && !opcoes.some(o => o.id === unidadeId)) unidadeId = '';

  if (busca) { busca.definirOpcoes(opcoes); busca.definirValor(unidadeId); return; }
  busca = criarBuscaSelecao(document.getElementById('h-uni-box'), {
    opcoes, valor: unidadeId, placeholder: 'Buscar escola…',
    vazioTexto: 'Nenhuma escola com esse nome',
    onChange: (id) => { unidadeId = id; carregar(); },
  });
}

function limparCorpo() {
  document.getElementById('h-corpo').innerHTML = emptyState(ico('horario', { tam: 32 }), 'Escolha uma escola',
    'Selecione a unidade acima para ver e editar a jornada da equipe gestora.');
  document.getElementById('h-count').textContent = '';
}

async function carregar() {
  const corpo = document.getElementById('h-corpo');
  if (!unidadeId) { limparCorpo(); return; }
  corpo.innerHTML = loading();

  try {
    [servidores, blocos, exibicao, cargosGestao] = await Promise.all([
      getServidoresDaUnidade(unidadeId),
      getBlocos(unidadeId),
      getExibicao(unidadeId),
      getCargosGestao(),
    ]);
  } catch (err) { corpo.innerHTML = erroBox(err); return; }

  document.getElementById('h-count').textContent = `${servidores.length} servidor(es) vinculado(s)`;

  if (!servidores.length) {
    corpo.innerHTML = emptyState(ico('equipe', { tam: 32 }), 'Nenhum servidor vinculado',
      `Esta unidade não tem ninguém com vínculo aberto. Cadastre em
       <a href="#/servidores?unidade=${esc(unidadeId)}">Servidores</a>.`);
    return;
  }

  // Cargo NESTA unidade, não a união de todos os vínculos da pessoa -
  // é o que decide se ela é equipe gestora aqui.
  const cargoDe = (s) => rotulaCargo(vinculosAbertos(s).find(v => v.unidade_id === unidadeId)?.papel || '');
  const itens = ordenarParaGrade(servidores, { exibicao, cargosGestao, cargoDe });
  linhas = itens.filter(it => it.exibir);
  const fora = itens.filter(it => !it.exibir);

  // A janela 7h00–18h20 é regra de ESCOLA: é o horário em que precisa
  // haver alguém da equipe gestora na unidade. Não se aplica à sede.
  const local = ctxAtual.locais.find(l => l.id === unidadeId);
  const mostrarCobertura = local?.tipo !== 'sede';

  corpo.innerHTML =
    (mostrarCobertura ? `<p class="form-hint">Cobertura da escola: ${esc(COBERTURA_INICIO)} às ${esc(COBERTURA_FIM)}.</p>` : '')
    + legendaHtml(linhas, { podeEditar: ctxAtual.podeEditar })
    + gradeHtml(DIAS, { linhas, blocosDe, mostrarCobertura })
    + naoExibidosHtml(fora);
}

const blocosDe = (servidorId, dia) =>
  blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia);

// Servidor com vínculo aberto que não entra na grade por padrão
// (cargo comum, sem linha em horario_exibicao). Fica recolhido para
// não afogar a grade, com um jeito explícito de acrescentar.
function naoExibidosHtml(fora) {
  if (!fora.length) return '';
  return `<details class="hg-fora">
    <summary>${fora.length} servidor(es) vinculado(s) fora da grade</summary>
    ${fora.map(l => `<div class="hg-fora-item">
      <span>${esc(l.servidor.nome)}</span>
      <span class="hg-cargo">${esc(l.cargo)}</span>
      ${ctxAtual.podeEditar ? `<button type="button" class="mini-btn" data-incluir="${esc(l.servidor.id)}">
        ${ico('adicionar')} Incluir na grade</button>` : ''}
    </div>`).join('')}
  </details>`;
}

// ── Eventos delegados no corpo (ligados uma vez, em renderPorEscola) ──
function ligarEventosCorpo(root) {
  root.addEventListener('click', async (e) => {
    const incluir = e.target.closest('[data-incluir]');
    if (incluir) {
      try {
        await definirCobertura(unidadeId, incluir.dataset.incluir, true);
        toast({ titulo: 'Servidor incluído na grade', tipo: 'sucesso' });
        await carregar();
      } catch (err) { reportarErro(err, { titulo: 'Não foi possível incluir na grade' }); }
      return;
    }
    const editar = e.target.closest('[data-editar]');
    if (editar) abrirEdicaoServidor(editar.dataset.editar);
  });
}

// ── Editor provisório da semana de UM servidor (ver nota de import) ──
function abrirEdicaoServidor(servidorId) {
  const linha = linhas.find(l => l.servidor.id === servidorId);
  if (!linha) return;
  const { servidor } = linha;
  const totalSemana = DIAS.reduce((acc, d) => acc + totalDoDia(blocosDe(servidor.id, d.n)), 0);
  const semana = DIAS.map(d => linhaDia(servidor, d, blocosDe(servidor.id, d.n),
    { podeEditar: ctxAtual.podeEditar, unidadeId })).join('');

  abrirDrawer(`
    ${drawerHead('Jornada da semana', `${esc(servidor.nome)} · ${esc(duracao(totalSemana))} na semana`)}
    <div class="drawer-body"><div class="hb-grade" id="hg-edicao">${semana}</div></div>`);

  const box = document.getElementById('hg-edicao');
  box.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const [sid, diaStr, uni] = b.dataset.add.split(':');
    const dia = parseInt(diaStr, 10);
    const nome = DIAS.find(d => d.n === dia)?.nome || '';
    formBloco(null, { servidorId: sid, unidadeId: uni, dia, nome, recarregar: carregar });
  }));
  box.querySelectorAll('[data-bloco]').forEach(b => b.addEventListener('click', () => {
    const bloco = blocos.find(x => x.id === b.dataset.bloco);
    if (!bloco) return;
    const nome = DIAS.find(d => d.n === bloco.dia_semana)?.nome || '';
    formBloco(bloco, {
      servidorId: bloco.servidor_id, unidadeId: bloco.unidade_id, dia: bloco.dia_semana, nome,
      recarregar: carregar,
    });
  }));
}

// A semana de UM servidor em UM local, num dia (marcação .hb-*, a da
// tela antiga). Reaproveitada pela aba "Por servidor" e pelo editor
// provisório acima - por isso não lê nenhum estado de módulo: recebe
// os blocos do dia prontos e onde editar.
export function linhaDia(s, d, doDia, { podeEditar, unidadeId: uni }) {
  const problemas = validarDia(doDia);
  const total = totalDoDia(doDia);

  const barras = doDia.map(b => {
    const p = posicaoNaBarra(b);
    const rotulo = `${hhmm(b.inicio)}–${hhmm(b.fim)}`;
    return `<button type="button" class="hb-bloco ${podeEditar ? 'editavel' : ''}"
      style="left:${p.esquerda}%;width:${p.largura}%"
      data-bloco="${esc(b.id)}"
      title="${esc(rotulo)}${b.obs ? ' · ' + esc(b.obs) : ''}">
      <span>${esc(rotulo)}</span>
    </button>`;
  }).join('');

  const alertas = problemas.map(p =>
    `<span class="hb-prob ${p.nivel}">${ico(p.nivel === 'erro' ? 'erro' : 'atencao', { tam: 12 })} ${esc(p.texto)}</span>`).join('');

  const addBtn = podeEditar
    ? `<button type="button" class="hb-add" data-add="${esc(s.id)}:${d.n}:${esc(uni)}" aria-label="Adicionar bloco em ${esc(d.nome)}">+</button>`
    : '';

  return `<div class="hb-linha ${problemas.some(p => p.nivel === 'erro') ? 'tem-erro' : ''}">
    <div class="hb-dia">${d.curto}</div>
    <div class="hb-track">${eixoHb()}${barras || `<span class="hb-vazio">sem jornada</span>`}</div>
    <div class="hb-info">
      ${total ? `<b>${duracao(total)}</b>` : vazio('sem jornada')}
      ${addBtn}
    </div>
    ${alertas ? `<div class="hb-alertas">${alertas}</div>` : ''}
  </div>`;
}

// O Postgres devolve `time` como '07:00:00' - a tela mostra '07:00'.
const hhmm = (t) => String(t ?? '').slice(0, 5);

// Eixo de horas ao fundo da barra .hb- (só desenhado uma vez por linha).
function eixoHb() {
  return marcasDaBarra().map(m =>
    `<span class="hb-marca" style="left:${m.pos}%"><i></i><em>${m.hora.slice(0, 2)}</em></span>`).join('');
}
