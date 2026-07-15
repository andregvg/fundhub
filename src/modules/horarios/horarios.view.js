// ============================================================
// FundHub — modules/horarios/horarios.view.js
// Jornada semanal por escola. Escolhe-se a unidade; a tela mostra a
// COBERTURA (7h00–18h20, com as lacunas em vermelho) e, abaixo, a
// semana de cada servidor vinculado, em barras.
//
// As validações vêm prontas do model — aqui só se pinta o resultado.
// Admin edita; os demais visualizam.
// ============================================================
import {
  DIAS, COBERTURA_INICIO, COBERTURA_FIM,
  getBlocos, criarBloco, atualizarBloco, excluirBloco,
  validarDia, totalDoDia, lacunasCobertura, posicaoNaBarra, marcasDaBarra,
  paraHora, duracao,
} from './horarios.model.js';
import { getServidoresDaUnidade, ANO_LETIVO, rotulaPapel } from '../servidores/servidores.model.js';
import { getUnidades } from '../escolas/escolas.model.js';
import { esc, falha } from '../../shared/dom.js';
import { loading, emptyState, erroBox } from '../../shared/ui/feedback.js';
import { drawerHtml, drawerHead, montarDrawer, abrirDrawer, fecharDrawer } from '../../shared/ui/drawer.js';

let perfil = null, unidades = [], servidores = [], blocos = [];
let unidadeId = '', ano = ANO_LETIVO;

export async function render(app, ctx = {}) {
  perfil = ctx.perfil || null;

  app.innerHTML = `
    <div class="page-head">
      <h1>Horários de Trabalho</h1>
      <p>Jornada semanal da equipe gestora, validada por regra:
         até ${duracao(8 * 60)} por dia, no máximo ${duracao(6 * 60)} contínuas,
         e a escola coberta das ${COBERTURA_INICIO} às ${COBERTURA_FIM}.</p>
    </div>
    <div class="toolbar">
      <label class="search">🏫
        <select id="h-uni"><option value="">Selecione a escola…</option></select>
      </label>
      <label class="search compacta">📅
        <input id="h-ano" type="number" inputmode="numeric" value="${ano}" aria-label="Ano letivo" />
      </label>
      <span class="count" id="h-count"></span>
    </div>
    <div id="h-body"></div>
    ${drawerHtml()}`;

  montarDrawer();

  try { unidades = await getUnidades(); }
  catch (err) { document.getElementById('h-body').innerHTML = erroBox(err); return; }

  document.getElementById('h-uni').innerHTML = `<option value="">Selecione a escola…</option>` +
    [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .map(u => `<option value="${esc(u.id || u.numero)}">${esc(u.apelido || u.nome)}</option>`).join('');

  document.getElementById('h-uni').addEventListener('change', e => { unidadeId = e.target.value; carregar(); });
  document.getElementById('h-ano').addEventListener('change', e => {
    const v = parseInt(e.target.value, 10);
    if (v > 2000) { ano = v; carregar(); }
  });

  document.getElementById('h-body').innerHTML = emptyState('🕒', 'Escolha uma escola',
    'Selecione a unidade acima para ver e editar a jornada da equipe gestora.');
}

async function carregar() {
  const body = document.getElementById('h-body');
  if (!unidadeId) {
    body.innerHTML = emptyState('🕒', 'Escolha uma escola', 'Selecione a unidade acima.');
    document.getElementById('h-count').textContent = '';
    return;
  }
  body.innerHTML = loading();

  try {
    [servidores, blocos] = await Promise.all([
      getServidoresDaUnidade(unidadeId, ano),
      getBlocos(unidadeId, ano),
    ]);
  } catch (err) { body.innerHTML = erroBox(err); return; }

  document.getElementById('h-count').textContent = `${servidores.length} servidor(es) vinculado(s)`;

  if (!servidores.length) {
    body.innerHTML = emptyState('👥', 'Nenhum servidor vinculado',
      `Esta escola não tem ninguém vinculado em ${ano}. Cadastre os vínculos em
       <a href="#/gestores">Gestores &amp; Coordenadores</a>.`);
    return;
  }

  body.innerHTML = painelCobertura() + servidores.map(cartaoServidor).join('');
  ligarEventos();
}

const blocosDe = (servidorId, dia) =>
  blocos.filter(b => b.servidor_id === servidorId && b.dia_semana === dia);

// O Postgres devolve `time` como '07:00:00' — a tela mostra '07:00'.
const hhmm = (t) => String(t ?? '').slice(0, 5);

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
      ? `<span class="hb-ok">✓ coberto</span>`
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
    <h2>🏫 Cobertura da escola <small class="hb-sub">${COBERTURA_INICIO} às ${COBERTURA_FIM}</small></h2>
    ${diasComFalha
      ? `<p class="hb-alerta">${diasComFalha} dia(s) da semana com horário descoberto.</p>`
      : `<p class="hb-tudo-ok">Todos os dias cobertos.</p>`}
    <div class="hb-grade">${linhas}</div>
  </section>`;
}

// ── Semana de um servidor ────────────────────────────────────
function cartaoServidor(s) {
  const vinc = s.vinculos.find(v => v.unidade_id === unidadeId && v.ano === ano && v.ativo);
  const semana = DIAS.map(d => linhaDia(s, d)).join('');
  const totalSemana = DIAS.reduce((acc, d) => acc + totalDoDia(blocosDe(s.id, d.n)), 0);

  return `<section class="panel hb-painel">
    <h2>
      ${esc(s.apelido || s.nome)}
      <small class="hb-sub">${esc(rotulaPapel(vinc?.papel || ''))} · ${duracao(totalSemana)} na semana</small>
    </h2>
    <div class="hb-grade">${semana}</div>
  </section>`;
}

function linhaDia(s, d) {
  const doDia = blocosDe(s.id, d.n);
  const problemas = validarDia(doDia);
  const total = totalDoDia(doDia);

  const barras = doDia.map(b => {
    const p = posicaoNaBarra(b);
    const rotulo = `${hhmm(b.inicio)}–${hhmm(b.fim)}`;
    return `<button type="button" class="hb-bloco ${perfil?.isAdmin ? 'editavel' : ''}"
      style="left:${p.esquerda}%;width:${p.largura}%"
      data-bloco="${esc(b.id)}"
      title="${esc(rotulo)}${b.obs ? ' · ' + esc(b.obs) : ''}">
      <span>${esc(rotulo)}</span>
    </button>`;
  }).join('');

  const alertas = problemas.map(p =>
    `<span class="hb-prob ${p.nivel}">${p.nivel === 'erro' ? '⛔' : '⚠️'} ${esc(p.texto)}</span>`).join('');

  const addBtn = perfil?.isAdmin
    ? `<button type="button" class="hb-add" data-add="${s.id}:${d.n}" aria-label="Adicionar bloco em ${d.nome}">+</button>`
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

// Eixo de horas ao fundo da barra (só desenhado uma vez por linha).
function eixo() {
  return marcasDaBarra().map(m =>
    `<span class="hb-marca" style="left:${m.pos}%"><i></i><em>${m.hora.slice(0, 2)}</em></span>`).join('');
}

// ── Eventos ──────────────────────────────────────────────────
function ligarEventos() {
  const body = document.getElementById('h-body');
  if (!perfil?.isAdmin) return;

  body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const [servidorId, dia] = b.dataset.add.split(':');
    formBloco(null, servidorId, parseInt(dia, 10));
  }));
  body.querySelectorAll('[data-bloco]').forEach(b => b.addEventListener('click', () => {
    const bloco = blocos.find(x => x.id === b.dataset.bloco);
    if (bloco) formBloco(bloco, bloco.servidor_id, bloco.dia_semana);
  }));
}

// ── Formulário de bloco ──────────────────────────────────────
function formBloco(bloco, servidorId, dia) {
  const novo = !bloco;
  const s = servidores.find(x => x.id === servidorId);
  const nomeDia = DIAS.find(d => d.n === dia)?.nome || '';

  abrirDrawer(`
    ${drawerHead(novo ? 'Novo bloco de jornada' : 'Editar bloco',
      `${esc(s?.apelido || s?.nome || '')} · ${esc(nomeDia)}`)}
    <div class="drawer-body">
      <form id="hb-form" class="esc-form">
        <div class="esc-row">
          <label>Início <input id="b-ini" type="time" required value="${esc(hhmm(bloco?.inicio) || '07:00')}" /></label>
          <label>Fim <input id="b-fim" type="time" required value="${esc(hhmm(bloco?.fim) || '13:00')}" /></label>
        </div>
        <label>Observação <input id="b-obs" value="${esc(bloco?.obs || '')}" placeholder="Ex.: HTPC, atendimento aos pais" /></label>
        <div class="form-foot">
          <span id="b-msg" class="auth-msg"></span>
          <button type="submit" id="b-save">${novo ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
      ${novo ? '' : `<button type="button" class="mini-btn no" id="b-del" style="margin-top:16px">🗑 Excluir bloco</button>`}
      <p class="form-hint" style="margin-top:16px">
        Para cumprir 8h sem ultrapassar 6h contínuas, divida o dia em dois blocos
        com intervalo entre eles.
      </p>
    </div>`);

  document.getElementById('hb-form').addEventListener('submit',
    (e) => salvarBloco(e, bloco, servidorId, dia));
  document.getElementById('b-del')?.addEventListener('click', () => removerBloco(bloco));
}

async function salvarBloco(e, bloco, servidorId, dia) {
  e.preventDefault();
  const msg = document.getElementById('b-msg'); msg.className = 'auth-msg';
  const inicio = document.getElementById('b-ini').value;
  const fim = document.getElementById('b-fim').value;

  if (!inicio || !fim) return falha(msg, 'Informe início e fim.');
  if (fim <= inicio) return falha(msg, 'O fim precisa ser depois do início.');

  // Valida contra o dia INTEIRO — o bloco novo somado aos que já existem.
  const outros = blocosDe(servidorId, dia).filter(b => b.id !== bloco?.id);
  const problemas = validarDia([...outros, { inicio, fim }]);
  const erro = problemas.find(p => p.nivel === 'erro');
  if (erro) return falha(msg, erro.texto);

  const payload = {
    servidor_id: servidorId,
    unidade_id: unidadeId,
    ano,
    dia_semana: dia,
    inicio, fim,
    obs: document.getElementById('b-obs').value.trim() || null,
  };

  const btn = document.getElementById('b-save'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (bloco) await atualizarBloco(bloco.id, payload);
    else await criarBloco(payload);
    fecharDrawer();
    await carregar();
  } catch (err) {
    falha(msg, 'Erro: ' + (err.message || err));
    btn.disabled = false; btn.textContent = bloco ? 'Salvar' : 'Adicionar';
  }
}

async function removerBloco(bloco) {
  if (!confirm('Excluir este bloco da jornada?')) return;
  try {
    await excluirBloco(bloco.id);
    fecharDrawer();
    await carregar();
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err));
  }
}
