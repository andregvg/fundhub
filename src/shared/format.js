// ============================================================
// FundHub — shared/format.js
// Datas e rótulos. Tudo em fuso local: `toLocaleDateString('sv-SE')`
// devolve yyyy-mm-dd no fuso do usuário (evita o bug clássico do
// toISOString(), que volta um dia à noite no Brasil).
// ============================================================

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Hoje em ISO local (yyyy-mm-dd).
export const hojeISO = () => new Date().toLocaleDateString('sv-SE');

// '2026-07-14' → '14/07/2026'
export function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

// '2026-07-14' → 'terça-feira, 14 de julho de 2026'
export function fmtExtenso(iso = hojeISO()) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}

export const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(s));

export const horaAgora = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
