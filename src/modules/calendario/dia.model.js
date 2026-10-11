// ============================================================
// FundHub - modules/calendario/dia.model.js
// O que um dia do calendário significa para quem agenda uma saída
// (spec 2026-10-10-sate-disponibilidade, D1). Regras PURAS sobre um registro
// de `dia_calendario`: mora aqui, e não no SATE, porque é o vocabulário do
// próprio calendário - a Disponibilidade, o modal do dia e o formulário do
// SATE fazem todos a mesma leitura. Reexportado por calendario.model.js.
//
//   'bloqueado'   extraclasse bloqueado - vence o resto, é a regra mais específica
//   'nao_letivo'  feriado, recesso
//   'parcial'     letivo só numa faixa de horário (`letivo_de`..`letivo_ate`):
//                 a faixa é o trecho em que HÁ aula. Serve ao recesso que vale
//                 para parte do dia e à reposição de um dia de recesso.
//   'evento'      dia letivo com evento (prova, evento pedagógico, cultural)
//   null          dia comum, ou sem registro: o silêncio é o dia letivo
//
// Nada aqui IMPEDE a solicitação: o dia fora do letivo gera um AVISO, e a
// Gerência de Transporte decide (R15 - erro barra, aviso não).
// ============================================================

// "13:00" ou "13:00:00" (o `time` do banco) → minutos desde 0h; null se não é hora.
const minutos = (hhmm) => {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hm = (hhmm) => String(hhmm).slice(0, 5);

// Letivo só em parte: dia letivo com uma faixa de aula válida.
export const temFaixa = (dia) =>
  !!dia && dia.letivo !== false && minutos(dia.letivo_de) != null && minutos(dia.letivo_ate) != null
  && minutos(dia.letivo_ate) > minutos(dia.letivo_de);

export const faixaDoDia = (dia) => (temFaixa(dia) ? `das ${hm(dia.letivo_de)} às ${hm(dia.letivo_ate)}` : '');

export function situacaoDoDia(dia) {
  if (!dia) return null;
  if (dia.bloqueia_extraclasse) return 'bloqueado';
  if (dia.letivo === false) return 'nao_letivo';
  if (temFaixa(dia)) return 'parcial';
  return String(dia.evento || '').trim() ? 'evento' : null;
}

export const ROTULO_DIA = Object.freeze({
  bloqueado: 'Extraclasse bloqueado', nao_letivo: 'Não letivo', parcial: 'Letivo em parte',
});

// A frase que a pessoa lê sobre o dia (informativa).
export function motivoDoDia(dia) {
  const evento = String(dia?.evento || '').trim();
  const com = (texto) => `${texto}${evento ? ` (${evento})` : ''}.`;
  switch (situacaoDoDia(dia)) {
    case 'bloqueado': return com('Data bloqueada para extraclasse');
    case 'nao_letivo': return com('Não é dia letivo');
    case 'parcial': return com(`Dia letivo em parte: aulas ${faixaDoDia(dia)}`);
    case 'evento': return `Neste dia: ${evento}.`;
    default: return '';
  }
}

// O AVISO vermelho do formulário de solicitação: '' quando não há o que
// avisar. No dia parcial, só avisa quando a viagem (embarque..saída) sai da
// faixa de aula - e só se os dois horários já foram informados.
export function avisoDoDia(dia, { emb = null, ret = null } = {}) {
  const sit = situacaoDoDia(dia);
  if (sit === 'bloqueado' || sit === 'nao_letivo') return motivoDoDia(dia);
  if (sit !== 'parcial') return '';
  const e = minutos(emb), r = minutos(ret);
  if (e == null || r == null) return '';
  if (e >= minutos(dia.letivo_de) && r <= minutos(dia.letivo_ate)) return '';
  return `O horário da viagem cai em período não letivo (há aula ${faixaDoDia(dia)}).`;
}
