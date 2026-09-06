// ============================================================
// FundHub - modules/horarios/grade.model.js
// Segundo model público do módulo horarios (mesmo padrão de
// sate/atividades.model.js): a matemática de BARRA, FAIXA e ORDEM que
// a grade usa para desenhar - onde cada bloco fica na régua horária,
// em que faixa horizontal ele empilha, quais lacunas de cobertura a
// escola tem no dia e quem aparece na grade, em que ordem e cor.
// ============================================================
import { paraMin, paraHora, COBERTURA_INICIO, COBERTURA_FIM, unir } from './horarios.model.js';

// Janela de FÁBRICA: o padrão quando a Gerência não configurou uma
// janela para o tipo daquela escola. As três funções abaixo recebem a
// janela como parâmetro (a view a deriva da unidade - ver
// horarios.config.js) e continuam PURAS.
export const JANELA_FABRICA = { ini: paraMin(COBERTURA_INICIO), fim: paraMin(COBERTURA_FIM) };

const paraIntervalo = (b) => ({ ini: paraMin(b.inicio), fim: paraMin(b.fim) });

// Posição de um bloco na barra gráfica, em % da régua.
//
// O recorte continua, como rede de segurança para quem passar uma
// janela não esticada - mas com `janelaDaGrade` ele não deve acontecer
// mais. A flag `forade` saiu: ela era calculada, nenhuma view a lia, e
// o trecho fora da janela sumia da tela em silêncio (D9).
export function posicaoNaBarra(bloco, { ini, fim } = JANELA_FABRICA) {
  const janela = fim - ini;
  const i = Math.max(paraMin(bloco.inicio), ini);
  const f = Math.min(paraMin(bloco.fim), fim);
  return {
    esquerda: ((i - ini) / janela) * 100,
    largura: (Math.max(f - i, 0) / janela) * 100,
  };
}

// A RÉGUA da grade: a janela de cobertura esticada para caber tudo que
// a grade desenha. Em dia de TDC o horário de quem conduz vai muito
// além do fim da janela (uma EMEF fecha 18:20 e o TDC vai a 20h10),
// e antes disso a barra era recortada sem aviso.
//
// UMA régua por grade, nunca uma por dia: dias com réguas diferentes
// deixam de ser comparáveis, que é o motivo de a grade existir.
//
// Recebe os blocos JÁ RESOLVIDOS pelo fallback de D4, não o retorno cru
// de getBlocos - um bloco herdado esticaria a régua num dia em que ele
// nem aparece.
//
// A régua é leitura; a JANELA continua sendo a regra: `lacunasCobertura`
// não muda de contrato e segue recebendo a janela configurada.
export function janelaDaGrade(janela, blocosDesenhados) {
  let { ini, fim } = janela || JANELA_FABRICA;
  for (const b of blocosDesenhados || []) {
    ini = Math.min(ini, paraMin(b.inicio));
    fim = Math.max(fim, paraMin(b.fim));
  }
  return { ini, fim };
}

// Marcas de hora cheia para o eixo da barra.
export function marcasDaBarra({ ini, fim } = JANELA_FABRICA) {
  const janela = fim - ini;
  const marcas = [];
  for (let m = Math.ceil(ini / 60) * 60; m <= fim; m += 60) {
    marcas.push({ hora: paraHora(m), pos: ((m - ini) / janela) * 100 });
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

// Lacunas na cobertura da UNIDADE num dia: os trechos da janela da
// escola em que nenhum servidor está presente. [{ ini, fim }] em minutos.
export function lacunasCobertura(blocosDoDiaDaUnidade, { ini, fim } = JANELA_FABRICA) {
  const cobertos = unir(blocosDoDiaDaUnidade.map(paraIntervalo))
    .filter(iv => iv.fim > ini && iv.ini < fim);   // só o que toca a janela

  const lacunas = [];
  let cursor = ini;
  for (const iv of cobertos) {
    if (iv.ini > cursor) lacunas.push({ ini: cursor, fim: Math.min(iv.ini, fim) });
    cursor = Math.max(cursor, iv.fim);
    if (cursor >= fim) break;
  }
  if (cursor < fim) lacunas.push({ ini: cursor, fim });
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
