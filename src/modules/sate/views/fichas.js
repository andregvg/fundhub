// ============================================================
// FundHub - sate/views/fichas.js  (guia Fichas - só quem aprova)
// As fichas de ônibus que vão para a empresa de transporte, no mesmo
// formato do agendamentos-fil: uma ficha = um veículo, com origem,
// destino, horários e número de lugares.
//
// A empresa NÃO tem acesso ao sistema (decisão de 07/09/2026: o domínio
// institucional não é afrouxado). Ela recebe isto impresso ou em PDF -
// que é exatamente o que o agendamentos-fil faz hoje.
//
// A alocação (quantas fichas, com que número) é regra de domínio e mora
// em `regras.model.js`; aqui só se desenha o que ela devolveu.
// ============================================================
import { getViagensDoDia, getEmbarques, PERIODOS } from '../sate.model.js';
import { alocarFichas, pendenciasDeFicha } from '../regras.model.js';
import { capacidadeOnibus } from '../sate.config.js';
import { esc } from '../../../shared/dom.js';
import { hojeISO, fmtData, DOW } from '../../../shared/format.js';
import { loading, erroBox, emptyState } from '../../../shared/ui/feedback.js';
import { ico } from '../../../shared/ui/icones.js';

let ctx = null;
let filtro = { data: hojeISO(), periodo: '' };

export function render(contexto) {
  ctx = contexto;
  ctx.box().innerHTML = `
    <div class="toolbar no-print">
      <label class="search compacta">${ico('calendario', { tam: 14 })}
        <input id="fi-data" type="date" value="${esc(filtro.data)}" aria-label="Data" /></label>
      <label class="search compacta">
        <select id="fi-per" aria-label="Período">
          <option value="">Todos os períodos</option>
          ${Object.entries(PERIODOS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
        </select></label>
      <button id="fi-imprimir" class="btn-primary">${ico('imprimir')} Imprimir</button>
    </div>
    <div id="fi-body">${loading()}</div>`;

  document.getElementById('fi-data').addEventListener('change', e => { filtro.data = e.target.value; carregar(); });
  document.getElementById('fi-per').addEventListener('change', e => { filtro.periodo = e.target.value; carregar(); });
  document.getElementById('fi-imprimir').addEventListener('click', () => window.print());
  carregar();
}

async function carregar() {
  const box = document.getElementById('fi-body');
  if (!box || !filtro.data) return;
  box.innerHTML = loading();

  let confirmadas;
  try { confirmadas = await getViagensDoDia(filtro.data); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  if (filtro.periodo) confirmadas = confirmadas.filter(s => s.periodo === filtro.periodo);

  // As paradas a mais de cada viagem: sem elas o motorista não sabe onde
  // mais o ônibus para. Uma consulta por solicitação, e não um join, para
  // manter a leitura simples - são poucas viagens por dia.
  const paradas = {};
  await Promise.all(confirmadas.map(async s => {
    paradas[s.id] = await getEmbarques(s.id).catch(() => []);
  }));

  const fichas = alocarFichas(confirmadas, { capacidade: capacidadeOnibus() });
  const pendentes = pendenciasDeFicha(confirmadas);

  if (!fichas.length && !pendentes.length) {
    box.innerHTML = emptyState(ico('transporte', { tam: 32 }), 'Nenhuma viagem confirmada',
      `Não há transporte confirmado para ${esc(fmtData(filtro.data))}.`);
    return;
  }

  const dt = new Date(filtro.data + 'T00:00:00');
  const cab = `${esc(fmtData(filtro.data))} · ${esc(DOW[dt.getDay()] || '')}`;

  // Faixa larga abrindo cada período - inclusive o primeiro, que é o que
  // rotula o documento quando há filtro de um período só.
  let ultimo = null;
  const corpo = fichas.map(f => {
    const faixa = f.periodo !== ultimo
      ? `<div class="fi-faixa">${esc(PERIODOS[f.periodo] || f.periodo)}</div>` : '';
    ultimo = f.periodo;
    return faixa + ficha(f, cab, paradas[f.solicitacao.id] || []);
  }).join('');

  box.innerHTML = `
    <div class="fi-doc">
      <div class="fi-titulo">Fichas de transporte · ${cab}</div>
      ${corpo}
      ${pendentes.length ? `
        <div class="fi-pendencias no-print">
          <div class="lbl">Confirmadas sem ficha</div>
          <p class="form-hint">Estas viagens estão confirmadas mas não têm ônibus atribuído,
            então não geram ficha. Confira antes de enviar à empresa.</p>
          ${pendentes.map(s => `<div class="fr-linha">
            <b>${esc(s.unidade?.apelido || s.unidade?.nome || '—')}</b>
            <span>${esc(PERIODOS[s.periodo] || s.periodo)}</span>
            <span class="di-meta">${s.qtd_alunos || 0} estudante(s), 0 ônibus</span>
          </div>`).join('')}
        </div>` : ''}
    </div>`;
}

function ficha(f, cab, paradas) {
  const s = f.solicitacao;
  const origem = s.unidade?.nome || '—';
  const destino = s.destino_nome || s.atividade?.local_nome || '—';
  const destEnd = s.destino_endereco || s.atividade?.local_endereco || '';

  // Paradas a mais: uma linha por ponto, na ordem. Nunca concatenadas
  // numa linha só - o motorista precisa saber a sequência.
  const extras = paradas.length ? `
    <tr>
      <th>Também embarca em</th>
      <td colspan="3">${paradas.map((p, i) =>
        `<div class="fi-parada">${i + 1}. ${esc(p.unidade?.apelido || p.unidade?.nome || p.local?.nome || '—')}`
        + `${p.horario ? ` · ${esc(p.horario)}` : ''}`
        + `${p.qtd_alunos ? ` · ${p.qtd_alunos} estudante(s)` : ''}</div>`).join('')}</td>
    </tr>` : '';

  return `
    <article class="fi-ficha">
      <header class="fi-cab">
        <span class="fi-num">Ônibus ${f.numero} · ${esc(PERIODOS[f.periodo] || f.periodo)}</span>
        <span class="fi-data">${cab}</span>
      </header>
      <table class="fi-grade">
        <tbody>
          <tr>
            <th>Origem</th>
            <td colspan="3">${esc(origem)}${s.unidade?.endereco ? `<div class="fi-end">${esc(s.unidade.endereco)}</div>` : ''}</td>
          </tr>
          ${extras}
          <tr>
            <th>Destino</th>
            <td colspan="3">${esc(destino)}${destEnd ? `<div class="fi-end">${esc(destEnd)}</div>` : ''}</td>
          </tr>
          <tr>
            <th>Embarque</th><td>${esc(s.horario_embarque || '—')}</td>
            <th>Retorno</th><td>${esc(s.horario_retorno || '—')}</td>
          </tr>
          <tr>
            <th>Lugares no ônibus</th><td class="fi-num-grande">${f.lugares}</td>
            <th>Van adaptada</th><td class="fi-num-grande">${f.vans || '—'}</td>
          </tr>
          <tr>
            <th>Atividade</th>
            <td colspan="3">${esc(s.atividade?.nome || s.atividade_livre || '—')}
              ${s.turmas ? `<div class="fi-end">Turma(s): ${esc(s.turmas)}</div>` : ''}</td>
          </tr>
          ${s.contato_professor ? `<tr><th>Contato</th><td colspan="3">${esc(s.contato_professor)}</td></tr>` : ''}
        </tbody>
      </table>
      ${f.de > 1 ? `<div class="fi-rodape">Ônibus ${f.indice} de ${f.de} desta viagem.</div>` : ''}
      ${f.excedeCapacidade ? `<div class="fi-alerta">${ico('atencao', { tam: 14 })}
        Estudantes acima da capacidade dos ônibus informados. Confira o cadastro.</div>` : ''}
    </article>`;
}
