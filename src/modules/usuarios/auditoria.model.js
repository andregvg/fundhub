// ============================================================
// FundHub — modules/usuarios/auditoria.model.js
// Leitura do audit_log (preenchido pelo trigger fn_audit no banco —
// ver migration 011). Só admin lê, pelo RLS. A tela nunca escreve
// aqui: auditoria que se apaga não é auditoria.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

// Rótulos amigáveis das tabelas auditadas (para o filtro e a lista).
export const TABELAS = {
  unidade_escolar: 'Escolas',
  regional: 'Regionais',
  servidor: 'Servidores',
  vinculo: 'Vínculos',
  perfil: 'Usuários & Acessos',
  atividade_extraclasse: 'Atividades (SATE)',
  solicitacao_transporte: 'Solicitações (SATE)',
  oferta_onibus: 'Frota (SATE)',
  dia_calendario: 'Calendário',
  afastamento: 'Afastamentos',
  horario_bloco: 'Horários',
  ocorrencia: 'Ocorrências',
  telefone: 'Telefones',
  local: 'Locais',
};

export const OPERACOES = { INSERT: 'Criação', UPDATE: 'Alteração', DELETE: 'Exclusão' };

// Rótulos legíveis de alguns campos que aparecem no diff.
export const CAMPO_ROTULO = {
  nome: 'Nome', apelido: 'Apelido', nome_oficial: 'Nome oficial', email: 'E-mail',
  telefone: 'Telefone', telefones: 'Telefones', numero: 'Número', rotulo: 'Rótulo',
  principal: 'Principal', endereco: 'Endereço', segmento: 'Segmento',
  oferta: 'Oferta', papel: 'Papel', ativo: 'Ativo', status: 'Status', data: 'Data',
  periodo: 'Período', inicio: 'Início', fim: 'Fim', tipo: 'Tipo', evento: 'Evento',
  assunto: 'Assunto', motivo: 'Motivo', relato: 'Relato', obs: 'Observação',
  observacao: 'Observação', canal: 'Canal', solicitante: 'Solicitante',
  tem_transporte: 'Transporte', tem_eja: 'EJA', inep: 'INEP', cor: 'Cor',
  qtd_alunos: 'Nº de alunos', qtd_onibus: 'Nº de ônibus', qtd_cadeirante: 'Nº de cadeirantes',
  letivo: 'Dia letivo', bloqueia_extraclasse: 'Bloqueia extraclasse',
  bloqueia_afastamento: 'Bloqueia afastamento', dia_semana: 'Dia da semana',
  unidade_id: 'Escola', servidor_id: 'Servidor', usa_onibus: 'Usa ônibus',
  local_id: 'Local', desembarque: 'Desembarque', destino_nome: 'Destino',
  destino_endereco: 'Endereço do destino', latitude: 'Latitude', longitude: 'Longitude',
  encaminhamentos: 'Encaminhamentos', constatacoes: 'Constatações', pauta: 'Pauta',
  deliberacoes: 'Deliberações', participantes: 'Participantes', prazo: 'Prazo',
};
export const rotulaCampo = (k) => CAMPO_ROTULO[k] || k;

export async function getAuditoria({ tabela, operacao, autor, de, ate, limit = 200 } = {}) {
  if (!hasSupabase()) return [];
  let q = sb().from('audit_log').select('*').order('criado_em', { ascending: false }).limit(limit);
  if (tabela) q = q.eq('tabela', tabela);
  if (operacao) q = q.eq('operacao', operacao);
  if (autor) q = q.ilike('autor', `%${autor}%`);
  if (de) q = q.gte('criado_em', de + 'T00:00:00');
  if (ate) q = q.lte('criado_em', ate + 'T23:59:59');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Descreve o valor de um campo do jsonb para exibição (booleanos, nulos, etc).
export function mostrarValor(v) {
  if (v === null || v === undefined) return '—';
  if (v === true) return 'sim';
  if (v === false) return 'não';
  if (Array.isArray(v)) return v.join(', ') || '—';
  return String(v);
}
