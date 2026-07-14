// ============================================================
// FundHub — data/servidores.js  (servidores: gestores/coord./superv.)
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';

let _cache = null;
export async function getServidores() {
  if (_cache) return _cache;
  if (!hasSupabase()) { _cache = []; return _cache; }
  const { data, error } = await sb().from('servidor')
    .select('id, nome, apelido, email, telefone').order('nome');
  if (error) throw error;
  _cache = data || [];
  return _cache;
}
