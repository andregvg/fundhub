// ============================================================
// FundHub — horarios/views/por-escola.js
// Aba "Por escola": escolhida a unidade, a tela mostra a COBERTURA
// (7h00–18h20, com as lacunas em vermelho) e, abaixo, a semana de
// cada servidor vinculado, em barras. A cobertura é regra de ESCOLA
// — a sede da SME não entra nela (Step 5 do brief).
//
// `linhaDia` é exportada para a aba "Por servidor" reaproveitar a
// mesma barra gráfica sem duplicar 30 linhas de desenho.
// ============================================================
import {
  DIAS, COBERTURA_INICIO, COBERTURA_FIM,
  getBlocos, validarDia, totalDoDia, lacunasCobertura, posicaoNaBarra, marcasDaBarra,
  paraHora, duracao,
} from '../horarios.model.js';
import { getServidoresDaUnidade, vinculosAbertos } from '../../servidores/servidores.model.js';
import { rotulaCargo } from '../../servidores/vinculos.model.js';
import { getUnidades } from '../../escolas/escolas.model.js';
import { esc } from '../../../shared/dom.js';
import { loading, emptyState, erroBox } from '../../../shared/ui/feedback.js';
import { criarFiltroSegmento, indexarUnidades } from '../../../shared/ui/filtro-segmento.js';
import { formBloco } from './bloco.js';
import { ico } from '../../../shared/ui/icones.js';

let unidades = [], idxUnidades = {}, seg = null;
let servidores = [], blocos = [];
let unidadeId = '';
let ultimoParam;   // valor de ctx.unidadeId visto no último render — distingue
                    // navegação nova (deep link mudou) de troca de aba (mesmo ctx).
let ctxAtual = null;

export async function renderPorEscola(box, ctx) {
  ctxAtual = ctx;
  if (ctx.unidadeId !== ultimoParam) {
    unidadeId = ctx.unidadeId || '';
    ultimoParam = ctx.unidadeId;
  }

  box.innerHTML = `
    <div class="toolbar">
      <label class="search">${ico('escola')}
        <select id="h-uni"><option value="">Selecione a escola…</option></select>
      </label>
      <span class="count" id="h-count"></span>
    </div>
    <div id="h-seg" class="toolbar-linha"></div>
    <div id="h-corpo"></div>`;

  try {
    unidades = await getUnidades();
    idxUnidades = indexarUnidades(unidades);
  } catch (err) { document.getElementById('h-corpo').innerHTML = erroBox(err); return; }

  // O seletor respeita o segmento: quem cuida da Educação Infantil não
  // precisa rolar por 90 EMEFs para achar o seu CEI. A sede não tem
  // segmento — fica sempre visível, filtro nenhum a esconde.
  seg = criarFiltroSegmento(document.getElementById('h-seg'), {
    perfil: ctx.perfil, chaveMemoria: 'fundhub:seg:horarios',
    onChange: () => { pintarSeletor(); if (!unidadeId) limparCorpo(); },
  });
  pintarSeletor();

  document.getElementById('h-uni').addEventListener('change', e => {
    unidadeId = e.target.value; carregar();
  });

  if (unidadeId) carregar(); else limparCorpo();
}

function pintarSeletor() {
  const sel = document.getElementById('h-uni');
  const lista = ctxAtual.locais.filter(l =>
    l.tipo === 'sede' || seg.combinaPorUnidade(l.id, idxUnidades));
  sel.innerHTML = `<option value="">Selecione a escola…</option>` +
    [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(l => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');
  if (unidadeId && !sel.querySelector(`option[value="${CSS.escape(unidadeId)}"]`)) unidadeId = '';
  sel.value = unidadeId;
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
    [servidores, blocos] = await Promise.all([
      getServidoresDaUnidade(unidadeId),
      getBlocos(unidadeId),
    ]);
  } catch (err) { corpo.innerHTML = erroBox(err); return; }

  document.getElementById('h-count').textContent = `${servidores.length} servidor(es) vinculado(s)`;

  if (!servidores.length) {
    corpo.innerHTML = emptyState(ico('equipe', { tam: 32 }), 'Nenhum servidor vinculado',
      `Esta unidade não tem ninguém com vínculo aberto. Cadastre em
       <a href="#/servidores?unidade=${esc(unidadeId)}">Servidores</a>.`);
    return;
  }

  // A janela 7h00–18h20 é regra de ESCOLA: é o horário em que precisa
  // haver alguém da equipe gestora na unidade. Não se aplica à sede.
  const local = ctxAtual.locais.find(l => l.id === unidadeId);
  corpo.innerHTML = (local?.tipo === 'sede' ? '' : painelCobertura())
    + servidores.map(cartaoServidor).join('');
  ligarEventos();
}

const blocosDe = (servidorId, dia) =>
  blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia);

// ── Cobertura da unidade ─────────────────────────────────────
function painelCobertura() {
  const linhas = DIAS.map(d => {
    const doDia = blocos.filter(b => b.dia_semana === d.n);
    const lacunas = lacunasCobertura(doDia);
    const ok = lacunas.length === 0;

    // A barra desenha o que ESTÁ coberto; as lacunas ficam como fundo.
    const barras = doDia.map(b => {
      const p = posicaoNaBarra(b);
      return `<div class="hb-bloco cobertura" style="left:${p.esquerda}%;width:${p.largura}%"></div>`;
    }).join('');

    const txt = ok
      ? `<span class="hb-ok">${ico('ok', { tam: 12 })} coberto</span>`
      : `<span class="hb-falha">${lacunas.map(l => `${paraHora(l.ini)}–${paraHora(l.fim)}`).join(' · ')}</span>`;

    return `<div class="hb-linha">
      <div class="hb-dia">${d.curto}</div>
      <div class="hb-track">${eixo()}${barras}</div>
      <div class="hb-info">${txt}</div>
    </div>`;
  }).join('');

  const diasComFalha = DIAS.filter(d =>
    lacunasCobertura(blocos.filter(b => b.dia_semana === d.n)).length).length;

  return `<section class="panel hb-painel">
    <h2>${ico('escola')} Cobertura da escola <small class="hb-sub">${COBERTURA_INICIO} às ${COBERTURA_FIM}</small></h2>
    ${diasComFalha
      ? `<p class="hb-alerta">${diasComFalha} dia(s) da semana com horário descoberto.</p>`
      : `<p class="hb-tudo-ok">Todos os dias cobertos.</p>`}
    <div class="hb-grade">${linhas}</div>
  </section>`;
}

// ── Semana de um servidor ────────────────────────────────────
function cartaoServidor(s) {
  const vinc = vinculosAbertos(s).find(v => v.unidade_id === unidadeId);
  const semana = DIAS.map(d => linhaDia(s, d, blocosDe(s.id, d.n),
    { podeEditar: ctxAtual.podeEditar, unidadeId })).join('');
  const totalSemana = DIAS.reduce((acc, d) => acc + totalDoDia(blocosDe(s.id, d.n)), 0);

  return `<section class="panel hb-painel">
    <h2>
      ${esc(s.apelido || s.nome)}
      <small class="hb-sub">${esc(rotulaCargo(vinc?.papel || ''))} · ${duracao(totalSemana)} na semana</small>
    </h2>
    <div class="hb-grade">${semana}</div>
  </section>`;
}

// A semana de UM servidor em UM local, num dia. Reaproveitada pela
// aba "Por servidor" — por isso não lê nenhum estado de módulo:
// recebe os blocos do dia prontos e onde editar.
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
    <div class="hb-track">${eixo()}${barras || `<span class="hb-vazio">sem jornada</span>`}</div>
    <div class="hb-info">
      ${total ? `<b>${duracao(total)}</b>` : '<span class="hb-vazio">—</span>'}
      ${addBtn}
    </div>
    ${alertas ? `<div class="hb-alertas">${alertas}</div>` : ''}
  </div>`;
}

// O Postgres devolve `time` como '07:00:00' — a tela mostra '07:00'.
const hhmm = (t) => String(t ?? '').slice(0, 5);

// Eixo de horas ao fundo da barra (só desenhado uma vez por linha).
function eixo() {
  return marcasDaBarra().map(m =>
    `<span class="hb-marca" style="left:${m.pos}%"><i></i><em>${m.hora.slice(0, 2)}</em></span>`).join('');
}

// ── Eventos ──────────────────────────────────────────────────
function ligarEventos() {
  const corpo = document.getElementById('h-corpo');
  if (!ctxAtual.podeEditar) return;

  corpo.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const [sid, diaStr, uni] = b.dataset.add.split(':');
    const dia = parseInt(diaStr, 10);
    const nome = DIAS.find(d => d.n === dia)?.nome || '';
    formBloco(null, { servidorId: sid, unidadeId: uni, dia, nome, recarregar: carregar });
  }));
  corpo.querySelectorAll('[data-bloco]').forEach(b => b.addEventListener('click', () => {
    const bloco = blocos.find(x => x.id === b.dataset.bloco);
    if (!bloco) return;
    const nome = DIAS.find(d => d.n === bloco.dia_semana)?.nome || '';
    formBloco(bloco, {
      servidorId: bloco.servidor_id, unidadeId: bloco.unidade_id, dia: bloco.dia_semana, nome,
      recarregar: carregar,
    });
  }));
}
