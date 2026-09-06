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

// ── Documentos: guardar canônico, exibir formatado ───────────
// A máscara é affordance de INTERFACE; o formato de armazenamento é
// outra coisa, e confundir os dois é o que fazia o banco guardar
// '111.111.111-11'. Formato de exibição muda com o locale; o dado, não.
//
//   CPF - 11 dígitos, sem pontuação. Não há norma de armazenamento, mas
//         toda API pública (SERPRO, Receita, gov.br) fala em dígitos.
//   RG  - dígitos + DV, caixa alta, sem pontuação. NÃO existe padrão
//         nacional: cada estado emite o seu, com tamanho próprio e DV
//         que no paulista pode ser 'X'.
//
// `mascara*` formata PROGRESSIVAMENTE, para o campo enquanto se digita:
// mascara o que já veio e não reclama do que falta. `fmt*` é a exibição
// de um valor pronto - só formata o que cabe no padrão, e devolve o cru
// quando não cabe, para nunca esconder um dígito de um RG de fora de SP.
// `*Cru` é o caminho de volta, o que vai ao banco.

// '11111111111' | '111.111.111-11' → '111.111.111-11'
export function mascaraCPF(v) {
  const d = cpfCru(v);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// '123456789' → '12.345.678-9'. O dígito verificador do RG paulista
// pode ser X, então o último caractere aceita letra.
//
// Acima de 9 caracteres a máscara SAI DO CAMINHO e devolve o cru: o
// formato paulista não serve, e truncar aqui apagaria um dígito de um RG
// de outro estado - em silêncio, no `value` do campo, e de novo no banco
// no próximo salvamento.
export function mascaraRG(v) {
  const bruto = rgCru(v);
  if (bruto.length > 9) return bruto;
  const num = bruto.replace(/X/g, '').slice(0, 8);
  const dv = bruto.length > 8 ? bruto.slice(8, 9) : '';
  let out = num;
  if (num.length > 2) out = `${num.slice(0, 2)}.${num.slice(2)}`;
  if (num.length > 5) out = `${num.slice(0, 2)}.${num.slice(2, 5)}.${num.slice(5)}`;
  return dv ? `${out}-${dv}` : out;
}

// O que vai ao banco.
export const cpfCru = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 11);
export const rgCru = (v) => String(v ?? '').toUpperCase().replace(/[^0-9X]/g, '');

// O que aparece na tela. Fora do padrão, o valor cru - inteiro.
export const fmtCPF = (v) => (noPadraoCPF(v) ? mascaraCPF(v) : cpfCru(v));
export const fmtRG = (v) => (noPadraoRG(v) ? mascaraRG(v) : rgCru(v));

// Aviso, nunca erro (R15): RG de outro estado tem outro formato e a SME
// precisa cadastrar essa pessoa. Testam o CRU, que é o que vai ao banco -
// antes testavam a string já mascarada, e passariam a recusar tudo.
// Vazio passa: campo em branco não é campo errado.
export const noPadraoCPF = (v) => !cpfCru(v) || /^\d{11}$/.test(cpfCru(v));

export const noPadraoRG = (v) => !rgCru(v) || /^\d{8}[0-9X]$/.test(rgCru(v));
