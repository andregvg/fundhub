// ============================================================
// FundHub - modules/horarios/escalas.model.js
// Quarto model público do módulo horarios: "que dia é hoje e quais
// blocos valem" - resolução de escala e de jornada numa data. Concern
// distinto de horario_bloco (horarios.model.js), da matemática pura
// de grade (grade.model.js) e de quem aparece na tela (exibicao.model.js).
//
// ESCALA é o nome de um dia. O horário não é escrito contra datas, é
// escrito contra nomes de dia - e o calendário diz, para cada data
// real, qual nome ela tem. Foi essa inversão que tornou o TDC com
// revezamento uma consulta em vez de uma inferência: "em que fase
// estamos?" não se calcula, se consulta.
//
// Nasceu como parte de horarios.model.js e foi extraído aqui porque
// o arquivo original passaria de 250 linhas (R11) com as ~90 linhas
// destas funções - não por acoplamento com o resto do módulo. Zero
// import cruzado com horarios.model.js/grade.model.js/exibicao.model.js
// nos dois sentidos. HÁ, sim, import de calendario/calendario.model.js
// (getEscalaDoDia reusa a leitura de lá) - module-to-module é
// permitido pela R2, e não fecha ciclo: calendario.model.js não
// importa nada de horarios/.
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';
import { registrarCache } from '../../shared/cache.js';
import { getEscalasRede, getEscalasUnidade } from '../calendario/calendario.model.js';

// Fallback SEM banco (teste puro, tela que ainda não carregou o
// catálogo). A fonte de verdade é getEscalas(), que lê escala_tipo -
// o admin pode renomear o rótulo ou acrescentar uma chave nova sem
// tocar em código, porque o formato de TDC muda a cada calendário
// escolar.
export const ESCALAS_PADRAO = [
  { chave: 'normal', rotulo: 'Normal' },
  { chave: 'tdc-presencial', rotulo: 'TDC Presencial' },
  { chave: 'tdc-virtual',    rotulo: 'TDC Virtual' },
];

// PURA de propósito: recebe o catálogo já carregado. Sem ele, usa o
// padrão - e por isso os testes deste arquivo não precisam de banco
// nenhum para continuar valendo.
export function rotulaEscala(chave, catalogo = ESCALAS_PADRAO) {
  // O default só dispara em `undefined`; `catalogo` explicitamente
  // `null` (o padrão comum de "ainda não carreguei do banco") passa
  // direto - por isso o `|| ESCALAS_PADRAO` aqui também.
  return (catalogo || ESCALAS_PADRAO).find(e => e.chave === chave)?.rotulo || String(chave ?? '');
}

let _escalas = null;
export function limparCacheEscalas() { _escalas = null; }
registrarCache(limparCacheEscalas);

// O catálogo de verdade. Degrada para ESCALAS_PADRAO sem a migration
// 025 (42P01) - a tela continua funcionando com os três nomes de
// sempre, só não deixa renomear até a migration rodar.
export async function getEscalas() {
  if (_escalas) return _escalas;
  // Cópia, nunca a referência: um consumidor que ordenar o resultado
  // (comum ao montar um <select>) não pode corromper a constante do
  // módulo pelo resto da sessão do navegador.
  if (!hasSupabase()) { _escalas = [...ESCALAS_PADRAO]; return _escalas; }
  const { data, error } = await sb().from('escala_tipo')
    .select('chave, rotulo, ordem').order('ordem');
  if (error) {
    if (error.code === '42P01') { _escalas = [...ESCALAS_PADRAO]; return _escalas; }
    throw error;
  }
  _escalas = data?.length ? data : [...ESCALAS_PADRAO];
  return _escalas;
}

// Rótulo e ordem são editáveis; a CHAVE, não - é o que já está
// gravado em horario_bloco.escala/dia_calendario.escala, sem FK e
// sem cascata que renomeie isso. Criar uma chave nova (uma terceira
// variante de TDC, por exemplo) é só uma linha nova - upsert cobre
// os dois casos.
export async function definirEscalaTipo(chave, { rotulo, ordem } = {}) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  if (!rotulo?.trim()) throw new Error('Informe o rótulo.');
  const row = { chave, rotulo: rotulo.trim(), criado_por: await emailAtual() };
  if (ordem !== undefined) row.ordem = ordem;
  const { error } = await sb().from('escala_tipo').upsert(row, { onConflict: 'chave' });
  if (error) throw error;
  _escalas = null;                          // escreveu, invalidou
}

// Três estados, e a diferença entre os dois últimos é o motivo de
// escala_unidade existir:
//   sem linha             → a escola segue o calendário da rede;
//   linha com escala      → a escola remarcou;
//   linha com escala nula → a escola CANCELOU (aqui não há TDC nesta data).
export function resolverEscala({ rede, override } = {}) {
  if (override !== undefined && override !== null) return override.escala || 'normal';
  return rede || 'normal';
}

// Blocos daquela escala. Sem nenhum, cai nos 'normal' - é o fallback
// que faz quem não tem jornada alternativa não precisar de registro
// nenhum. 'normal' nunca cai em outra coisa: seria circular.
export function escolherBlocos(blocos, escala) {
  const lista = blocos || [];
  const daEscala = lista.filter(b => (b.escala || 'normal') === escala);
  if (daEscala.length || escala === 'normal') return daEscala;
  return lista.filter(b => (b.escala || 'normal') === 'normal');
}

// 0=domingo … 6=sábado. O '+ T00:00:00' é obrigatório: sem ele o JS
// lê a string como UTC e no Brasil o dia volta um.
export function diaDaSemana(iso) {
  return new Date(String(iso) + 'T00:00:00').getDay();
}

// A jornada de uma data: o dia da semana filtra, a escala escolhe.
export function jornadaEm(blocos, { escala, dataISO }) {
  const dow = diaDaSemana(dataISO);
  if (dow < 1 || dow > 5) return [];              // fim de semana não tem jornada
  return escolherBlocos((blocos || []).filter(b => b.dia_semana === dow), escala);
}

// A escala de uma data para uma unidade: o override da escola vence o
// calendário da rede. Delega a leitura a calendario.model.js (dono das
// tabelas dia_calendario/escala_unidade) em vez de repetir a query e
// a política de degradação aqui.
export async function getEscalaDoDia(unidadeId, dataISO) {
  if (!dataISO) return 'normal';
  const [rede, over] = await Promise.all([
    getEscalasRede(dataISO, dataISO),
    unidadeId ? getEscalasUnidade(unidadeId, dataISO, dataISO) : Promise.resolve([]),
  ]);
  // over.length (não over[0]) distingue "sem linha" (segue a rede) de
  // "linha com escala nula" (a escola cancelou) - getEscalasUnidade não
  // filtra por escala not null, então a linha nula continua no array.
  return resolverEscala({
    rede: rede[0]?.escala ?? null,
    override: over.length ? { escala: over[0].escala } : undefined,
  });
}
