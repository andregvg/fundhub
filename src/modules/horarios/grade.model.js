// ============================================================
// FundHub - modules/horarios/grade.model.js
// Segundo model público do módulo horarios (mesmo padrão de
// sate/atividades.model.js): a matemática de BARRA e FAIXA que a
// grade usa para desenhar - onde cada bloco fica na régua horária e
// em que faixa horizontal ele empilha quando se sobrepõe a outro.
// ============================================================
import { paraMin, paraHora, COBERTURA_INICIO, COBERTURA_FIM } from './horarios.model.js';

const INI = paraMin(COBERTURA_INICIO);   // 420
const FIM = paraMin(COBERTURA_FIM);      // 1100

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
