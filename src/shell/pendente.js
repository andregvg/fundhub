// ============================================================
// FundHub — shell/pendente.js  (tela de acesso pendente)
// Para quem autenticou com e-mail institucional mas ainda não está
// na allowlist (tabela `perfil`).
//
// Existe porque o silêncio era pior: sem esta tela, a pessoa entrava
// no app, via o menu completo e todas as listas vazias — o RLS
// bloqueava tudo sem dizer nada — e concluía, razoavelmente, que o
// sistema estava quebrado.
// ============================================================
import { signOut } from '../core/auth.js';
import { limparPerfil } from '../core/perfil.js';
import { esc } from '../shared/dom.js';

export function renderAcessoPendente(app, email) {
  app.innerHTML = `
    <section class="auth-wrap">
      <div class="auth-card">
        <div class="auth-mark">⏳</div>
        <h1>Acesso pendente</h1>
        <p class="auth-sub">Sua conta foi autenticada, mas ainda não tem acesso
           liberado ao FundHub.</p>
        <div class="auth-alert info">
          <b>${esc(email || '')}</b><br />
          Peça a liberação à Gerência de Ensino Fundamental informando este e-mail.
        </div>
        <p class="auth-foot">Assim que o acesso for liberado, basta entrar de novo —
           nada precisa ser reinstalado ou reconfigurado.</p>
        <button type="button" id="pend-sair" class="btn-secundario">Sair</button>
      </div>
    </section>`;

  document.getElementById('pend-sair').addEventListener('click', async () => {
    limparPerfil();
    await signOut();
  });
}
