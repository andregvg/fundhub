// ============================================================
// FundHub — shared/ui/drawer.js
// Painel lateral (gaveta) usado por Escolas, Calendário e
// Afastamentos. Em telas pequenas ocupa a largura toda — é o padrão
// mobile-first de "detalhe/edição" do FundHub.
//
// Uso na view:
//   app.innerHTML = `… ${drawerHtml()}`;
//   montarDrawer();                    // liga fundo + tecla Esc
//   abrirDrawer(`<div class="drawer-head">…</div>…`);
// ============================================================

// Marcação a incluir no final do HTML da página.
export const drawerHtml = () => `
  <div class="drawer-back" id="drawer-back"></div>
  <aside class="drawer" id="drawer" aria-hidden="true"></aside>`;

let escListener = null;

export function montarDrawer() {
  document.getElementById('drawer-back')?.addEventListener('click', fecharDrawer);
  // Um único listener de teclado por página: registrar a cada render
  // vazava listeners e fechava gavetas de telas já descartadas.
  if (escListener) document.removeEventListener('keydown', escListener);
  escListener = (e) => { if (e.key === 'Escape') fecharDrawer(); };
  document.addEventListener('keydown', escListener);
}

export function abrirDrawer(html) {
  const d = document.getElementById('drawer');
  if (!d) return;
  d.innerHTML = html;
  d.setAttribute('aria-hidden', 'false');
  d.classList.add('open');
  document.getElementById('drawer-back')?.classList.add('open');
  d.querySelector('.drawer-close')?.addEventListener('click', fecharDrawer);
  d.querySelector('.drawer-close')?.focus();
}

export function fecharDrawer() {
  const d = document.getElementById('drawer');
  d?.classList.remove('open');
  d?.setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-back')?.classList.remove('open');
}

// Cabeçalho padrão da gaveta (o botão × é ligado por abrirDrawer).
export const drawerHead = (titulo, sub = '') => `
  <div class="drawer-head">
    <div><h2>${titulo}</h2>${sub ? `<small>${sub}</small>` : ''}</div>
    <button class="drawer-close" type="button" aria-label="Fechar">×</button>
  </div>`;
