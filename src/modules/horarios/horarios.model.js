// ============================================================
// FundHub - modules/horarios/horarios.model.js
// Jornada da equipe gestora. Um dia é um conjunto de BLOCOS, não um
// par entrada/saída - é isso que permite representar a regra das 6h
// contínuas (quem cumpre 8h precisa partir a jornada).
//
// As REGRAS moram aqui, não na tela:
//   • ≤ 8h por dia, por servidor
//   • ≤ 6h contínuas (blocos encostados contam como um trecho só)
//   • sem sobreposição de blocos do mesmo servidor no mesmo dia
//   • a unidade precisa estar coberta das 7h00 às 18h20
// ============================================================
import { sb, hasSupabase, emailAtual } from '../../core/supabase.js';

export const DIAS = [
  { n: 1, nome: 'Segunda', curto: 'Seg' },
  { n: 2, nome: 'Terça',   curto: 'Ter' },
  { n: 3, nome: 'Quarta',  curto: 'Qua' },
  { n: 4, nome: 'Quinta',  curto: 'Qui' },
  { n: 5, nome: 'Sexta',   curto: 'Sex' },
];

export const COBERTURA_INICIO = '07:00';
export const COBERTURA_FIM = '18:20';

export const MAX_DIA_MIN = 8 * 60;        // 8h por dia
export const MAX_CONTINUO_MIN = 6 * 60;   // 6h contínuas

// '07:30' | '07:30:00' → 450 minutos desde a meia-noite.
export const paraMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
};

// 450 → '07:30'
export const paraHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// 450 → '7h30' | 480 → '8h'  (para os rótulos de duração)
export const duracao = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

// ── Acesso a dados ───────────────────────────────────────────
const SEL = '*, servidor:servidor(id, nome, apelido)';

// O ano saiu da interface junto com o do vínculo: o que se vê é a
// jornada VIGENTE. A coluna continua no banco como carimbo.
export async function getBlocos(unidadeId) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_bloco')
    .select(SEL).eq('unidade_id', unidadeId)
    .order('dia_semana').order('inicio');
  if (error) throw error;
  return data || [];
}

// A jornada de UMA pessoa, em todos os locais onde ela tem bloco.
export async function getBlocosDoServidor(servidorId) {
  if (!hasSupabase() || !servidorId) return [];
  const { data, error } = await sb().from('horario_bloco')
    .select(`${SEL}, unidade:unidade_escolar(id, nome, apelido)`)
    .eq('servidor_id', servidorId)
    .order('unidade_id').order('dia_semana').order('inicio');
  if (error) throw error;
  return data || [];
}

export async function criarBloco(payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const row = { ...payload, criado_por: await emailAtual() };
  const { data, error } = await sb().from('horario_bloco').insert(row).select(SEL).single();
  if (error) throw error;
  return data;
}

export async function atualizarBloco(id, payload) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('horario_bloco').update(payload).eq('id', id);
  if (error) throw error;
}

export async function excluirBloco(id) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('horario_bloco').delete().eq('id', id);
  if (error) throw error;
}

// ── Regras ───────────────────────────────────────────────────
// Une intervalos que se sobrepõem OU que se encostam (fim == início):
// dois blocos colados são, na prática, um trecho contínuo de trabalho.
// Exportada: grade.model.js reaproveita para lacunasCobertura.
export function unir(intervalos) {
  const ord = [...intervalos].sort((a, b) => a.ini - b.ini);
  const out = [];
  for (const iv of ord) {
    const ultimo = out[out.length - 1];
    if (ultimo && iv.ini <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, iv.fim);
    else out.push({ ini: iv.ini, fim: iv.fim });
  }
  return out;
}

const paraIntervalo = (b) => ({ ini: paraMin(b.inicio), fim: paraMin(b.fim) });

// Problemas da jornada de UM servidor em UM dia, cada um com o
// INTERVALO em que ele acontece - para a grade poder marcar onde
// está o problema em vez de só escrever o que ele é.
// Devolve [] quando está tudo certo.
//
// Só a sobreposição barra o salvamento: ela descreve algo impossível
// (a pessoa em dois lugares). Carga e trecho contínuo descrevem algo
// indesejável mas às vezes necessário, e a SME precisa poder
// registrar. Ver .claude/rules/dados.md - "erro barra, aviso não".
export function validarDia(blocosDoDia) {
  const problemas = [];
  if (!blocosDoDia?.length) return problemas;

  const ivs = blocosDoDia.map(paraIntervalo).sort((a, b) => a.ini - b.ini);

  // ── Sobreposição (erro) ──
  for (let i = 1; i < ivs.length; i++) {
    if (ivs[i].ini < ivs[i - 1].fim) {
      const ini = ivs[i].ini;
      const fim = Math.min(ivs[i - 1].fim, ivs[i].fim);
      problemas.push({
        nivel: 'erro', codigo: 'sobreposicao', ini, fim,
        texto: `Blocos sobrepostos entre ${paraHora(ini)} e ${paraHora(fim)}.`,
      });
      break;
    }
  }

  const unidos = unir(ivs);

  // ── Carga do dia (aviso) ──
  // Medida sobre os trechos UNIDOS, não sobre a soma dos blocos: uma hora
  // em que a pessoa aparece em dois blocos ao mesmo tempo é uma hora, não
  // duas. A grade desenha dado já gravado, então sobreposição chega aqui
  // sem ninguém ter barrado nada - e somar bruto inflaria o aviso.
  const total = unidos.reduce((s, iv) => s + (iv.fim - iv.ini), 0);
  if (total > MAX_DIA_MIN) {
    const excesso = total - MAX_DIA_MIN;
    const trecho = ultimosMinutos(unidos, excesso);
    problemas.push({
      nivel: 'aviso', codigo: 'carga-dia', ini: trecho.ini, fim: trecho.fim,
      texto: `${duracao(total)} no dia - ${duracao(excesso)} além do limite de ${duracao(MAX_DIA_MIN)}.`,
    });
  }

  // ── Trecho contínuo (aviso; blocos colados contam junto) ──
  for (const trecho of unidos) {
    if (trecho.fim - trecho.ini > MAX_CONTINUO_MIN) {
      problemas.push({
        nivel: 'aviso', codigo: 'continuo',
        ini: trecho.ini + MAX_CONTINUO_MIN, fim: trecho.fim,
        texto: `${duracao(trecho.fim - trecho.ini)} contínuas a partir de ${paraHora(trecho.ini)} - o limite é ${duracao(MAX_CONTINUO_MIN)}. Inclua um intervalo.`,
      });
      break;
    }
  }

  return problemas;
}

// Os últimos `minutos` de tempo TRABALHADO, caminhando de trás para
// frente pelos trechos unidos. O intervalo devolvido pode atravessar
// uma pausa: se o excesso é maior que o último trecho, ele continua
// no anterior - e a marcação na grade cobre os dois.
function ultimosMinutos(unidos, minutos) {
  const fim = unidos[unidos.length - 1].fim;
  let ini = fim;
  let faltam = minutos;
  for (let i = unidos.length - 1; i >= 0 && faltam > 0; i--) {
    const dura = unidos[i].fim - unidos[i].ini;
    if (dura >= faltam) { ini = unidos[i].fim - faltam; faltam = 0; }
    else { ini = unidos[i].ini; faltam -= dura; }
  }
  return { ini, fim };
}

export const totalDoDia = (blocosDoDia) =>
  blocosDoDia.reduce((s, b) => s + (paraMin(b.fim) - paraMin(b.inicio)), 0);

// ── Exibição e cobertura por escola ──────────────────────────
// Sem linha = padrão (exibe se for cargo de gestão, conta na
// cobertura, ordem alfabética). Ver ordenarParaGrade.
export async function getExibicao(unidadeId) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_exibicao')
    .select('servidor_id, ordem, conta_cobertura')
    .eq('unidade_id', unidadeId).order('ordem');
  if (error) {
    if (error.code === '42P01') return [];      // migration 024 ainda não rodou
    throw error;
  }
  return data || [];
}

// Grava a ordem inteira de uma vez. As duas armadilhas do upsert em
// lote do PostgREST valem aqui: todas as linhas precisam ter as
// MESMAS chaves (nada de `undefined`, que some do JSON e quebra o
// lote), e onConflict só infere índice único simples.
export async function salvarOrdem(unidadeId, servidorIds) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const cobertura = new Map(atual.map(e => [e.servidor_id, e.conta_cobertura]));
  const quem = await emailAtual();
  const rows = servidorIds.map((servidor_id, ordem) => ({
    unidade_id: unidadeId,
    servidor_id,
    ordem,
    conta_cobertura: cobertura.has(servidor_id) ? cobertura.get(servidor_id) : true,
    atualizado_por: quem,
  }));
  if (!rows.length) return;
  const { error } = await sb().from('horario_exibicao')
    .upsert(rows, { onConflict: 'unidade_id,servidor_id' });
  if (error) throw error;
}

export async function definirCobertura(unidadeId, servidorId, conta) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const atual = await getExibicao(unidadeId);
  const linha = atual.find(e => e.servidor_id === servidorId);
  const row = {
    unidade_id: unidadeId,
    servidor_id: servidorId,
    ordem: linha ? linha.ordem : atual.length,
    conta_cobertura: Boolean(conta),
    atualizado_por: await emailAtual(),
  };
  const { error } = await sb().from('horario_exibicao')
    .upsert(row, { onConflict: 'unidade_id,servidor_id' });
  if (error) throw error;
}

// "Voltar à ordem padrão": apaga as linhas da unidade e a grade
// recai no alfabético por cargo e nome.
export async function limparExibicao(unidadeId) {
  if (!hasSupabase()) throw new Error('Sem conexão com o banco.');
  const { error } = await sb().from('horario_exibicao').delete().eq('unidade_id', unidadeId);
  if (error) throw error;
}
