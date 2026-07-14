// ============================================================
// FundHub — auth.js  (autenticação e gate de acesso)
// Login por magic link (OTP por e-mail), restrito ao domínio
// institucional. O domínio é validado aqui (UX) e, de forma
// definitiva, pelo RLS no banco (is_institucional()).
// ============================================================
import { sb, hasSupabase } from './sb.js';

const DOMINIO = '@educacao.pmrp.sp.gov.br';
export function isInstitucional(email) {
  return !!email && email.toLowerCase().endsWith(DOMINIO);
}

export async function getUser() {
  if (!hasSupabase()) return null;
  const { data } = await sb().auth.getSession();
  return data?.session?.user || null;
}

export function onAuthChange(cb) {
  if (!hasSupabase()) return;
  sb().auth.onAuthStateChange((_evt, session) => cb(session?.user || null));
}

export async function signOut() {
  if (hasSupabase()) await sb().auth.signOut();
}

function redirectUrl() {
  // Volta para a raiz do app (sem hash de rota) para o supabase-js
  // consumir os tokens do retorno do magic link.
  return location.origin + location.pathname;
}

export async function sendMagicLink(email) {
  const { error } = await sb().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
  });
  if (error) throw error;
}

// Renderiza a tela de login no container informado.
export function renderLogin(app, opts = {}) {
  const restrito = opts.restrito || false;
  app.innerHTML = `
    <section class="auth-wrap">
      <div class="auth-card">
        <div class="auth-mark">🏫</div>
        <h1>Fund<span class="hub">Hub</span></h1>
        <p class="auth-sub">Acesso restrito à equipe da Gerência de Ensino Fundamental.</p>
        ${restrito ? `<div class="auth-alert">Este e-mail não pertence ao domínio institucional
           (<code>${DOMINIO}</code>). Saindo…</div>` : ''}
        <form id="login-form" class="auth-form">
          <label for="email">E-mail institucional</label>
          <input id="email" type="email" inputmode="email" autocomplete="email"
                 placeholder="nome${DOMINIO}" required />
          <button type="submit" id="login-btn">Receber link de acesso</button>
          <p id="login-msg" class="auth-msg"></p>
        </form>
        <p class="auth-foot">Você receberá um link seguro por e-mail. Nenhuma senha é necessária.</p>
      </div>
    </section>`;

  const form = app.querySelector('#login-form');
  const msg = app.querySelector('#login-msg');
  const btn = app.querySelector('#login-btn');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = app.querySelector('#email').value.trim();
    msg.className = 'auth-msg';
    if (!isInstitucional(email)) {
      msg.classList.add('err');
      msg.textContent = `Use um e-mail terminado em ${DOMINIO}.`;
      return;
    }
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await sendMagicLink(email);
      msg.classList.add('ok');
      msg.textContent = 'Link enviado! Verifique sua caixa de entrada (e o spam).';
    } catch (err) {
      msg.classList.add('err');
      msg.textContent = 'Não foi possível enviar: ' + (err.message || err);
      btn.disabled = false; btn.textContent = 'Receber link de acesso';
    }
  });
}
