// ============================================================
// FundHub - horarios/views/por-escola.js
// Aba "Por escola": escolhida a unidade, UMA grade com a semana de
// todos os servidores exibidos, faixas para os blocos que se
// sobrepõem, tira de cobertura sob cada dia e a divergência marcada
// no minuto exato.
//
// A cobertura é regra de ESCOLA - a sede da SME não entra nela.
// ============================================================
import { DIAS, getBlocos, paraHora } from '../horarios.model.js';
import { escolherBlocos, rotulaEscala, variantesDe, conduzDaVariante, varDe } from '../escalas.model.js';
import { janelaDaUnidade } from '../horarios.config.js';
// getExibicao/definirCobertura moram em exibicao.model.js e
// ordenarParaGrade em grade.model.js desde a divisão da Task 6
// (R11 - horarios.model.js estourou 250 linhas). Ver progress.md, Ruling 13.
import { getExibicao, definirCobertura, salvarOrdem, limparExibicao } from '../exibicao.model.js';
import { ordenarParaGrade, janelaDaGrade } from '../grade.model.js';
import { getServidoresDaUnidade, vinculosAbertos } from '../../servidores/servidores.model.js';
import { getCargosGestao, rotulaCargo } from '../../servidores/vinculos.model.js';
import { getUnidades } from '../../escolas/escolas.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { toast } from '../../../shared/ui/toast.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { loading, emptyState, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';
import { gradeHtml, legendaHtml, ligarSelecao, reaplicarSelecao } from './grade.js';
import { abrirJornada } from './jornada.js';

let unidades = [], idxUnidades = {}, seg = null, busca = null;
let servidores = [], blocos = [], exibicao = [], cargosGestao = new Set();
let linhas = [];           // saída de ordenarParaGrade já filtrada por exibir
let unidadeId = '';
let escalaVista = 'normal';
let ultimoParam;   // valor de ctx.unidadeId visto no último render - distingue
                    // navegação nova (deep link mudou) de troca de aba (mesmo ctx).
let ctxAtual = null;

export async function renderPorEscola(box, ctx) {
  ctxAtual = ctx;
  if (ctx.unidadeId !== ultimoParam) {
    unidadeId = ctx.unidadeId || '';
    escalaVista = 'normal';
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
    onChange: (id) => { unidadeId = id; escalaVista = 'normal'; carregar(); },
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

  document.getElementById('h-count').textContent = `${servidores.length} servidor(es) neste local`;

  if (!servidores.length) {
    corpo.innerHTML = emptyState(ico('equipe', { tam: 32 }), 'Nenhum servidor neste local',
      `Esta unidade não tem ninguém com local de trabalho atual. Cadastre em
       <a href="#/servidores?unidade=${esc(unidadeId)}">Servidores</a>.`);
    return;
  }

  // Cargo NESTA unidade, não a união de todos os vínculos da pessoa -
  // é o que decide se ela é equipe gestora aqui.
  const cargoDe = (s) => rotulaCargo(vinculosAbertos(s).find(v => v.unidade_id === unidadeId)?.papel || '');
  const itens = ordenarParaGrade(servidores, { exibicao, cargosGestao, cargoDe });
  linhas = itens.filter(it => it.exibir);
  const fora = itens.filter(it => !it.exibir);

  // A janela de cobertura é regra de ESCOLA: o horário em que precisa
  // haver alguém da equipe gestora na unidade. Varia por tipo (config
  // de rede) e não se aplica à sede.
  const local = ctxAtual.locais.find(l => l.id === unidadeId);
  const mostrarCobertura = local?.tipo === 'escola';
  const janela = janelaDaUnidade(unidades.find(u => u.id === unidadeId));

  // Escalas com dia da semana fixo (TDC) viram sub-linha da grade, não
  // chip: um chip que troca a grade inteira e uma sub-linha que mostra
  // o mesmo dado ao mesmo tempo seriam duas respostas para a pergunta.
  const diasFixos = new Map((ctxAtual.catalogoEscalas || [])
    .filter(e => e.dia_semana != null).map(e => [e.chave, e.dia_semana]));
  const chipsEscala = (ctxAtual.escalasEmUso || []).filter(e => !diasFixos.has(e));

  // Duas origens de sub-linha, mesmo desenho (D6):
  //   • outra ESCALA no mesmo dia - o TDC, que já era assim;
  //   • outra VARIANTE da escala visível - o revezamento da quarta sem
  //     TDC, que assim não precisa de mecanismo próprio.
  const subDeEscala = [...diasFixos]
    .filter(([chave]) => (ctxAtual.escalasEmUso || []).includes(chave))
    .flatMap(([chave, dia]) => variantesDe(blocos, chave, dia)
      .map(v => ({ dia, escala: chave, variante: v, rotulo: rotuloSubLinha(chave, dia, v) })));

  // `.slice(1)`: a variante 1 da escala visível JÁ é o dia regular, a
  // faixa de cima. Repeti-la abaixo seria a mesma informação duas vezes.
  const subDeVariante = DIAS.flatMap(d => variantesDe(blocos, escalaVista, d.n).slice(1)
    .map(v => ({ dia: d.n, escala: escalaVista, variante: v, rotulo: rotuloSubLinha(escalaVista, d.n, v) })));

  const subLinhas = [...subDeVariante, ...subDeEscala];

  // A régua é UMA por grade e precisa caber tudo que a grade desenha -
  // inclusive quem não conta na cobertura. Calculada sobre os blocos já
  // RESOLVIDOS pelo fallback: um bloco herdado esticaria a régua num
  // dia em que ele nem aparece (D9).
  const desenhados = [
    ...DIAS.flatMap(d => linhas.flatMap(l => blocosDe(l.servidor.id, d.n))),
    ...subLinhas.flatMap(s => linhas.flatMap(l => blocosDeEscala(l.servidor.id, s.dia, s.escala, s.variante))),
  ];
  const regua = janelaDaGrade(janela, desenhados);

  const seletorEscala = chipsEscala.length > 1 ? `
    <div class="filters hg-escalas">
      ${chipsEscala.map(e => `<button type="button" class="chip ${e === escalaVista ? 'on' : ''}"
        data-escala="${esc(e)}">${esc(rotulaEscala(e, ctxAtual.catalogoEscalas))}</button>`).join('')}
    </div>` : '';

  corpo.innerHTML = seletorEscala
    + (mostrarCobertura ? `<p class="form-hint">Cobertura da escola: ${esc(paraHora(janela.ini).slice(0, 5))} às ${esc(paraHora(janela.fim).slice(0, 5))}.</p>` : '')
    + resetHtml()
    + legendaHtml(linhas, { podeEditar: ctxAtual.podeEditar })
    // `janela: regua` é a régua (desenho); `janelaCobertura: janela` é a
    // janela configurada (regra) - `lacunasCobertura` continua sendo
    // calculada sobre ela, nunca sobre a régua esticada (D9, achado da
    // revisão do Task 6: sem isto, um dia sem TDC ganhava lacuna
    // fantasma só porque a quarta com TDC esticou a régua da semana).
    + gradeHtml(DIAS, { linhas, blocosDe, mostrarCobertura, janela: regua, janelaCobertura: janela,
        subLinhas, blocosDeEscala, blocosResolvidos })
    + (subLinhas.length ? `<p class="form-hint">Quem não tem horário próprio de TDC cumpre a jornada normal.</p>` : '')
    + naoExibidosHtml(fora);
  // `corpo.innerHTML` acabou de ser reconstruído - sem isto, quem
  // estava selecionado (ex.: editou a jornada pelo lápis, que seleciona
  // de carona) fica com `tem-selecao` na raiz e nenhum `.sel` nos
  // filhos novos, e a grade inteira aparece esmaecida.
  reaplicarSelecao(corpo);
}

// O dia regular desenha SEMPRE a variante 1 - as demais entram como
// sub-linha (D6). O fallback de três degraus mora em escolherBlocos.
const blocosDe = (servidorId, dia) =>
  escolherBlocos(blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia), escalaVista, 1);

// Blocos EXATAMENTE daquela escala e variante (sem o fallback) - a
// sub-linha só DESENHA quem tem horário próprio ali (D6.3).
const blocosDeEscala = (servidorId, dia, escala, variante = 1) =>
  blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia
    && (b.escala || 'normal') === escala && varDe(b) === variante);

// O que a pessoa CUMPRE naquela configuração, pelo fallback de três
// degraus (D4): o horário próprio, senão o da variante 1 daquela
// escala, senão a jornada normal. É este o conjunto que a tira de
// cobertura da sub-linha usa - quem herda a jornada normal está na
// escola, e contá-lo como ausente inventaria uma lacuna (D3).
const blocosResolvidos = (servidorId, dia, escala, variante = 1) =>
  escolherBlocos(blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia), escala, variante);

// "Voltar à ordem padrão" só faz sentido quando há o que voltar: sem
// linha em `horario_exibicao`, a grade já está no padrão alfabético.
function resetHtml() {
  if (!ctxAtual.podeEditar || !exibicao.length) return '';
  return `<div class="toolbar-linha">
    <button type="button" class="mini-btn" id="hg-reset">${ico('atualizar', { tam: 14 })} Voltar à ordem padrão</button>
  </div>`;
}

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

// Chip que está sendo arrastado no momento - guardado fora do handler
// porque `dragover`/`drop` disparam de novo a cada pixel e precisam
// achar o mesmo elemento que `dragstart` marcou.
let origemArrasto = null;

// ── Eventos delegados no corpo (ligados uma vez, em renderPorEscola) ──
// #h-corpo não é recriado por `carregar()` (só o innerHTML muda), então
// tudo aqui é ligado UMA vez só - inclusive arrasto e cobertura, que a
// Task 7 deixou desenhados mas desligados. Delegar por seletor evita
// religar (e empilhar) listener a cada reordenação.
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
    if (editar) { abrirEdicaoJornada(editar.dataset.editar); return; }

    const mover = e.target.closest('[data-mover]');
    if (mover) { await moverServidor(mover.dataset.mover); return; }

    const chipEscala = e.target.closest('[data-escala]');
    if (chipEscala) { escalaVista = chipEscala.dataset.escala; await carregar(); return; }

    if (e.target.closest('#hg-reset')) await voltarPadrao();
  });

  // O checkbox de cobertura é recriado a cada `carregar()`, mas o
  // listener mora aqui, no container estável - `change` borbulha, então
  // ligar uma vez só já cobre os checkboxes futuros.
  root.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cobertura]');
    if (!inp) return;
    inp.disabled = true;
    try {
      await definirCobertura(unidadeId, inp.dataset.cobertura, inp.checked);
      await carregar();
    } catch (err) {
      inp.checked = !inp.checked;
      reportarErro(err, { titulo: 'Não foi possível salvar' });
    } finally { inp.disabled = false; }
  });

  // Arrasto na LEGENDA, não nas barras: arrastar uma barra moveria o
  // horário, que é outra coisa. Reordenar a legenda reordena as faixas
  // e as cores. Os eventos de drag borbulham como qualquer outro, então
  // delegar aqui (em vez de religar em cada `#hg-legenda` recriado)
  // segue o mesmo padrão dos demais listeners deste corpo.
  root.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('.hg-chip');
    if (!chip || !chip.draggable) return;
    origemArrasto = chip;
    chip.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox só inicia o arrasto se houver dado no dataTransfer.
    e.dataTransfer.setData('text/plain', chip.dataset.servidor);
  });

  root.addEventListener('dragend', (e) => {
    origemArrasto?.classList.remove('arrastando');
    origemArrasto = null;
    // Soltar FORA de #hg-legenda: `drop` não roda (ou roda sem achar a
    // legenda) e ninguém desfez o `insertBefore` que o `dragover` já
    // aplicou ao vivo - a legenda ficaria mostrando uma ordem que não
    // foi gravada e nem bate com as cores das barras abaixo, sem toast
    // nem erro (achado da revisão da Task 9, rodada 1). `dropEffect`
    // só vira algo diferente de 'none' quando um `dragover` válido
    // (dentro da legenda) chamou `preventDefault()` antes do drop.
    if (e.dataTransfer?.dropEffect === 'none') carregar();
  });

  root.addEventListener('dragover', (e) => {
    if (!origemArrasto) return;
    const legenda = e.target.closest('#hg-legenda');
    if (!legenda) return;
    e.preventDefault();      // exigido pela API nativa para o drop disparar
    const alvo = e.target.closest('.hg-chip');
    if (!alvo || alvo === origemArrasto) return;
    const r = alvo.getBoundingClientRect();
    const depois = (e.clientX - r.left) > r.width / 2;
    legenda.insertBefore(origemArrasto, depois ? alvo.nextSibling : alvo);
  });

  root.addEventListener('drop', async (e) => {
    const legenda = e.target.closest('#hg-legenda');
    if (!origemArrasto || !legenda) return;
    e.preventDefault();
    const ids = [...legenda.querySelectorAll('.hg-chip')].map(c => c.dataset.servidor);
    await salvarNovaOrdem(ids);
  });
}

// Grava a ordem inteira (drag e setas caem aqui) - `salvarOrdem` grava
// de uma vez, não linha a linha. `carregar()` sempre roda depois: em
// sucesso, reflete o que o banco gravou; em erro, desfaz na tela o que
// o banco recusou.
async function salvarNovaOrdem(ids) {
  try {
    await salvarOrdem(unidadeId, ids);
    toast({ titulo: 'Ordem salva', tipo: 'sucesso' });
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível salvar a ordem' });
  } finally {
    await carregar();
  }
}

// Alternativa por teclado ao arrasto: `valor` é "<servidorId>:-1" ou
// "<servidorId>:1", vindo do data-mover das setas da legenda.
async function moverServidor(valor) {
  const [servidorId, delta] = valor.split(':');
  const ids = linhas.map(l => l.servidor.id);
  const i = ids.indexOf(servidorId);
  const j = i + Number(delta);
  if (i < 0 || j < 0 || j >= ids.length) return;
  // As duas setas DESTE servidor ficam desabilitadas durante a gravação -
  // sem isso, dois cliques rápidos disparam duas gravações calculadas
  // sobre o mesmo `linhas` desatualizado (achado da revisão, rodada 1).
  // `carregar()`, no fim de `salvarNovaOrdem`, repinta a legenda inteira
  // com botões novos e já habilitados - não precisa reabilitar à mão.
  document.querySelectorAll(`[data-mover^="${servidorId}:"]`).forEach(b => b.disabled = true);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await salvarNovaOrdem(ids);
  // `carregar()` destruiu o botão que estava focado - sem refocar quem
  // moveu o mesmo servidor na mesma direção, mover alguém 3 posições
  // exige 3 travessias da legenda procurando o botão de novo. É a ÚNICA
  // via de reordenar em touch (arrasto nativo não existe lá). Se a seta
  // não existir mais (chegou na ponta), `?.` deixa falhar em silêncio.
  document.querySelector(`[data-mover="${servidorId}:${delta}"]`)?.focus();
}

async function voltarPadrao() {
  const ok = await confirmar('Voltar à ordem padrão desta escola?', {
    detalhe: 'A grade volta a mostrar só os cargos de equipe gestora, em ordem alfabética, todos contando na cobertura.',
    textoOk: 'Voltar ao padrão',
  });
  if (!ok) return;
  try {
    await limparExibicao(unidadeId);
    toast({ titulo: 'Ordem restaurada', tipo: 'sucesso' });
    await carregar();
  } catch (err) {
    reportarErro(err, { titulo: 'Não foi possível restaurar' });
  }
}

// Abre a gaveta da jornada semanal (views/jornada.js) para o servidor
// clicado nesta escola - `blocos` já é a lista inteira da unidade;
// `abrirJornada` filtra por servidor e dia internamente.
function abrirEdicaoJornada(servidorId) {
  const linha = linhas.find(l => l.servidor.id === servidorId);
  if (!linha) return;
  abrirJornada({
    servidor: linha.servidor, unidadeId, blocos, recarregar: carregar,
    escalasEmUso: ctxAtual.escalasEmUso, catalogoEscalas: ctxAtual.catalogoEscalas,
    escalaInicial: escalaVista,
  });
}

// O rótulo de uma sub-linha. Sai de quem está marcado como condutor
// (D5); sem ninguém marcado - a quarta que reveza sem ter TDC - cai no
// número da variante, e o mesmo mecanismo continua servindo.
// A ordem da grade entra como desempate determinístico.
function rotuloSubLinha(escala, dia, variante) {
  const nome = rotulaEscala(escala, ctxAtual.catalogoEscalas);
  const so = variantesDe(blocos, escala, dia).length <= 1;
  if (so && escala !== escalaVista) return nome;

  const condutorId = conduzDaVariante(blocos, {
    escala, dia, variante, ordem: linhas.map(l => l.servidor.id),
  });
  const condutor = condutorId
    && (linhas.find(l => l.servidor.id === condutorId)?.servidor.nome
        || servidores.find(s => s.id === condutorId)?.nome);
  if (condutor) return `${nome} · quando ${condutor} conduz`;
  return so ? nome : `${nome} · variante ${variante}`;
}
