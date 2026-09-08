// ============================================================
// FundHub - modules/auditoria/auditoria.model.js
// Leitura do audit_log - o que MUDOU no dado. A tabela é preenchida
// pelo trigger fn_audit() no Postgres (migration 011) e, desde a 032,
// o trigger cobre toda tabela de `public` que não esteja em
// _audit_isentas(). Só admin lê, pelo RLS.
//
// A tela NUNCA escreve aqui: auditoria que se apaga não é auditoria.
// A única remoção possível é a poda por data (podar_logs), e ela mora
// em auditoria.config.js, à vista do admin.
// ============================================================
import { sb, hasSupabase } from '../../core/supabase.js';

// Rótulos amigáveis das tabelas auditadas: é o que aparece no filtro e
// na lista, no lugar do nome cru da tabela.
//
// A checagem 13 do verificador cobra (com aviso) toda tabela auditada
// que não tenha rótulo aqui - sem isso a aba mostraria `papel_permissao`
// para um usuário que não faz ideia do que é isso.
export const TABELAS = {
  // cadastros núcleo
  unidade_escolar: 'Escolas',
  regional: 'Regionais',
  servidor: 'Servidores',
  vinculo: 'Locais de trabalho',
  telefone: 'Telefones',
  local: 'Locais',
  // acesso e permissão
  perfil: 'Usuários & Acessos',
  papel: 'Papéis',
  papel_permissao: 'Permissões por papel',
  // SATE / transporte
  atividade_extraclasse: 'Atividades (SATE)',
  solicitacao_transporte: 'Solicitações (SATE)',
  solicitacao_participacao: 'Escolas na viagem (SATE)',
  // Nome anterior da mesma tabela, renomeada na 037. O rótulo fica para
  // o histórico anterior à renomeação não aparecer com o nome cru.
  solicitacao_embarque: 'Pontos de embarque (SATE)',
  frota: 'Frota (SATE)',
  frota_rotulo: 'Rótulos de frota (SATE)',
  // `oferta_onibus` foi aposentada pela migration 035, mas a tabela
  // continua no banco com o histórico dela - e o audit_log guarda as
  // alterações antigas. Sem este rótulo, o passado apareceria com o nome
  // cru na aba Mudanças.
  oferta_onibus: 'Frota, modelo antigo (SATE)',
  // rotina da gerência
  dia_calendario: 'Calendário',
  afastamento: 'Afastamentos',
  ocorrencia: 'Ocorrências',
  relatorio_visita: 'Visitas',
  ata_atendimento: 'Atas',
  projeto: 'Projetos',
  projeto_interesse: 'Interesse em projetos',
  // horários
  horario_bloco: 'Horários',
  escala_unidade: 'Escalas',
  escala_tipo: 'Tipos de escala',
  cargo_gestao: 'Cargos de gestão',
  horario_exibicao: 'Exibição de horários',
  // configuração
  config_modulo: 'Configurações',
};

export const OPERACOES = { INSERT: 'Criação', UPDATE: 'Alteração', DELETE: 'Exclusão' };

// Rótulos legíveis de alguns campos que aparecem no diff. Best-effort:
// campo sem rótulo aparece com o nome cru, que é melhor que sumir.
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
  processo: 'Processo', permissoes: 'Exceções de permissão', segmentos: 'Segmentos',
  nivel: 'Nível', modulo: 'Módulo', chave: 'Chave', descricao: 'Descrição',
  ordem: 'Ordem', variante: 'Variante', conduz: 'Conduz', cargo: 'Cargo',
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
// Texto puro, nunca HTML: quem chama sempre passa o retorno por esc(),
// por isso o vazio aqui não usa o helper vazio() de shared/dom.js.
export function mostrarValor(v) {
  if (v === null || v === undefined) return 'vazio';
  if (v === true) return 'sim';
  if (v === false) return 'não';
  if (Array.isArray(v)) return v.join(', ') || 'vazio';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
