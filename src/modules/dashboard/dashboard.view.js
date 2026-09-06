// ============================================================
// FundHub - modules/dashboard/dashboard.view.js
// Painel do dia. Compõe dados de vários módulos e não é dono de nada.
// Os painéis são unidades declaradas (dashboard.config.js: metadados;
// views/paineis.js: pintura). Aqui: filtra por permissão, aplica a
// ordem/ocultos da pessoa, e liga o arrasto de reordenar.
// ============================================================
import { PAINEIS_META, ordemResolvida, paineisOcultos, definirOrdem, definirOcultos } from './dashboard.config.js';
import { painelStats, painelExtraclasse, painelAfastamentos, painelCalendario, painelOcorrencias } from './views/paineis.js';
import { nivel, OCULTO } from '../../core/permissoes.js';
import { esc } from '../../shared/dom.js';
import { hojeISO, fmtExtenso } from '../../shared/format.js';
import { loading, emptyState } from '../../shared/ui/feedback.js';
import { ico } from '../../shared/ui/icones.js';

const PINTURA = {
  numeros:      (box) => painelStats(box),
  hoje:         (box) => painelHoje(box),
  extraclasse:  (box, h) => painelExtraclasse(box, h),
  afastamentos: (box, h) => painelAfastamentos(box, h),
  calendario:   (box, h) => painelCalendario(box, h),
  ocorrencias:  (box, h) => painelOcorrencias(box, h),
};

let origemArrasto = null;

export async function render(app) {
  const hoje = hojeISO();

  const disponiveis = PAINEIS_META.filter(p => !p.perm || nivel(p.perm) !== OCULTO);
  const ocultos = paineisOcultos();
  const ordem = ordemResolvida(disponiveis.map(p => p.id));
  const visiveis = ordem.filter(id => !ocultos.includes(id));

  app.innerHTML = `
    <div class="page-head">
      <h1>Dashboard do dia</h1>
      <p class="capitalizar">${esc(fmtExtenso(hoje))}</p>
    </div>
    ${visiveis.length ? `<div class="dash-grid" id="dash-grid">${
      visiveis.map(id => {
        const m = disponiveis.find(p => p.id === id);
        return `<section class="panel" data-painel="${esc(id)}">
          <h2 class="panel-cab" draggable="true">
            <span class="panel-tit">${ico(m.ico, { tam: 16 })} ${esc(m.titulo)}</span>
            <button type="button" class="panel-x" aria-label="Ocultar ${esc(m.titulo)}">${ico('fechar', { tam: 13 })}</button>
          </h2>
          <div id="dp-${esc(id)}">${loading()}</div>
        </section>`;
      }).join('')}</div>`
    : emptyState(ico('dashboard', { tam: 32 }), 'Todos os painéis estão ocultos',
        'Reative-os nas <a href="#/configuracoes">configurações</a>.')}`;

  const grid = document.getElementById('dash-grid');
  if (!grid) return;

  for (const id of visiveis) {
    const box = document.getElementById(`dp-${id}`);
    Promise.resolve(PINTURA[id]?.(box, hoje)).catch(err => {
      box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err?.message || err));
    });
  }

  ligarArrasto(grid);
  grid.querySelectorAll('.panel-x').forEach(b =>
    b.addEventListener('click', () => ocultar(b.closest('[data-painel]').dataset.painel)));
}

async function painelHoje(box) {
  try {
    const { cartaoHoje } = await import('./views/hoje.js');
    await cartaoHoje(box);
  } catch (err) {
    box.innerHTML = emptyState(ico('atencao', { tam: 32 }), 'Não foi possível carregar', esc(err.message || err));
  }
}

async function ocultar(id) {
  const atuais = paineisOcultos();
  if (atuais.includes(id)) return;
  try {
    await definirOcultos([...atuais, id]);
    document.querySelector(`.panel[data-painel="${CSS.escape(id)}"]`)?.remove();
    // Ficou tudo oculto: recarrega para mostrar o estado vazio com o link.
    if (!document.querySelector('#dash-grid .panel')) location.reload();
  } catch (_) {
    // silencioso: o painel só some se a preferência gravou
  }
}

// Arrasto pelo cabeçalho do painel. Delegado no grid (container estável),
// mesmo padrão de horarios/views/por-escola.js.
function ligarArrasto(grid) {
  grid.addEventListener('dragstart', (e) => {
    const cab = e.target.closest('.panel-cab');
    if (!cab) return;
    origemArrasto = cab.closest('.panel');
    origemArrasto.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', origemArrasto.dataset.painel);  // Firefox exige
  });
  grid.addEventListener('dragend', () => {
    origemArrasto?.classList.remove('arrastando');
    origemArrasto = null;
  });
  grid.addEventListener('dragover', (e) => {
    if (!origemArrasto) return;
    const alvo = e.target.closest('.panel');
    if (!alvo || alvo === origemArrasto || alvo.parentElement !== grid) return;
    e.preventDefault();
    const r = alvo.getBoundingClientRect();
    const depois = (e.clientY - r.top) > r.height / 2;
    grid.insertBefore(origemArrasto, depois ? alvo.nextSibling : alvo);
  });
  grid.addEventListener('drop', async (e) => {
    if (!origemArrasto) return;
    e.preventDefault();
    const ids = [...grid.querySelectorAll('.panel')].map(p => p.dataset.painel);
    const ocultos = paineisOcultos();
    try { await definirOrdem([...ids, ...ocultos.filter(o => !ids.includes(o))]); }
    catch (_) { location.reload(); }
  });
}
