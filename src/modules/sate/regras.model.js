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
// A regra de ocupação por horário - que contém as duas regras antigas, o
// intervalo manhã → tarde e a folga da noite - mora em
// `disponibilidade.model.js` (spec 2026-09-26, D5). Aqui fica o que a
// tela faz com o resultado: o que é erro e o que é aviso, e para quem.
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

// ── O agregador: erro barra, aviso não (R15 e spec D7) ──
//
// A MESMA situação é erro para a escola e aviso para quem aprova: a frota
// é inviolável para uma e negociável para o outro - é daí que nasce a
// frota extra do dia (040). A exceção é o dia SEM frota nenhuma: aí nem
// quem aprova segue, porque a viagem precisa de uma frota que a cubra
// (spec 2026-09-26, D4) - a tela oferece o cadastro ali mesmo.
//
// `livres`/`livresVan`: veículos livres no INTERVALO do pedido
// (disponibilidade.model.js § livresPara). `proximo`: primeiro embarque,
// em minutos, em que o pedido caberia - ou null.
export function avaliarPedido(p) {
  const {
    periodo, qtdAlunos = 0, qtdCadeirantes = 0, usaOnibus = true,
    livres = 0, livresVan = 0, totalDia = 0, proximo = null,
    diasDeAntecedencia = null, horarioEmbarque = null, horarioRetorno = null,
    capacidadeOnibus, capacidadeVan, antecedenciaMin, aprovador = false,
  } = p;

  const erros = [];
  const avisos = [];
  const barra = (codigo, texto) => (aprovador ? avisos : erros).push({ codigo, texto });

  const onibus = usaOnibus ? onibusPara(qtdAlunos, capacidadeOnibus) : 0;
  const vans = vansPara(qtdCadeirantes, capacidadeVan);

  if (!qtdAlunos || qtdAlunos < 1) erros.push({ codigo: 'sem_alunos', texto: 'Informe quantos estudantes vão.' });

  if (!aprovador && diasDeAntecedencia !== null && diasDeAntecedencia < antecedenciaMin) {
    erros.push({
      codigo: 'antecedencia',
      texto: `Pedidos precisam de ${antecedenciaMin} dia(s) de antecedência. Para algo mais próximo, fale com a Gerência de Transporte.`,
    });
  }

  // Sem os dois horários não há intervalo a conferir (spec D3).
  if (!horarioEmbarque || !horarioRetorno) {
    erros.push({ codigo: 'sem_horario', texto: 'Informe o horário de embarque e o de retorno.' });
  } else if (periodo !== 'noite') {
    // A noite pode voltar depois da meia-noite; os outros períodos, não.
    const e = paraMin(horarioEmbarque), r = paraMin(horarioRetorno);
    if (e !== null && r !== null && r <= e) erros.push({ codigo: 'horarios', texto: 'O retorno precisa ser depois do embarque.' });
  }

  if (onibus > 0) {
    if (!totalDia) {
      erros.push({
        codigo: 'sem_frota_dia',
        texto: aprovador
          ? 'Não há frota cadastrada para esta data. Cadastre-a abaixo para seguir.'
          : 'Não há ônibus disponíveis nesta data.',
      });
    } else if (onibus > livres) {
      const dica = proximo !== null ? ` A partir das ${paraHora(proximo)} há ônibus suficientes.` : '';
      barra('sem_frota', `Faltam ônibus: o pedido precisa de ${onibus} e há ${Math.max(0, livres)} livre(s) neste horário.${dica}`);
    }
  }

  // Cadeirante sem van é SEMPRE aviso: o pedido segue e a Gerência
  // providencia a van ou o deixa aguardando transporte adaptado.
  if (vans > 0 && vans > livresVan) {
    avisos.push({
      codigo: 'sem_van',
      texto: `Não há van adaptada livre para ${qtdCadeirantes} cadeirante(s). O pedido segue, e a Gerência providencia a van ou o deixa aguardando transporte adaptado.`,
    });
  }

  return { erros, avisos, onibus, vans };
}

// ── Alocação em fichas de ônibus ─────────────────────────────
// Uma ficha = UM veículo. É o documento que a empresa de transporte
// recebe, e o `agendamentos-fil` chama de "folha".
//
// A alocação é bem mais simples aqui do que lá, e a razão é de MODELO:
// no agendamentos-fil, duas turmas dividirem um ônibus era uma convenção
// reconstruída por uma chave de texto (escola|embarque|retorno), e
// qualquer divergência nesse texto fabricava ficha de ônibus inexistente.
// No SATE, um ônibus que passa em duas escolas é UMA solicitação com dois
// pontos de embarque - o compartilhamento é explícito no dado, então não
// há o que inferir nem o que fabricar.
//
// PURA: sem DOM, sem banco. Recebe as confirmadas do dia, devolve as
// fichas na ordem em que serão impressas.
export function alocarFichas(confirmadas, { capacidade }) {
  const ORDEM_PERIODO = { manha: 0, tarde: 1, noite: 2 };
  const fichas = [];
  // Por período, e dentro dele por horário de embarque: é a ordem em que
  // os veículos saem, e a mesma em que a numeração faz sentido para quem
  // recebe a pilha de papel.
  const ordenadas = [...(confirmadas || [])].sort((a, b) =>
    (ORDEM_PERIODO[a.periodo] ?? 9) - (ORDEM_PERIODO[b.periodo] ?? 9)
    || String(a.horario_embarque || '').localeCompare(String(b.horario_embarque || '')));

  // A numeração REINICIA a cada período - é o que o agendamentos-fil faz,
  // e o que permite dizer "o terceiro ônibus da tarde" sem ambiguidade.
  const contador = {};
  for (const s of ordenadas) {
    const n = Math.max(0, Number(s.qtd_onibus) || 0);
    if (!n) continue;   // solicitação sem ônibus não gera ficha
    const sobra = Math.max(0, (Number(s.qtd_alunos) || 0));
    for (let i = 0; i < n; i++) {
      contador[s.periodo] = (contador[s.periodo] || 0) + 1;
      fichas.push({
        solicitacao: s,
        periodo: s.periodo,
        numero: contador[s.periodo],
        de: n,                       // "ônibus 1 de 2" da mesma solicitação
        indice: i + 1,
        // Lugares por veículo: os estudantes repartidos entre os ônibus da
        // solicitação, nunca acima da capacidade de um.
        lugares: Math.min(capacidade, Math.ceil(sobra / n)),
        // A van vai na PRIMEIRA ficha da solicitação: é um veículo a mais,
        // não um a cada ônibus, e repetir o número em todas faria a empresa
        // mandar uma van por ônibus.
        vans: i === 0 ? (Number(s.qtd_vans) || 0) : 0,
        // Sinaliza turma acima da frota informada - erro de cadastro que a
        // empresa não tem como adivinhar.
        excedeCapacidade: sobra > n * capacidade,
      });
    }
  }
  return fichas;
}

// Solicitações confirmadas que NÃO viraram ficha nenhuma: têm estudantes
// mas nenhum ônibus. Aparecem à parte, porque um pedido confirmado que
// some da pilha de papel é o defeito mais caro possível aqui.
export const pendenciasDeFicha = (confirmadas) =>
  (confirmadas || []).filter(s => (Number(s.qtd_alunos) || 0) > 0 && !(Number(s.qtd_onibus) || 0));
