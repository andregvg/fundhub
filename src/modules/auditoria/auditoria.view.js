// ============================================================
// FundHub - modules/auditoria/auditoria.view.js
// Casca do módulo Auditoria: duas abas para as duas perguntas que um
// admin faz depois que algo dá errado.
//
//   Mudanças  - "o que mudou nesse cadastro, e quem mudou?"  (audit_log)
//   Atividade - "quem entrou, quem exportou, quem tentou entrar onde
//                não podia?"                                 (evento_log)
//
// Ambas só para admin; a guarda definitiva é o RLS. Segue o padrão de
// abas do SATE.
// ============================================================
import { loading } from '../../shared/ui/feedback.js';
import * as abaMudancas from './views/mudancas.js';
import * as abaAtividade from './views/atividade.js';

const ABAS = {
  mudancas:  { rotulo: 'Mudanças', view: abaMudancas },
  atividade: { rotulo: 'Atividade', view: abaAtividade },
};

let aba = 'mudancas';
let ctx = null;

export async function render(app, { perfil } = {}) {
  app.innerHTML = `
    <div class="page-head">
      <h1>Auditoria</h1>
      <p>Tudo que foi alterado no sistema e tudo que aconteceu nele - com quem, quando e o quê.</p>
    </div>
    <div class="tabbar" id="au-abas" role="tablist"></div>
    <div id="au-body">${loading()}</div>`;

  ctx = { perfil, box: () => document.getElementById('au-body') };

  const barra = document.getElementById('au-abas');
  barra.innerHTML = Object.entries(ABAS)
    .map(([id, a]) => `<button class="tab" role="tab" data-aba="${id}">${a.rotulo}</button>`).join('');
  barra.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (b) { aba = b.dataset.aba; pintarAbas(); ABAS[aba].view.render(ctx); }
  });

  pintarAbas();
  ABAS[aba].view.render(ctx);
}

function pintarAbas() {
  document.querySelectorAll('#au-abas .tab').forEach(b => {
    const on = b.dataset.aba === aba;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
}
