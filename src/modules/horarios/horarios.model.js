// ============================================================
// FundHub — modules/horarios/horarios.model.js
// Jornada da equipe gestora. Um dia é um conjunto de BLOCOS, não um
// par entrada/saída — é isso que permite representar a regra das 6h
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

const INI = paraMin(COBERTURA_INICIO);   // 420
const FIM = paraMin(COBERTURA_FIM);      // 1100

// ── Acesso a dados ───────────────────────────────────────────
const SEL = '*, servidor:servidor(id, nome, apelido)';

export async function getBlocos(unidadeId, ano) {
  if (!hasSupabase() || !unidadeId) return [];
  const { data, error } = await sb().from('horario_bloco')
    .select(SEL)
    .eq('unidade_id', unidadeId).eq('ano', ano)
    .order('dia_semana').order('inicio');
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
function unir(intervalos) {
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

// Problemas da jornada de UM servidor em UM dia.
// Devolve [] quando está tudo certo.
export function validarDia(blocosDoDia) {
  const problemas = [];
  if (!blocosDoDia.length) return problemas;

  const ivs = blocosDoDia.map(paraIntervalo).sort((a, b) => a.ini - b.ini);

  // Sobreposição (erro: a pessoa não pode estar em dois lugares).
  for (let i = 1; i < ivs.length; i++) {
    if (ivs[i].ini < ivs[i - 1].fim) {
      problemas.push({
        nivel: 'erro',
        texto: `Blocos sobrepostos (${paraHora(ivs[i].ini)} começa antes de ${paraHora(ivs[i - 1].fim)}).`,
      });
      break;
    }
  }

  // Carga do dia.
  const total = ivs.reduce((s, iv) => s + (iv.fim - iv.ini), 0);
  if (total > MAX_DIA_MIN) {
    problemas.push({
      nivel: 'erro',
      texto: `${duracao(total)} no dia — o limite é ${duracao(MAX_DIA_MIN)}.`,
    });
  }

  // Trecho contínuo (blocos colados contam junto).
  const maior = unir(ivs).reduce((m, iv) => Math.max(m, iv.fim - iv.ini), 0);
  if (maior > MAX_CONTINUO_MIN) {
    problemas.push({
      nivel: 'aviso',
      texto: `${duracao(maior)} contínuas — o limite é ${duracao(MAX_CONTINUO_MIN)}. Inclua um intervalo.`,
    });
  }

  return problemas;
}

export const totalDoDia = (blocosDoDia) =>
  blocosDoDia.reduce((s, b) => s + (paraMin(b.fim) - paraMin(b.inicio)), 0);

// Lacunas na cobertura da UNIDADE num dia: os trechos de 7h00–18h20
// em que nenhum servidor está presente. Devolve [{ ini, fim }] em minutos.
export function lacunasCobertura(blocosDoDiaDaUnidade) {
  const cobertos = unir(blocosDoDiaDaUnidade.map(paraIntervalo))
    .filter(iv => iv.fim > INI && iv.ini < FIM);   // só o que toca a janela

  const lacunas = [];
  let cursor = INI;
  for (const iv of cobertos) {
    if (iv.ini > cursor) lacunas.push({ ini: cursor, fim: Math.min(iv.ini, FIM) });
    cursor = Math.max(cursor, iv.fim);
    if (cursor >= FIM) break;
  }
  if (cursor < FIM) lacunas.push({ ini: cursor, fim: FIM });
  return lacunas;
}

// Posição de um bloco na barra gráfica, em % da janela 7h00–18h20.
// Blocos fora da janela são recortados para não vazarem da barra.
export function posicaoNaBarra(bloco) {
  const janela = FIM - INI;
  const ini = Math.max(paraMin(bloco.inicio), INI);
  const fim = Math.min(paraMin(bloco.fim), FIM);
  return {
    esquerda: ((ini - INI) / janela) * 100,
    largura: (Math.max(fim - ini, 0) / janela) * 100,
    forade: paraMin(bloco.inicio) < INI || paraMin(bloco.fim) > FIM,
  };
}

// Marcas de hora cheia para o eixo da barra.
export function marcasDaBarra() {
  const janela = FIM - INI;
  const marcas = [];
  for (let m = Math.ceil(INI / 60) * 60; m <= FIM; m += 60) {
    marcas.push({ hora: paraHora(m), pos: ((m - INI) / janela) * 100 });
  }
  return marcas;
}
