// ============================================================
// FundHub - shared/ui/mapa-pino.js
// Mapa com pino arrastável para acertar a coordenada de um ponto - o
// cadastro de locais do SATE (spec 2026-09-27, D7) e o de escolas (spec
// 2026-10-03, D15).
//
// É componente comum desde o segundo uso: Escolas não pode importar a tela
// de outro módulo (R2), e duas cópias seriam dois lugares para manter a
// versão e o SRI do Leaflet (spec 2026-10-03, D16).
//
// Leaflet é EXCEÇÃO NOMEADA à regra "sem dependência nova" (CLAUDE.md):
// versão fixa, jsDelivr, SRI, e carregado SÓ quando um formulário com mapa abre -
// nenhuma outra tela paga por ele. Sem rede ou com o CDN fora, devolve
// null e a tela segue com os campos de coordenada. Degrada, não quebra.
// ============================================================
import { ico } from './icones.js';
import { esc } from '../dom.js';
import { prenderFoco } from './foco.js';

const BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const SRI_JS = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const SRI_CSS = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
// Centro de Ribeirão Preto - onde o mapa abre quando o local não tem ponto.
const CENTRO = [-21.1775, -47.8103];

let carregando = null;

// O mapa anterior, para desmontá-lo quando o próximo nascer. O Leaflet liga
// um ouvinte de `resize` em `window` a cada L.map() e só o desliga em
// remove(); trocar o innerHTML do modal não desliga nada. Há um modal por
// vez no hub: o mapa de antes já não está na tela quando outro é pedido.
let mapaAnterior = null;

function carregarLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    Object.assign(css, { rel: 'stylesheet', href: BASE + 'leaflet.css', integrity: SRI_CSS, crossOrigin: 'anonymous' });
    document.head.appendChild(css);
    const js = document.createElement('script');
    Object.assign(js, { src: BASE + 'leaflet.js', integrity: SRI_JS, crossOrigin: 'anonymous' });
    js.onload = () => resolve(window.L);
    js.onerror = () => { carregando = null; reject(new Error('Leaflet indisponível')); };
    document.head.appendChild(js);
  });
  return carregando;
}

// O mapa nasce RECOLHIDO, atrás de um botão "Ver no mapa" que o componente
// mesmo desenha antes do contêiner (04/10/2026). Dois motivos: aberto, ele
// ocupava um terço do formulário de quem só queria trocar um telefone; e a
// roda do mouse, ao passar por cima, parava de rolar o formulário e dava
// zoom no mapa - por isso também `scrollWheelZoom: false` (o zoom fica nos
// botões + e −, e no gesto de pinça). De brinde, o Leaflet só é baixado
// por quem abre o mapa, não por quem abre o formulário.
//
// Devolve o handle na hora, com o mapa ainda por criar: `mover(lat, lng)`
// guarda o ponto e o pino nasce nele quando o mapa abrir.
export async function montarMapaPino(el, { lat = null, lng = null, aoMover = () => {} } = {}) {
  let pos = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  let mapa = null, pino = null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mini-btn mapa-pino-alternar';
  const rotular = (aberto) => {
    btn.innerHTML = `${ico('visita', { tam: 13 })} ${aberto ? 'Ocultar mapa' : 'Ver no mapa'}`;
    btn.setAttribute('aria-expanded', String(aberto));
  };
  rotular(false);
  el.hidden = true;
  el.before(btn);

  const mover = (a, b) => {
    pos = [a, b];
    if (!pino) return;
    pino.setLatLng(pos).setOpacity(1);
    mapa.setView(pos, Math.max(mapa.getZoom(), 16));
  };

  async function criar() {
    let L;
    try { L = await carregarLeaflet(); } catch (_) { L = null; }
    if (!el.isConnected) return;   // o modal fechou enquanto carregava
    if (!L) {
      // Sem rede ou com o CDN fora: o formulário segue com latitude e longitude.
      el.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Mapa indisponível';
      return;
    }
    // Só depois da conferência acima: um pedido que chegou tarde não pode
    // derrubar o mapa que está em uso.
    try { mapaAnterior?.remove(); } catch (_) { /* contêiner já fora do documento */ }
    mapa = L.map(el, { scrollWheelZoom: false }).setView(pos || CENTRO, pos ? 17 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(mapa);
    mapaAnterior = mapa;
    pino = L.marker(pos || CENTRO, { draggable: true, opacity: pos ? 1 : 0.5 }).addTo(mapa);
    pino.on('dragend', () => { const q = pino.getLatLng(); pino.setOpacity(1); pos = [q.lat, q.lng]; aoMover(q.lat, q.lng); });
    mapa.on('click', (e) => { mover(e.latlng.lat, e.latlng.lng); aoMover(e.latlng.lat, e.latlng.lng); });
  }

  btn.addEventListener('click', async () => {
    if (!el.hidden) { el.hidden = true; rotular(false); return; }
    el.hidden = false;
    rotular(true);
    if (!mapa) await criar();
    // O contêiner acabou de aparecer: o Leaflet precisa medir de novo.
    setTimeout(() => { if (mapa && mapaAnterior === mapa) mapa.invalidateSize(); }, 60);
  });

  return { mover };
}

// O mapa só para OLHAR um ponto, numa camada própria (a do confirmar.js) e
// não na pilha de modais: aberto de dentro de um formulário, um modal
// reabriria o de baixo do zero e a pessoa perderia o que digitou.
export async function abrirMapaLocal({ titulo, endereco = '', lat, lng }) {
  document.getElementById('mapa-local-back')?.remove();
  const back = document.createElement('div');
  back.id = 'mapa-local-back';
  back.className = 'confirmar-back open';
  back.innerHTML = `
    <div class="confirmar-card mapa-local-card" role="dialog" aria-modal="true" aria-labelledby="ml-t">
      <h3 id="ml-t">${esc(titulo)}</h3>
      <p>${esc(endereco)}</p>
      <div class="mapa-pino" id="ml-mapa"></div>
      <div class="confirmar-acoes"><button type="button" class="btn-secundario" id="ml-fechar">Fechar</button></div>
    </div>`;
  document.body.appendChild(back);
  const anterior = document.activeElement;
  let mapa = null;
  let soltar = null;
  const fechar = () => {
    try { mapa?.remove(); } catch (_) { /* contêiner já fora */ }
    soltar?.();
    back.remove();
    anterior?.focus?.();
  };
  soltar = prenderFoco(back.querySelector('.confirmar-card'), { aoEsc: fechar });
  back.querySelector('#ml-fechar').addEventListener('click', fechar);
  back.addEventListener('click', (e) => { if (e.target === back) fechar(); });
  back.querySelector('#ml-fechar').focus();

  let L;
  try { L = await carregarLeaflet(); } catch (_) { L = null; }
  const el = back.querySelector('#ml-mapa');
  if (!back.isConnected) return;
  if (!L) { el.textContent = 'Mapa indisponível agora.'; return; }
  mapa = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
  L.marker([lat, lng]).addTo(mapa);
  setTimeout(() => mapa?.invalidateSize(), 60);
}
