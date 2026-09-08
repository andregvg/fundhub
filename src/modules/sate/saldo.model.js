// ============================================================
// FundHub - modules/sate/saldo.model.js
// Quantos veículos estão livres num dia, por período.
//
// Agregado próprio, e não um pedaço de `sate.model.js` ou de
// `frota.model.js`: a conta lê os DOIS (a frota vigente e o que as
// solicitações comprometeram) e não pertence a nenhum deles. Saiu de
// `sate.model.js` em 08/09/2026, quando aquele arquivo passou do teto
// de 250 linhas (R11).
//
// Sem ciclo: este arquivo importa de `frota.model.js` e de
// `sate.model.js`, e nenhum dos dois importa daqui.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { addDias } from '../../shared/format.js';
import { totalDoDia } from './frota.model.js';
import { PERIODOS, STATUS_RESERVA } from './sate.model.js';

const ausente = (err) => err?.code === '42P01' || err?.code === '42703';

// ── Saldo ────────────────────────────────────────────────────
// Veículos COMPROMETIDOS por período num dia. Só os status de reserva.
export async function usoDoDia(dataISO) {
  const base = { onibus: { manha: 0, tarde: 0, noite: 0 }, van_adaptada: { manha: 0, tarde: 0, noite: 0 } };
  if (!hasSupabase() || !dataISO) return base;
  const { data, error } = await sb().from('solicitacao_transporte')
    .select('periodo, qtd_onibus, qtd_vans, status')
    .eq('data', dataISO).in('status', STATUS_RESERVA);
  if (error) { if (ausente(error)) return base; throw error; }
  for (const r of data || []) {
    if (!base.onibus[r.periodo]) continue;
    base.onibus[r.periodo] += r.qtd_onibus || 0;
    base.van_adaptada[r.periodo] += r.qtd_vans || 0;
  }
  return base;
}

// O saldo de um dia: total (do dia, § D4) menos o comprometido em cada
// período. `livre` nunca é negativo na exibição - um dia estourado por
// exceção de aprovador mostra zero livre, e o excesso aparece como
// `estouro`, que é o número que interessa a quem aprova.
//
// A CONTA VEM DO BANCO, por `saldo_transporte()` (migration 036), e não
// de somar as linhas aqui. O motivo é o RLS: uma escola só lê as
// solicitações em que está envolvida, então somar pelo cliente daria a
// ela o próprio uso e mais nada - "9 de 9 livres" num dia lotado, na
// tela que existe justamente para avisar que as vagas acabaram.
//
// A função é `security definer` e devolve só CONTAGEM: nenhuma escola,
// nenhum horário, nada que diga de quem é a reserva.
export async function saldoDoDia(dataISO) {
  const monta = (tipo, bruto) => {
    const out = {};
    for (const p of Object.keys(PERIODOS)) {
      const t = bruto?.[tipo]?.[p]?.total || 0;
      const u = bruto?.[tipo]?.[p]?.uso || 0;
      out[p] = { total: t, uso: u, livre: Math.max(0, t - u), estouro: Math.max(0, u - t) };
    }
    return out;
  };

  if (hasSupabase()) {
    const { data, error } = await sb().rpc('saldo_transporte', { p_data: dataISO });
    if (!error && data) return { onibus: monta('onibus', data), van_adaptada: monta('van_adaptada', data) };
    // QUALQUER falha cai na soma pelo cliente, sem relançar. O caso comum
    // é a 036 ainda não ter rodado - e aí o PostgREST devolve `PGRST202`,
    // não o `42883` do Postgres, o que faria uma checagem por código
    // específico deixar a tela quebrar em vez de degradar. Como a rota
    // alternativa É o comportamento anterior (certo para quem aprova,
    // otimista para a escola), cair nela nunca é pior que falhar.
    if (error) console.warn('[sate] saldo_transporte indisponível, somando no cliente:', error.message);
  }

  const [total, uso] = await Promise.all([totalDoDia(dataISO), usoDoDia(dataISO)]);
  const bruto = {};
  for (const tipo of ['onibus', 'van_adaptada']) {
    bruto[tipo] = {};
    for (const p of Object.keys(PERIODOS)) {
      bruto[tipo][p] = { total: total[tipo] || 0, uso: uso[tipo][p] || 0 };
    }
  }
  return { onibus: monta('onibus', bruto), van_adaptada: monta('van_adaptada', bruto) };
}

// Só o que a regra (b) precisa do dia seguinte: ônibus livres de manhã.
export async function livreManhaSeguinte(dataISO) {
  const s = await saldoDoDia(addDias(dataISO, 1));
  return s.onibus.manha.livre;
}
