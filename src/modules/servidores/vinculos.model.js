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
import { hojeISO } from '../../shared/format.js';

// Traduz os três papéis fixos que existiam antes da 023. A migration
// normaliza a base; isto é rede de segurança para banco não migrado.
const LEGADO = {
  gestor: 'Gestor(a)',
  coordenador: 'Coordenador(a)',
  supervisor: 'Supervisor(a)',
};
export const rotulaCargo = (p) => Object.hasOwn(LEGADO, p) ? LEGADO[p] : (p || '');

// Função do gestor (spec 2026-10-03, D12): só o cargo Gestor(a) tem.
export const FUNCOES = Object.freeze([
  { valor: 1, rotulo: 'Gestor 1' },
  { valor: 2, rotulo: 'Gestor 2' },
]);
// Cargo digitado em "+ Outro…" não passa pelo catálogo: "gestor(a)" e
// "  Gestor(a) " são o mesmo cargo que `cargoCanonico` vai gravar como
// "Gestor(a)", então a tela e o model concordam (normalizaCargo é declarada
// abaixo, mas só é chamada depois de o módulo carregar).
export const temFuncao = (cargo) =>
  rotulaCargo(normalizaCargo(cargo)).toLowerCase() === CARGO_GESTOR.toLowerCase();
// Coage: o valor de um <select> chega como texto. Number('') e Number(null)
// dão 0, que também não é função.
export function funcaoValida(f) {
  const n = Number(f);
  return n === 1 || n === 2 ? n : null;
}

// Erro já traduzido, do jeito que shared/ui/feedback.js:reportarErro espera:
// mantém o código e marca `amigavel`, para caber inline.
const amigavel = (texto, code) => Object.assign(new Error(texto), { amigavel: true, code });
const SEM_A_045 = 'O banco ainda não tem a função do gestor. Avise a Gerência para aplicar a atualização.';
const DUPLICADO = 'Este servidor já tem esse cargo neste local de trabalho.';

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
// Patch SEM a chave `funcao` (atualizar sem mexer na função) não tem o que
// refazer nem o que avisar: o erro volta como veio.
export async function _gravarComFuncao(row, gravar) {
  let r = await gravar(row);
  if (r.error && SEM_COLUNA.has(r.error.code) && 'funcao' in row) {
    if (row.funcao !== null) throw amigavel(SEM_A_045, r.error.code);
    const { funcao, ...semFuncao } = row;
    r = await gravar(semFuncao);
  }
  return r;
}

// O que vai para a coluna `papel`. O banco exige 'Gestor(a)' EXATO (CHECK e
// mudar_funcao_gestor); a tela aceita "gestor(a)" e o legado "gestor".
export const papelParaGravar = (cargo) => temFuncao(cargo) ? CARGO_GESTOR : normalizaCargo(cargo);

export async function criarVinculo({ servidor_id, unidade_id, papel, ingresso = null, fim = null, funcao = null }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = papelParaGravar(await cargoCanonico(papel));
  if (!cargo) throw new Error('Informe o cargo/função.');
  // `ano` continua no banco como carimbo (histórico e horários). Não
  // é critério de nada e não aparece em tela nenhuma.
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const row = { servidor_id, unidade_id, papel: cargo, ano, ingresso, fim,
    funcao: temFuncao(cargo) ? funcaoValida(funcao) : null };
  const { data, error } = await _gravarComFuncao(row,
    (r) => sb().from('vinculo').insert(r).select().single());
  if (error) {
    if (error.code === '23505') throw amigavel(DUPLICADO, error.code);
    throw error;
  }
  invalidar();
  return data;
}

export async function atualizarVinculo(id, { unidade_id, papel, ingresso = null, fim = null, funcao }) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const cargo = papelParaGravar(await cargoCanonico(papel));
  if (!cargo) throw new Error('Informe o cargo/função.');
  const ano = ingresso ? Number(String(ingresso).slice(0, 4)) : new Date().getFullYear();
  const patch = { unidade_id, papel: cargo, ano, ingresso, fim };
  // Fora do cargo de gestor a função é sempre nula (o CHECK exige). No de
  // gestor, `funcao` omitida deixa a gravada como está; informada - mesmo
  // null - é gravada.
  if (!temFuncao(cargo)) patch.funcao = null;
  else if (funcao !== undefined) patch.funcao = funcaoValida(funcao);
  const { error } = await _gravarComFuncao(patch,
    (p) => sb().from('vinculo').update(p).eq('id', id));
  if (error) {
    if (error.code === '23505') throw amigavel(DUPLICADO, error.code);
    throw error;
  }
  invalidar();
}

// Troca de função COM data (spec 2026-10-03, D12): o período atual termina
// na véspera e outro começa, com a função nova - é assim que fica o
// histórico de quem foi Gestor 2 e passou a Gestor 1 na mesma escola.
// Mora no banco (função mudar_funcao_gestor) porque são duas escritas que
// só valem juntas: do navegador, a falha da segunda deixaria a pessoa sem
// local de trabalho atual. Aqui ficam só as guardas de UX (o banco repete
// todas, R15) e a tradução dos erros. `servidorId` não é usado no corpo - o
// banco o lê do vínculo -, mas fica na assinatura por contrato com a view.
export async function mudarFuncao(servidorId, vinculo, funcao, desde) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const nova = funcaoValida(funcao);
  if (!nova) throw amigavel('Escolha Gestor 1 ou Gestor 2.');
  if (!desde) throw amigavel('Informe a partir de quando a função mudou.');
  if (vinculo.fim) throw amigavel('Este local de trabalho já está encerrado.');
  if (!temFuncao(vinculo.papel)) throw amigavel('Só o cargo de gestor tem função.');
  if (vinculo.funcao === nova) throw amigavel('A função já é essa.');
  if (desde > hojeISO()) throw amigavel('A mudança não pode ter data futura.');
  if (vinculo.ingresso && desde <= vinculo.ingresso) {
    throw amigavel('A mudança precisa ser depois do início deste local de trabalho.');
  }
  const { data, error } = await sb().rpc('mudar_funcao_gestor',
    { p_vinculo: vinculo.id, p_funcao: nova, p_desde: desde });
  if (error) throw traduzirMudanca(error);
  invalidar();
  return data;
}

// Erros da função do banco → texto para a tela. P0001/P0002 são os que ela
// levanta de propósito, reconhecidos pelo início da mensagem.
const MENSAGENS_MUDANCA = [
  ['Local de trabalho nao encontrado', 'Este local de trabalho não foi encontrado. Atualize a tela.'],
  ['Local de trabalho ja encerrado', 'Este local de trabalho já está encerrado.'],
  ['Funcao so existe', 'Só o cargo de gestor tem função.'],
  ['Funcao invalida', 'Escolha Gestor 1 ou Gestor 2.'],
  ['Funcao igual', 'A função já é essa.'],
  ['Data da mudanca obrigatoria', 'Informe a partir de quando a função mudou.'],
  ['Data da mudanca no futuro', 'A mudança não pode ter data futura.'],
  ['Data da mudanca antes', 'A mudança precisa ser depois do início deste local de trabalho.'],
];
function traduzirMudanca(error) {
  if (error.code === 'PGRST202' || error.code === '42883') return amigavel(SEM_A_045, error.code);
  if (error.code === '23505') return amigavel(DUPLICADO, error.code);
  if (error.code === 'P0001' || error.code === 'P0002') {
    const msg = String(error.message || '');
    const achou = MENSAGENS_MUDANCA.find(([inicio]) => msg.startsWith(inicio));
    return amigavel(achou ? achou[1] : 'Não foi possível registrar a mudança de função.', error.code);
  }
  return error;
}

// Encerrar ≠ excluir: o vínculo passado é histórico e deve ser
// preservado. A tela oferece as duas coisas, com botões diferentes.
export async function excluirVinculo(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('vinculo').delete().eq('id', id);
  if (error) throw error;
  invalidar();
}
