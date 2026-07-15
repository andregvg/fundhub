// ============================================================
// FundHub — shared/realtime.js
// Assinatura de mudanças de uma tabela via Supabase Realtime. O RLS
// continua valendo: cada usuário só recebe eventos das linhas que já
// poderia ler. A tabela precisa estar na publicação `supabase_realtime`
// (ver migrations 006 e 014).
// ============================================================
import { sb, hasSupabase } from '../core/supabase.js';

// Assina INSERT/UPDATE/DELETE de `tabela`. Devolve o unsubscribe.
export function subscribeTabela(tabela, handler, canal) {
  if (!hasSupabase()) return () => {};
  const ch = sb().channel(canal || `${tabela}-rt`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, handler)
    .subscribe();
  return () => { try { sb().removeChannel(ch); } catch (_) {} };
}
