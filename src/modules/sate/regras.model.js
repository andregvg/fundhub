// ============================================================
// FundHub - modules/sate/regras.model.js
// As REGRAS DE AGENDAMENTO do SATE, como funções puras.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D6 e D7.
//
// Puras de propósito: nenhuma toca no banco nem no DOM, então dá para
// rodar todas com `node` sobre casos montados à mão. Regra de negócio é
// do domínio (.claude/rules/arquitetura.md) - ela mora no model, e não
// na tela, porque a tela não é o único lugar que precisa dela: o
// aprovador, o relatório e o painel de saldo fazem a mesma pergunta.
//
// As duas regras que o André especificou:
//
//   (a) Um ônibus usado de manhã só serve à tarde se
//         (retorno + viagem de volta) + intervalo mínimo <= embarque
//       O intervalo é configurável (padrão 120 min).
//
//   (b) Um agendamento noturno exige ônibus livre em UM dos períodos do
//       próprio dia E no período da manhã do dia seguinte.
//
// Elas também estão em docs/modulos/sate.md, escritas para quem usa.
// ============================================================

export const PERIODOS = Object.freeze({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' });

// "07:30" → 450. Devolve null para o que não é hora - quem chama decide
// o que fazer com a ausência, em vez de receber NaN silencioso.
export function paraMin(hhmm) {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// 450 → "07:30".
export const paraHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Quantos veículos um grupo precisa. Só alunos entram na conta - é o
// mesmo critério do agendamentos-fil, e o acompanhante nunca requisita
// um ônibus a mais.
export const onibusPara = (qtdAlunos, capacidade) =>
  Math.ceil(Math.max(0, Number(qtdAlunos) || 0) / capacidade) || 0;

export const vansPara = (qtdCadeirantes, capacidade) =>
  Math.ceil(Math.max(0, Number(qtdCadeirantes) || 0) / capacidade) || 0;

// ── Regra (a): intervalo entre um retorno e o próximo embarque ──
//
// `viagemVoltaMin` é PARÂMETRO, com padrão 0, e não algo que esta função
// calcula: o tempo de trajeto vem da rota (bloco S4). Até S4 existir a
// regra roda com a parte que já se sabe - uma regra incompleta ainda
// barra o caso grosseiro, e é melhor que uma regra ausente.
export function intervaloEntreViagens({ retorno, embarque, viagemVoltaMin = 0, intervaloMin }) {
  const r = paraMin(retorno);
  const e = paraMin(embarque);
  // Sem um dos horários não há o que comparar. `ok: true` porque a regra
  // não foi violada - ela não pôde ser avaliada, e reprovar por falta de
  // dado bloquearia todo pedido sem horário preenchido.
  if (r === null || e === null) return { ok: true, avaliada: false, folgaMin: null };

  const chegada = r + Math.max(0, Number(viagemVoltaMin) || 0);
  const folgaMin = e - chegada;
  return { ok: folgaMin >= intervaloMin, avaliada: true, folgaMin, exigidoMin: intervaloMin };
}

// ── Regra (b): viabilidade de um agendamento noturno ──
//
// O ônibus da noite precisa estar livre antes (para sair) e na manhã
// seguinte (para voltar e ser liberado).
export function noiteViavel({ livreManha, livreTarde, livreManhaSeguinte }) {
  const noDia = (livreManha >= 1) || (livreTarde >= 1);
  const noSeguinte = livreManhaSeguinte >= 1;
  return { ok: noDia && noSeguinte, noDia, noSeguinte };
}

// ── O agregador: erro barra, aviso não (R15 e spec D7) ──
//
// A MESMA situação é erro para a escola e aviso para quem aprova. Não é
// inconsistência: a frota é um paradigma inviolável para a escola, e
// quem aprova pode - e às vezes precisa - violá-la, e é daí que nasce a
// frota extra do dia (spec D2). Por isso `aprovador` entra aqui, e não
// numa checagem separada na tela: a regra é uma só, com dois públicos.
//
// Devolve listas de `{ codigo, texto }`. `codigo` é para a tela decidir
// o que destacar; `texto` é o que a pessoa lê.
export function avaliarPedido(p) {
  const {
    periodo, qtdAlunos = 0, qtdCadeirantes = 0,
    livre = {}, livreVan = {}, livreManhaSeguinte = 0,
    diasDeAntecedencia = null, viagensDoDia = [],
    horarioEmbarque = null, horarioRetorno = null,
    capacidadeOnibus, capacidadeVan, intervaloMin, antecedenciaMin,
    aprovador = false,
  } = p;

  const erros = [];
  const avisos = [];
  // Para a escola a barreira é erro; para quem aprova, aviso. A frota é
  // inviolável para uma e negociável para o outro.
  const barra = (codigo, texto) => (aprovador ? avisos : erros).push({ codigo, texto });

  const onibus = onibusPara(qtdAlunos, capacidadeOnibus);
  const vans = vansPara(qtdCadeirantes, capacidadeVan);

  if (!qtdAlunos || qtdAlunos < 1) {
    erros.push({ codigo: 'sem_alunos', texto: 'Informe quantos estudantes vão.' });
  }

  // Antecedência: limite da escola, nunca de quem aprova.
  if (!aprovador && diasDeAntecedencia !== null && diasDeAntecedencia < antecedenciaMin) {
    erros.push({
      codigo: 'antecedencia',
      texto: `Pedidos precisam de ${antecedenciaMin} dia(s) de antecedência. Para algo mais próximo, fale com a Gerência de Transporte.`,
    });
  }

  // Saldo de ônibus do período pedido.
  const livrePeriodo = Number(livre[periodo] ?? 0);
  if (onibus > livrePeriodo) {
    barra('sem_frota', `Faltam ônibus: o pedido precisa de ${onibus} e há ${livrePeriodo} livre(s) neste período.`);
  }

  // Cadeirante sem van no saldo é SEMPRE aviso, nunca erro: o pedido
  // segue e o status vai para "aguardando transporte adaptado", que é o
  // que o agendamentos-fil faz há dois anos.
  if (vans > 0) {
    const livreVanPeriodo = Number(livreVan[periodo] ?? 0);
    if (vans > livreVanPeriodo) {
      avisos.push({
        codigo: 'sem_van',
        texto: `Não há van adaptada livre para ${qtdCadeirantes} cadeirante(s). O pedido segue como "aguardando transporte adaptado".`,
      });
    }
  }

  // Regra (b): noite.
  if (periodo === 'noite') {
    const v = noiteViavel({
      livreManha: Number(livre.manha ?? 0),
      livreTarde: Number(livre.tarde ?? 0),
      livreManhaSeguinte: Number(livreManhaSeguinte ?? 0),
    });
    if (!v.noDia) {
      barra('noite_sem_dia', 'Para um agendamento noturno é preciso ter ônibus livre pela manhã ou à tarde do mesmo dia.');
    }
    if (!v.noSeguinte) {
      barra('noite_sem_seguinte', 'Para um agendamento noturno é preciso ter ônibus livre na manhã do dia seguinte.');
    }
  }

  // Regra (a): sempre AVISO. O retorno pode adiantar, e quem aprova é
  // que sabe se a folga real dá - bloquear aqui impediria remanejamento
  // legítimo.
  if (periodo === 'tarde' && horarioEmbarque) {
    for (const v of viagensDoDia) {
      if (v.periodo !== 'manha') continue;
      const r = intervaloEntreViagens({
        retorno: v.horario_retorno, embarque: horarioEmbarque,
        viagemVoltaMin: v.viagemVoltaMin, intervaloMin,
      });
      if (r.avaliada && !r.ok) {
        avisos.push({
          codigo: 'intervalo',
          texto: `Um ônibus da manhã chega prevista às ${paraHora(paraMin(v.horario_retorno) + (v.viagemVoltaMin || 0))} e o embarque é às ${horarioEmbarque}: ${r.folgaMin} min de folga, contra os ${intervaloMin} exigidos.`,
        });
        break;   // um aviso por pedido basta; listar todos vira ruído
      }
    }
  }

  if (horarioEmbarque && horarioRetorno) {
    const e = paraMin(horarioEmbarque), r = paraMin(horarioRetorno);
    if (e !== null && r !== null && r <= e) {
      erros.push({ codigo: 'horarios', texto: 'O retorno precisa ser depois do embarque.' });
    }
  }

  return { erros, avisos, onibus, vans };
}
