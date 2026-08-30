// ============================================================
// FundHub - modules/horarios/grade.model.js
// Segundo model público do módulo horarios (mesmo padrão de
// sate/atividades.model.js): a matemática de BARRA, FAIXA e ORDEM que
// a grade usa para desenhar - onde cada bloco fica na régua horária,
// em que faixa horizontal ele empilha, quais lacunas de cobertura a
// escola tem no dia e quem aparece na grade, em que ordem e cor.
// ============================================================
import { paraMin, paraHora, COBERTURA_INICIO, COBERTURA_FIM, unir } from './horarios.model.js';

const INI = paraMin(COBERTURA_INICIO);   // 420
const FIM = paraMin(COBERTURA_FIM);      // 1100

const paraIntervalo = (b) => ({ ini: paraMin(b.inicio), fim: paraMin(b.fim) });

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

// Distribui os blocos de UM dia em faixas horizontais: cada bloco vai
// para a primeira faixa que já esteja livre naquele horário. Sem isso
// um bloco cobre o outro e a grade mente sobre quem está presente.
//
// Blocos encostados (fim == início) dividem a mesma faixa: não há
// conflito visual entre eles.
export function empilhar(blocos) {
  const ord = [...(blocos || [])]
    .map(b => ({ bloco: b, ini: paraMin(b.inicio), fim: paraMin(b.fim) }))
    .sort((a, b) => a.ini - b.ini || a.fim - b.fim);

  const fimDaFaixa = [];          // fimDaFaixa[i] = onde a faixa i está livre
  const out = [];
  for (const item of ord) {
    let faixa = fimDaFaixa.findIndex(f => f <= item.ini);
    if (faixa === -1) { faixa = fimDaFaixa.length; fimDaFaixa.push(0); }
    fimDaFaixa[faixa] = item.fim;
    out.push({ bloco: item.bloco, faixa });
  }
  return out;
}

// Quantas faixas a linha daquele dia precisa. Nunca menos de 1: a
// linha de um dia sem jornada ainda precisa de altura para dizer isso.
export const contarFaixas = (blocos) =>
  Math.max(1, empilhar(blocos).reduce((m, x) => Math.max(m, x.faixa + 1), 0));

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

// ── Grade: ordenação de servidores ──────────────────────────
export const SERIES = 6;   // quantidade de cores da paleta (tokens --serie-1..6)

// Quem aparece na grade, em que ordem, com que cor e contando ou não
// na cobertura.
//
// Sem linha em horario_exibicao vale o padrão: aparece se o cargo for
// de gestão, conta na cobertura, ordenado por cargo e depois por nome.
// Quem tem linha aparece de qualquer jeito - foi decisão de alguém.
export function ordenarParaGrade(servidores, { exibicao = [], cargosGestao = new Set(), cargoDe }) {
  const porId = new Map((exibicao || []).map(e => [e.servidor_id, e]));

  const itens = (servidores || []).map(servidor => {
    const cfg = porId.get(servidor.id);
    const cargo = cargoDe(servidor) || '';
    return {
      servidor,
      cargo,
      exibir: Boolean(cfg) || cargosGestao.has(cargo),
      contaCobertura: cfg ? cfg.conta_cobertura : true,
      ordem: cfg ? cfg.ordem : null,
    };
  });

  itens.sort((a, b) => {
    if (a.ordem !== null && b.ordem !== null) {
      return (a.ordem - b.ordem)
        || a.cargo.localeCompare(b.cargo, 'pt')
        || a.servidor.nome.localeCompare(b.servidor.nome, 'pt');
    }
    if (a.ordem !== null) return -1;
    if (b.ordem !== null) return 1;
    return a.cargo.localeCompare(b.cargo, 'pt')
      || a.servidor.nome.localeCompare(b.servidor.nome, 'pt');
  });

  // A série conta só sobre quem é EXIBIDO - quem fica de fora da grade
  // não deve consumir uma cor que a linha seguinte visível precisaria.
  let serie = 0;
  return itens.map(it => ({ ...it, serie: it.exibir ? (serie++) % SERIES : null }));
}
