// ============================================================
// FundHub — auth.js  (autenticação e gate de acesso)
// Login por magic link (OTP por e-mail), restrito ao domínio
// institucional. O domínio é validado aqui (UX) e, de forma
// definitiva, pelo RLS no banco (is_institucional()).
// ============================================================
import { sb, hasSupabase } from './supabase.js';

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

export async function signInWithGoogle() {
  const { error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl(),
      // hd sugere ao Google restringir à conta do domínio institucional
      // (dica de UX; a barreira real é a allowlist no RLS).
      queryParams: { hd: 'educacao.pmrp.sp.gov.br', prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

const GOOGLE_SVG = `<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.3 13.3 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.4z"/>
  <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.2z"/>
  <path fill="#34A853" d="M24 48c6.4 0 11.9-2.1 15.8-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.3 0-11.7-3.8-13.6-9.1l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/>
</svg>`;

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
        <button type="button" id="google-btn" class="btn-google">${GOOGLE_SVG}
          <span>Entrar com conta Google</span></button>
        <div class="auth-divider"><span>ou receba um link por e-mail</span></div>
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

  app.querySelector('#google-btn').addEventListener('click', async () => {
    msg.className = 'auth-msg';
    try { await signInWithGoogle(); }
    catch (err) { msg.classList.add('err'); msg.textContent = 'Google indisponível: ' + (err.message || err); }
  });
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
