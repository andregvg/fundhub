// ============================================================
// FundHub — shell/home.js  (a home do hub: os tiles dos módulos)
// Os tiles saem do registro de módulos — nada é escrito à mão aqui.
// Um módulo novo aparece na home só por existir o seu module.js.
// ============================================================
import { modulosVisiveis } from '../core/registry.js';
import { esc } from '../shared/dom.js';

export function renderHome(app, perfil) {
  const tiles = modulosVisiveis(perfil).map(tile).join('');
  app.innerHTML = `
    <section class="hero">
      <h1>Bem-vindo ao FundHub</h1>
      <p>Hub de aplicações gerenciais da Gerência de Ensino Fundamental.
         Escolha uma ferramenta abaixo; os módulos marcados como
         <strong>em breve</strong> entram em operação nas próximas etapas.</p>
    </section>
    <div class="tiles">${tiles}</div>`;
}

function tile(m) {
  const badge = m.ativo
    ? `<span class="badge ativo">ativo</span>`
    : `<span class="badge breve">em breve</span>`;
  const admin = m.admin ? `<span class="badge admin">admin</span>` : '';
  const inner = `${admin}${badge}
    <div class="ico" aria-hidden="true">${m.ico}</div>
    <h3>${esc(m.nome)}</h3>
    <p>${esc(m.desc)}</p>`;

  // Módulo ativo com rota → tile clicável. Ativo sem rota (serviço, como as
  // Notificações) → tile informativo. Inativo → tile apagado.
  if (m.ativo && m.rota) return `<a class="tile" href="${m.rota}">${inner}</a>`;
  return `<div class="tile ${m.ativo ? 'servico' : 'soon'}">${inner}</div>`;
}
