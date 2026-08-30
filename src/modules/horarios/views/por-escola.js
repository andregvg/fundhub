// ============================================================
// FundHub - horarios/views/por-escola.js
// Aba "Por escola": escolhida a unidade, UMA grade com a semana de
// todos os servidores exibidos, faixas para os blocos que se
// sobrepõem, tira de cobertura sob cada dia e a divergência marcada
// no minuto exato.
//
// A cobertura é regra de ESCOLA - a sede da SME não entra nela.
// ============================================================
import { DIAS, getBlocos, COBERTURA_INICIO, COBERTURA_FIM } from '../horarios.model.js';
// getExibicao/definirCobertura moram em exibicao.model.js e
// ordenarParaGrade em grade.model.js desde a divisão da Task 6
// (R11 - horarios.model.js estourou 250 linhas). Ver progress.md, Ruling 13.
import { getExibicao, definirCobertura } from '../exibicao.model.js';
import { ordenarParaGrade } from '../grade.model.js';
import { getServidoresDaUnidade, vinculosAbertos } from '../../servidores/servidores.model.js';
import { getCargosGestao, rotulaCargo } from '../../servidores/vinculos.model.js';
import { getUnidades } from '../../escolas/escolas.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { loading, emptyState, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';
import { gradeHtml, legendaHtml, ligarSelecao, reaplicarSelecao } from './grade.js';
import { abrirJornada } from './jornada.js';

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

  // `destruir()` só remove o listener de `document` da instância -
  // não invalida a variável. Sem zerar aqui, `montarBusca()` acha
  // `busca` "verdadeiro" e pinta a árvore ANTIGA (já desanexada) em
  // vez de montar uma instância nova no `#h-uni-box` recém-criado
  // abaixo. É o que quebrava o seletor ao trocar de aba e voltar.
  busca?.destruir();
  busca = null;
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
  // `corpo.innerHTML` acabou de ser reconstruído - sem isto, quem
  // estava selecionado (ex.: editou a jornada pelo lápis, que seleciona
  // de carona) fica com `tem-selecao` na raiz e nenhum `.sel` nos
  // filhos novos, e a grade inteira aparece esmaecida.
  reaplicarSelecao(corpo);
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
    if (editar) abrirEdicaoJornada(editar.dataset.editar);
  });
}

// Abre a gaveta da jornada semanal (views/jornada.js) para o servidor
// clicado nesta escola - `blocos` já é a lista inteira da unidade;
// `abrirJornada` filtra por servidor e dia internamente.
function abrirEdicaoJornada(servidorId) {
  const linha = linhas.find(l => l.servidor.id === servidorId);
  if (!linha) return;
  abrirJornada({ servidor: linha.servidor, unidadeId, blocos, recarregar: carregar });
}
