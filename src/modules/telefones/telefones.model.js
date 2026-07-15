// ============================================================
// FundHub — modules/telefones/telefones.model.js
// Telefones de escolas e servidores. Tabela dedicada `telefone` com
// dono exclusivo (unidade_id OU servidor_id). É o "M": só banco,
// nunca DOM. Escolas e Servidores importam DESTE arquivo.
//
// Fonte única da verdade dos telefones. As colunas legadas
// (unidade_escolar.telefones/whatsapp, servidor.telefone) estão
// deprecadas — só servem de fallback de leitura na view do banco.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

export const TIPOS_TELEFONE = { fixo: 'Fixo', celular: 'Celular', whatsapp: 'WhatsApp' };

const COLS = 'id, servidor_id, unidade_id, tipo, rotulo, numero, principal, obs, criado_em';

// Ordena: principal primeiro, depois por criação.
const ordenar = (a, b) =>
  (b.principal - a.principal) || String(a.criado_em).localeCompare(String(b.criado_em));

// Todos os telefones agrupados por dono, numa consulta só (evita N+1).
// → { porUnidade: { [id]: [tel...] }, porServidor: { [id]: [tel...] } }
// Degrada em silêncio se a tabela ainda não existe (migration 016 não
// rodada): Escolas/Servidores continuam carregando, só sem telefones.
export async function getTelefonesMapas() {
  const out = { porUnidade: {}, porServidor: {} };
  if (!hasSupabase()) return out;
  const { data, error } = await sb().from('telefone').select(COLS);
  if (error) {
    if (error.code === '42P01') { console.warn('Tabela telefone ausente — rode a migration 016.'); return out; }
    throw error;
  }
  (data || []).forEach(t => {
    if (t.unidade_id) (out.porUnidade[t.unidade_id] ||= []).push(t);
    else if (t.servidor_id) (out.porServidor[t.servidor_id] ||= []).push(t);
  });
  for (const m of [out.porUnidade, out.porServidor]) {
    for (const k in m) m[k].sort(ordenar);
  }
  return out;
}

// Telefones de um dono. owner = { unidadeId } ou { servidorId }.
export async function getTelefones(owner) {
  if (!hasSupabase()) return [];
  const [col, id] = owner.unidadeId
    ? ['unidade_id', owner.unidadeId]
    : ['servidor_id', owner.servidorId];
  const { data, error } = await sb().from('telefone').select(COLS).eq(col, id);
  if (error) throw error;
  return (data || []).sort(ordenar);
}

// Sincroniza a lista de telefones de um dono (insere novos, atualiza os
// existentes, remove os que sumiram). `lista` = objetos do editor:
// { id?, tipo, numero, rotulo?, principal, obs? }. Só linhas com número.
export async function sincronizarTelefones(owner, lista) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const [col, id] = owner.unidadeId
    ? ['unidade_id', owner.unidadeId]
    : ['servidor_id', owner.servidorId];
  const cli = sb();

  const validos = (lista || []).filter(t => t.numero && t.numero.trim());
  // Garante no máximo um principal; se nenhum marcado, o primeiro assume.
  let temPrincipal = validos.some(t => t.principal);
  const norm = validos.map((t, i) => ({
    ...t,
    principal: t.principal || (!temPrincipal && i === 0),
  }));

  const atuais = await getTelefones(owner);
  const idsMantidos = new Set(norm.filter(t => t.id).map(t => t.id));
  const remover = atuais.filter(t => !idsMantidos.has(t.id)).map(t => t.id);

  if (remover.length) {
    const { error } = await cli.from('telefone').delete().in('id', remover);
    if (error) throw error;
  }
  for (const t of norm) {
    const row = {
      [col]: id, tipo: t.tipo || 'fixo', numero: t.numero.trim(),
      rotulo: t.rotulo || null, principal: !!t.principal, obs: t.obs || null,
    };
    const q = t.id
      ? cli.from('telefone').update(row).eq('id', t.id)
      : cli.from('telefone').insert(row);
    const { error } = await q;
    if (error) throw error;
  }
}
