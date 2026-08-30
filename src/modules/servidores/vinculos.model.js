// ============================================================
// FundHub - modules/servidores/vinculos.model.js
// O VÍNCULO (designação): pessoa × local × cargo × período.
// É a fonte única do "onde" e do "como" de um servidor.
//
// Aberto = SEM data de fim. Não existe coluna `ativo`: duas fontes de
// verdade para o mesmo fato produziam o estado impossível
// "inativo, sem data de encerramento" (corrigido na migration 023).
//
// O cargo é TEXTO LIVRE e o catálogo é derivado dos valores em uso -
// ele não tem vida própria, ele É o conjunto dos cargos em uso. Cargo
// novo entra ao ser digitado; cargo cujo último vínculo acabou some.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';
import { registrarCache } from '../../shared/cache.js';
import { limparCacheServidores } from './servidores.model.js';

// Traduz os três papéis fixos que existiam antes da 023. A migration
// normaliza a base; isto é rede de segurança para banco não migrado.
const LEGADO = {
  gestor: 'Gestor(a)',
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
};
export const rotulaCargo = (p) => LEGADO[p] || p || '';

// Espaços aparados e colapsados. Não forçamos caixa: "Vice-diretor(a)"
// é escrito como a SME escreve.
export const normalizaCargo = (p) => String(p ?? '').trim().replace(/\s+/g, ' ');

let _cargos = null;
export function limparCacheCargos() { _cargos = null; }
registrarCache(limparCacheCargos);

// Catálogo: os cargos hoje em uso, em ordem alfabética.
export async function getCargos() {
  if (_cargos) return _cargos;
  if (!hasSupabase()) { _cargos = []; return _cargos; }
  const { data, error } = await sb().from('vinculo').select('papel');
  if (error) throw error;
  const vistos = new Map();               // chave sem caixa → grafia gravada
  for (const r of data || []) {
    const c = rotulaCargo(normalizaCargo(r.papel));
    if (c && !vistos.has(c.toLowerCase())) vistos.set(c.toLowerCase(), c);
  }
  _cargos = [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt'));
  return _cargos;
}

// Reaproveita a grafia já em uso quando o cargo digitado só difere em
// maiúscula - senão o catálogo acumula "Coordenadora" e "coordenadora".
export async function cargoCanonico(bruto) {
  const c = normalizaCargo(bruto);
  if (!c) return '';
  const existentes = await getCargos().catch(() => []);
  return existentes.find(x => x.toLowerCase() === c.toLowerCase()) || c;
}

function invalidar() {
  _cargos = null;
  limparCacheServidores();
}

let _gestao = null;
export function limparCacheCargosGestao() { _gestao = null; }
registrarCache(limparCacheCargosGestao);

// Quais cargos compõem a equipe gestora. Vive aqui porque este model
// é o dono do domínio "cargo"; quem consome é o módulo Horários.
//
// Degrada sem a migration 024: sem a tabela, devolve conjunto vazio e
// a grade cai no comportamento "ninguém é gestão por omissão", que a
// tela explica ao usuário em vez de quebrar.
export async function getCargosGestao() {
  if (_gestao) return _gestao;
  if (!hasSupabase()) { _gestao = new Set(); return _gestao; }
  const { data, error } = await sb().from('cargo_gestao').select('cargo');
  if (error) {
    if (error.code === '42P01') { _gestao = new Set(); return _gestao; }
    throw error;
  }
  _gestao = new Set((data || []).map(r => r.cargo));
  return _gestao;
}

export async function definirCargoGestao(cargo, eGestao) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const c = normalizaCargo(cargo);
  if (!c) throw new Error('Informe o cargo.');
  const { error } = eGestao
    ? await sb().from('cargo_gestao').upsert({ cargo: c }, { onConflict: 'cargo' })
    : await sb().from('cargo_gestao').delete().eq('cargo', c);
  if (error) throw error;
  _gestao = null;                          // escreveu, invalidou
}

export async function criarVinculo({ servidor_id, unidade_id, papel, ingresso = null, fim = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  // `ano` continua no banco como carimbo (histórico e horários). Não
  // é critério de nada e não aparece em tela nenhuma.
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const row = { servidor_id, unidade_id, papel: cargo, ano, ingresso, fim };
  const { data, error } = await sb().from('vinculo').insert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      // Mantém o código e marca amigavel: é o que shared/ui/feedback.js:
      // reportarErro usa para saber que o erro cabe inline e já traduzido.
      const e = new Error('Este servidor já tem um vínculo aberto com esse cargo neste local.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  invalidar();
  return data;
}

export async function atualizarVinculo(id, { unidade_id, papel, ingresso = null, fim = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const patch = { unidade_id, papel: cargo, ano, ingresso, fim };
  const { error } = await sb().from('vinculo').update(patch).eq('id', id);
  if (error) {
    if (error.code === '23505') {
      // Mantém o código e marca amigavel: é o que shared/ui/feedback.js:
      // reportarErro usa para saber que o erro cabe inline e já traduzido.
      const e = new Error('Este servidor já tem um vínculo aberto com esse cargo neste local.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  invalidar();
}

// Encerrar ≠ excluir: o vínculo passado é histórico e deve ser
// preservado. A tela oferece as duas coisas, com botões diferentes.
export async function excluirVinculo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').delete().eq('id', id);
  if (error) throw error;
  invalidar();
}
