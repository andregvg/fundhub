// ============================================================
// FundHub - shared/format.js
// Datas e rótulos. Tudo em fuso local: `toLocaleDateString('sv-SE')`
// devolve yyyy-mm-dd no fuso do usuário (evita o bug clássico do
// toISOString(), que volta um dia à noite no Brasil).
// ============================================================

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Hoje em ISO local (yyyy-mm-dd).
export const hojeISO = () => new Date().toLocaleDateString('sv-SE');

// Agora, timestamp ISO/UTC - para carimbar criado_em/atualizado_em.
// Diferente de hojeISO(): aqui o UTC é o formato certo (é o que o banco
// grava); nunca fatiar isto para virar data civil (ver hojeISO acima).
export const agoraISO = () => new Date().toISOString();

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

// Timestamp (ISO/UTC do banco) → 'dd/mm/aaaa, hh:mm' no fuso de São Paulo.
// Todo carimbo de data-hora exibido ao usuário passa por aqui, para o
// horário bater com o relógio local independentemente de onde o banco está.
const TZ = 'America/Sao_Paulo';
export function fmtDataHora(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Idade em anos a partir de uma data civil. Aritmética de calendário
// direto na string: nada de Date, para não repetir o bug do fuso.
export function fmtIdade(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const [ha, hm, hd] = hojeISO().split('-').map(Number);
  let anos = ha - a;
  if (hm < m || (hm === m && hd < d)) anos--;
  if (anos < 0 || anos > 130) return '';
  return anos === 1 ? '1 ano' : `${anos} anos`;
}

// ── Máscaras de documento ────────────────────────────────────
// Formatação progressiva: mascaram o que já foi digitado e não
// reclamam do que falta. Quem valida "de verdade" é noPadrao*(),
// e o resultado dela é AVISO, não erro (R15) - RG de outro estado
// tem outro formato e a SME precisa cadastrar essa pessoa.

// '11111111111' → '111.111.111-11'
export function mascaraCPF(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// '123456789' → '12.345.678-9'. O dígito verificador do RG paulista
// pode ser X, então o último caractere aceita letra.
export function mascaraRG(v) {
  const bruto = String(v ?? '').toUpperCase().replace(/[^0-9X]/g, '').slice(0, 9);
  const num = bruto.replace(/X/g, '').slice(0, 8);
  const dv = bruto.length > 8 ? bruto.slice(8, 9) : '';
  let out = num;
  if (num.length > 2) out = `${num.slice(0, 2)}.${num.slice(2)}`;
  if (num.length > 5) out = `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5)}`;
  return dv ? `${out}-${dv}` : out;
}

export const noPadraoCPF = (v) =>
  !String(v ?? '').trim() || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(String(v).trim());

export const noPadraoRG = (v) =>
  !String(v ?? '').trim() || /^\d{2}\.\d{3}\.\d{3}-[0-9X]$/.test(String(v).trim().toUpperCase());
