// ============================================================
// FundHub - horarios/views/por-servidor.js
// A semana de UMA pessoa, agrupada pelos locais onde ela tem jornada.
// É o caminho que faltava: até aqui só dava para chegar ao horário
// escolhendo primeiro a escola, e quem procurava pela pessoa não
// encontrava onde cadastrar.
// ============================================================
import { DIAS, getBlocosDoServidor, validarDia, totalDoDia, duracao } from '../horarios.model.js';
import { posicaoNaBarra, marcasDaBarra } from '../grade.model.js';
import { getServidores, vinculosAbertos } from '../../servidores/servidores.model.js';
import { rotulaCargo } from '../../servidores/vinculos.model.js';
import { esc, vazio } from '../../../shared/dom.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { criarBuscaSelecao } from '../../../shared/ui/busca-selecao.js';
import { abrirJornada } from './jornada.js';
import { ico } from '../../../shared/ui/icones.js';

let servidores = [], blocos = [], busca = null;
let servidorId = '';
let ultimoParam;   // mesma lógica de por-escola.js: distingue navegação
                    // nova (deep link mudou) de troca de aba (mesmo ctx).
let ctxAtual = null;

export async function renderPorServidor(box, ctx) {
  ctxAtual = ctx;
  if (ctx.servidorId !== ultimoParam) {
    servidorId = ctx.servidorId || '';
    ultimoParam = ctx.servidorId;
  }

  // `destruir()` só remove o listener de `document` da instância -
  // sem zerar aqui, `pintarSeletor()` acharia `busca` "verdadeiro" e
  // pintaria a árvore ANTIGA (já desanexada) em vez de montar uma
  // instância nova no `#hs-servidor-box` recém-criado abaixo (mesma
  // armadilha de por-escola.js).
  busca?.destruir();
  busca = null;
  box.innerHTML = `
    <div class="toolbar">
      <div id="hs-servidor-box"></div>
    </div>
    <div id="hs-corpo"></div>`;

  try { servidores = await getServidores(); }
  catch (err) { document.getElementById('hs-corpo').innerHTML = erroBox(err); return; }

  pintarSeletor();

  if (servidorId) carregar(); else limparCorpo();
}

// Só entra no seletor quem tem vínculo aberto - vínculo encerrado não
// tem onde lançar jornada nova. O rótulo é sempre o nome completo -
// é o que consta do ofício; o apelido vai para `busca`, para continuar
// encontrando quem só é conhecido por ele.
function pintarSeletor() {
  const comVinculo = servidores.filter(s => vinculosAbertos(s).length);
  if (servidorId && !comVinculo.some(s => s.id === servidorId)) servidorId = '';
  busca = criarBuscaSelecao(document.getElementById('hs-servidor-box'), {
    opcoes: [...comVinculo]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(s => ({ id: s.id, rotulo: s.nome, busca: s.apelido || '' })),
    valor: servidorId,
    placeholder: 'Buscar servidor pelo nome…',
    vazioTexto: 'Nenhum servidor com esse nome',
    onChange: (id) => { servidorId = id; carregar(); },
  });
}

function limparCorpo() {
  document.getElementById('hs-corpo').innerHTML = emptyState(ico('servidor', { tam: 32 }), 'Escolha uma pessoa',
    'Selecione o servidor acima para ver e editar a jornada dele.');
}

async function carregar() {
  const corpo = document.getElementById('hs-corpo');
  if (!servidorId) { limparCorpo(); return; }
  corpo.innerHTML = loading();

  try { blocos = await getBlocosDoServidor(servidorId); }
  catch (err) { corpo.innerHTML = erroBox(err); return; }

  const s = servidores.find(x => x.id === servidorId);
  if (!s) { corpo.innerHTML = erroBox(new Error('Servidor não encontrado.')); return; }

  // Os locais a mostrar: onde já há bloco lançado, mais os locais de
  // vínculo aberto sem bloco ainda - é ali que a pessoa precisa poder
  // ADICIONAR o primeiro.
  const locais = new Map();
  for (const b of blocos) if (b.unidade && !locais.has(b.unidade.id)) locais.set(b.unidade.id, b.unidade);
  for (const v of vinculosAbertos(s)) if (v.unidade && !locais.has(v.unidade.id)) locais.set(v.unidade.id, v.unidade);

  if (!locais.size) {
    corpo.innerHTML = emptyState(ico('escola', { tam: 32 }), 'Sem local de lotação',
      `${esc(s.apelido || s.nome)} não tem vínculo aberto em nenhum local.`);
    return;
  }

  corpo.innerHTML = [...locais.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map(local => painelLocal(s, local)).join('');
  ligarEventos();
}

function painelLocal(s, local) {
  const doLocal = blocos.filter(b => b.unidade_id === local.id);
  const vinc = vinculosAbertos(s).find(v => v.unidade_id === local.id);
  const semana = DIAS.map(d => linhaDia(s, d, doLocal.filter(b => b.dia_semana === d.n),
    { podeEditar: ctxAtual.podeEditar, unidadeId: local.id })).join('');
  const totalSemana = DIAS.reduce((acc, d) =>
    acc + totalDoDia(doLocal.filter(b => b.dia_semana === d.n)), 0);

  return `<section class="panel hb-painel">
    <h2>
      ${esc(local.apelido || local.nome)}
      <small class="hb-sub">${esc(rotulaCargo(vinc?.papel || ''))} · ${duracao(totalSemana)} na semana</small>
    </h2>
    <div class="hb-grade">${semana}</div>
  </section>`;
}

function ligarEventos() {
  const corpo = document.getElementById('hs-corpo');
  if (!ctxAtual.podeEditar) return;

  corpo.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const [, , uni] = b.dataset.add.split(':');
    abrirJornadaLocal(uni);
  }));
  corpo.querySelectorAll('[data-bloco]').forEach(b => b.addEventListener('click', () => {
    const bloco = blocos.find(x => x.id === b.dataset.bloco);
    if (!bloco) return;
    abrirJornadaLocal(bloco.unidade_id);
  }));
}

// A gaveta edita a semana inteira de UM servidor em UMA escola - aqui
// o servidor já é fixo (o selecionado no topo da tela), só o local
// varia conforme o painel clicado.
function abrirJornadaLocal(unidadeId) {
  const s = servidores.find(x => x.id === servidorId);
  if (!s) return;
  abrirJornada({
    servidor: s, unidadeId,
    blocos: blocos.filter(b => b.unidade_id === unidadeId),
    recarregar: carregar,
  });
}

// A semana de UM servidor em UM local, num dia (marcação .hb-*).
// Movida de por-escola.js na Task 8: esta é a única leitora depois
// que o lápis da grade passou a abrir a gaveta (views/jornada.js) em
// vez de montar esta marcação para edição. Continua privada - não lê
// nenhum estado de módulo, recebe os blocos do dia prontos.
function linhaDia(s, d, doDia, { podeEditar, unidadeId: uni }) {
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
