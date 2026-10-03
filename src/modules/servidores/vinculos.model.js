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
import { limparCacheServidores, CARGO_GESTOR } from './servidores.model.js';
import { addDias } from '../../shared/format.js';

// Traduz os três papéis fixos que existiam antes da 023. A migration
// normaliza a base; isto é rede de segurança para banco não migrado.
const LEGADO = {
  gestor: 'Gestor(a)',
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
};
export const rotulaCargo = (p) => LEGADO[p] || p || '';

// Função do gestor (spec 2026-10-03, D12): só o cargo Gestor(a) tem.
export const FUNCOES = Object.freeze([
  { valor: 1, rotulo: 'Gestor 1' },
  { valor: 2, rotulo: 'Gestor 2' },
]);
export const temFuncao = (cargo) => rotulaCargo(cargo) === CARGO_GESTOR;
const funcaoValida = (f) => (f === 1 || f === 2 ? f : null);

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
  const c = await cargoCanonico(cargo);
  if (!c) throw new Error('Informe o cargo.');
  const { error } = eGestao
    ? await sb().from('cargo_gestao').upsert({ cargo: c }, { onConflict: 'cargo' })
    : await sb().from('cargo_gestao').delete().eq('cargo', c);
  if (error) throw error;
  _gestao = null;                          // escreveu, invalidou
}

// Sem a migration 045 a coluna `funcao` não existe: o PostgREST recusa a
// gravação inteira (PGRST204) e o Postgres, 42703. Sem função a gravar,
// refaz sem a chave - o local de trabalho não pode deixar de salvar por
// causa de uma coluna que nem seria preenchida. Com função, avisa: gravar
// calado sem ela seria perder o que a pessoa acabou de informar.
const SEM_COLUNA = new Set(['PGRST204', '42703']);
async function gravarComFuncao(row, gravar) {
  let r = await gravar(row);
  if (r.error && SEM_COLUNA.has(r.error.code)) {
    if (row.funcao !== null) {
      const e = new Error('O banco ainda não tem a função do gestor. Avise a Gerência para aplicar a atualização.');
      e.code = r.error.code; e.amigavel = true;
      throw e;
    }
    const { funcao, ...semFuncao } = row;
    r = await gravar(semFuncao);
  }
  return r;
}

export async function criarVinculo({ servidor_id, unidade_id, papel, ingresso = null, fim = null, funcao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  // `ano` continua no banco como carimbo (histórico e horários). Não
  // é critério de nada e não aparece em tela nenhuma.
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const row = { servidor_id, unidade_id, papel: cargo, ano, ingresso, fim,
    funcao: temFuncao(cargo) ? funcaoValida(funcao) : null };
  const { data, error } = await gravarComFuncao(row,
    (r) => sb().from('vinculo').insert(r).select().single());
  if (error) {
    if (error.code === '23505') {
      // Mantém o código e marca amigavel: é o que shared/ui/feedback.js:
      // reportarErro usa para saber que o erro cabe inline e já traduzido.
      const e = new Error('Este servidor já tem esse cargo neste local de trabalho.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  invalidar();
  return data;
}

export async function atualizarVinculo(id, { unidade_id, papel, ingresso = null, fim = null, funcao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = await cargoCanonico(papel);
  if (!cargo) throw new Error('Informe o cargo/função.');
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const patch = { unidade_id, papel: cargo, ano, ingresso, fim,
    funcao: temFuncao(cargo) ? funcaoValida(funcao) : null };
  const { error } = await gravarComFuncao(patch,
    (p) => sb().from('vinculo').update(p).eq('id', id));
  if (error) {
    if (error.code === '23505') {
      // Mantém o código e marca amigavel: é o que shared/ui/feedback.js:
      // reportarErro usa para saber que o erro cabe inline e já traduzido.
      const e = new Error('Este servidor já tem esse cargo neste local de trabalho.');
      e.code = error.code;
      e.amigavel = true;
      throw e;
    }
    throw error;
  }
  invalidar();
}

// Troca de função COM data (spec 2026-10-03, D12): o período atual termina
// na véspera e outro começa, com a função nova - é assim que fica o
// histórico de quem foi Gestor 2 e passou a Gestor 1 na mesma escola.
// Fecha ANTES de abrir: o índice vinculo_aberto_unico não aceita dois
// abertos com o mesmo cargo. Se a abertura falhar, o fechamento é desfeito
// - meio caminho deixaria a pessoa sem local de trabalho atual.
export async function mudarFuncao(servidorId, vinculo, funcao, desde) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const erro = (texto) => Object.assign(new Error(texto), { amigavel: true });
  if (!funcaoValida(funcao)) throw erro('Escolha Gestor 1 ou Gestor 2.');
  if (!desde) throw erro('Informe a partir de quando a função mudou.');
  const vespera = addDias(desde, -1);
  if (vinculo.ingresso && vespera < vinculo.ingresso) {
    throw erro('A mudança precisa ser depois do início deste local de trabalho.');
  }
  const fechar = await sb().from('vinculo').update({ fim: vespera }).eq('id', vinculo.id);
  if (fechar.error) throw fechar.error;
  const { data, error } = await sb().from('vinculo').insert({
    servidor_id: servidorId, unidade_id: vinculo.unidade_id, papel: vinculo.papel,
    ano: Number(String(desde).slice(0, 4)), ingresso: desde, fim: null, funcao,
  }).select().single();
  if (error) {
    await sb().from('vinculo').update({ fim: null }).eq('id', vinculo.id);
    invalidar();
    throw error;
  }
  invalidar();
  return data;
}

// Encerrar ≠ excluir: o vínculo passado é histórico e deve ser
// preservado. A tela oferece as duas coisas, com botões diferentes.
export async function excluirVinculo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').delete().eq('id', id);
  if (error) throw error;
  invalidar();
}
