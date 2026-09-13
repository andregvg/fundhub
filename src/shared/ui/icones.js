// ============================================================
// FundHub - shared/ui/icones.js
// Conjunto de ícones do hub. Traçados do Feather (MIT), grade
// 24x24, sem preenchimento, traço de 2 e cantos redondos.
//
// Por que SVG e não emoji: emoji não alinha (cada glifo tem
// baseline própria), não herda cor (é bitmap colorido, e por isso
// ignora o tema escuro e a R9) e muda de desenho conforme o
// sistema operacional - inaceitável numa rede de 144 escolas com
// parque heterogêneo.
//
// O nome descreve a COISA, não o desenho: 'excluir', não 'lixeira'.
// Assim trocar o traçado depois não obriga a renomear as chamadas.
// ============================================================

// Só o miolo do SVG. O envelope é montado por ico().
const TRACOS = {
  escola: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  sede: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  servidor: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  equipe: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  horario: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  afastamento: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  transporte: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  dashboard: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  modulos: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  ata: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  ocorrencia: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  projeto: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  visita: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  acesso: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  auditoria: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  docs: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  sino: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  editar: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  excluir: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  adicionar: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  fechar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  ok: '<polyline points="20 6 9 17 4 12"/>',
  atencao: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  erro: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  restrito: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  perdido: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  vazio: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  fixo: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  celular: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  email: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  documento: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  arquivo: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  identidade: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  imprimir: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  tema: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  noturno: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  subir: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  meta: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  parceria: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  obra: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  infantil: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  acessibilidade: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  destaque: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  atualizar: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  voltar: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  // Par de `voltar`, e não `voltar` girado por CSS: este arquivo nomeia a
  // COISA, não o desenho - um ícone chamado "voltar" que significa
  // "avançar" contraria a própria doutrina do arquivo.
  avancar: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  arrastar: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  ajuda: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  // Sai do FundHub e abre outro site. Semântico: sinaliza ao usuário
  // que o clique troca de contexto, antes de ele clicar.
  externo: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
};

// Ícones com GRADE PRÓPRIA - desenhos que não cabem no traço 24x24 do
// Feather sem perder o que os torna reconhecíveis. Vieram do
// agendamentos-fil (Scripts.html), que a rede já conhece de vista: o
// ônibus é silhueta preenchida; a cadeira é o Símbolo Internacional de
// Acesso em traço, numa grade de 100. `ico()` monta o envelope de cada um
// com os atributos daqui, e todos continuam herdando `currentColor`.
const PROPRIOS = {
  onibus: {
    viewBox: '0 0 1110 1280',
    atributos: 'fill="currentColor" stroke="none"',
    corpo: '<g transform="translate(0,1280) scale(0.1,-0.1)"><path d="M2290 12789 c-450 -37 -921 -185 -1262 -396 -581 -359 -915 -889 -1010 -1598 -11 -82 -13 -850 -13 -4230 l0 -4130 27 -100 c15 -55 51 -147 80 -205 45 -90 65 -118 143 -195 64 -65 110 -101 160 -127 121 -62 260 -98 377 -98 l58 0 0 -429 c0 -541 13 -647 105 -836 105 -218 271 -356 501 -415 168 -44 408 -35 577 21 216 72 389 256 474 504 48 142 53 204 53 696 l0 459 2990 0 2990 0 0 -459 c0 -492 5 -554 53 -696 129 -378 425 -571 847 -552 339 16 571 161 705 442 92 194 105 294 105 834 l0 428 73 6 c39 4 108 16 152 28 310 81 516 276 597 564 l23 80 3 4095 c2 2882 0 4139 -8 4245 -28 390 -107 711 -244 992 -293 600 -801 943 -1566 1060 -108 16 -330 17 -3500 19 -1862 1 -3432 -2 -3490 -7z m6101 -1280 c77 -26 131 -91 145 -176 15 -94 -54 -200 -149 -228 -45 -13 -388 -15 -2837 -15 -2449 0 -2792 2 -2837 15 -63 19 -126 84 -143 146 -29 106 32 221 135 257 44 15 5640 16 5686 1z m1255 -1296 c268 -73 452 -243 542 -503 59 -172 57 -104 57 -1595 0 -1283 -1 -1375 -18 -1454 -43 -201 -117 -343 -242 -467 -97 -97 -210 -158 -356 -195 l-94 -24 -3985 0 -3985 0 -94 24 c-146 37 -259 98 -356 195 -122 120 -193 256 -241 457 -17 69 -18 169 -21 1399 -4 1376 -3 1409 38 1575 25 102 104 264 163 335 120 145 294 240 491 269 33 5 1826 8 4040 7 l3980 -1 81 -22z m-7727 -5974 c475 -121 750 -620 599 -1089 -117 -366 -477 -612 -858 -586 -233 15 -429 108 -582 276 -262 287 -296 712 -83 1042 195 301 572 447 924 357z m7578 21 c193 -26 363 -109 499 -245 180 -179 274 -446 244 -694 -52 -423 -375 -729 -800 -757 -381 -26 -741 220 -858 586 -96 298 -25 618 186 842 194 206 460 303 729 268z"/></g>',
  },
  cadeirante: {
    viewBox: '0 0 100 100',
    atributos: 'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"',
    corpo: '<circle cx="50" cy="17" r="8" fill="currentColor" stroke="none"/><path d="M49 30v18h22"/><path d="M48 48l9 25"/><path d="M44 37H30"/><path d="M37 51a22 22 0 1 0 20 31"/><path d="M58 73h24l9 14"/>',
  },
};

export const NOMES = Object.freeze([...Object.keys(TRACOS), ...Object.keys(PROPRIOS)]);
export const TEM_ICONE = (nome) => Object.hasOwn(TRACOS, nome) || Object.hasOwn(PROPRIOS, nome);

// Ícone inexistente devolve string vazia: um nome errado deixa um
// buraco na tela, nunca um erro de JS que derruba a página inteira.
// Object.hasOwn (não acesso direto TRACOS[nome]) porque nome vem de
// fora e um nome como 'constructor' ou 'toString' resolveria para a
// propriedade herdada de Object.prototype - truthy, e a guarda
// deixaria passar.
export function ico(nome, { tam = 16, classe = '' } = {}) {
  if (!TEM_ICONE(nome)) return '';
  const cls = classe ? `ico ${classe}` : 'ico';
  const proprio = Object.hasOwn(PROPRIOS, nome) ? PROPRIOS[nome] : null;
  if (proprio) {
    return `<svg class="${cls}" width="${tam}" height="${tam}" viewBox="${proprio.viewBox}"`
      + ` ${proprio.atributos} aria-hidden="true">${proprio.corpo}</svg>`;
  }
  return `<svg class="${cls}" width="${tam}" height="${tam}" viewBox="0 0 24 24"`
    + ` fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"`
    + ` stroke-linejoin="round" aria-hidden="true">${TRACOS[nome]}</svg>`;
}
