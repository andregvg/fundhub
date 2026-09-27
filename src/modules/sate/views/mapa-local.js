// ============================================================
// FundHub - sate/views/mapa-local.js
// Mapa com pino arrastável para acertar a coordenada de um local
// (spec 2026-09-27, D7) - como o "Editar local" do agendamentos-fil.
//
// Leaflet é EXCEÇÃO NOMEADA à regra "sem dependência nova" (CLAUDE.md):
// versão fixa, jsDelivr, SRI, e carregado SÓ quando este mapa é pedido -
// nenhuma outra tela paga por ele. Sem rede ou com o CDN fora, devolve
// null e a tela segue com os campos de coordenada. Degrada, não quebra.
// ============================================================
const BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const SRI_JS = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const SRI_CSS = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
// Centro de Ribeirão Preto - onde o mapa abre quando o local não tem ponto.
const CENTRO = [-21.1775, -47.8103];

let carregando = null;

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

export async function montarMapaLocal(el, { lat = null, lng = null, aoMover = () => {} } = {}) {
  let L;
  try { L = await carregarLeaflet(); } catch (_) { return null; }
  if (!el.isConnected) return null;   // o modal fechou enquanto carregava
  const tem = Number.isFinite(lat) && Number.isFinite(lng);
  const mapa = L.map(el).setView(tem ? [lat, lng] : CENTRO, tem ? 17 : 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(mapa);
  const pino = L.marker(tem ? [lat, lng] : CENTRO, { draggable: true, opacity: tem ? 1 : 0.5 }).addTo(mapa);
  const mover = (a, b) => { pino.setLatLng([a, b]).setOpacity(1); mapa.setView([a, b], Math.max(mapa.getZoom(), 16)); };
  pino.on('dragend', () => { const p = pino.getLatLng(); pino.setOpacity(1); aoMover(p.lat, p.lng); });
  mapa.on('click', (e) => { mover(e.latlng.lat, e.latlng.lng); aoMover(e.latlng.lat, e.latlng.lng); });
  // O modal acabou de abrir: o Leaflet mediu o contêiner antes do layout.
  setTimeout(() => mapa.invalidateSize(), 60);
  return { mover };
}
