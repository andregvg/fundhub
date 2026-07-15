// ============================================================
// FundHub — modules/usuarios/usuarios.view.js
// Casca do módulo Usuários & Acessos: duas abas — a allowlist (quem
// entra) e a Auditoria (o que mudou). Ambas só para admin; a guarda
// definitiva é o RLS. Segue o padrão de abas do SATE.
// ============================================================
import { loading } from '../../shared/ui/feedback.js';
import * as abaUsuarios from './views/lista.js';
import * as abaAuditoria from './views/auditoria.js';

const ABAS = {
  usuarios:  { rotulo: 'Usuários', view: abaUsuarios },
  auditoria: { rotulo: 'Auditoria', view: abaAuditoria },
};

let aba = 'usuarios';
let ctx = null;

export async function render(app, { perfil } = {}) {
  app.innerHTML = `
    <div class="page-head">
      <h1>Usuários &amp; Acessos</h1>
      <p>Quem tem acesso ao FundHub, com qual papel — e o histórico de tudo que foi alterado.</p>
    </div>
    <div class="tabbar" id="us-abas" role="tablist"></div>
    <div id="us-body">${loading()}</div>`;

  ctx = { perfil, box: () => document.getElementById('us-body') };

  const barra = document.getElementById('us-abas');
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
  document.querySelectorAll('#us-abas .tab').forEach(b => {
    const on = b.dataset.aba === aba;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
}
