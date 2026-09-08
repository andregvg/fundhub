// ============================================================
// FundHub - modules/sate/sate.config.js
// Declaração de configuração do SATE. NÃO é model: aqui ficam os
// ACESSOS (com o padrão) e a declaração que a engrenagem renderiza.
// Spec: 2026-09-08-sate-modelo-de-dados-design.md § D9.
//
// Os quatro números que governam o agendamento moram aqui porque
// mudam sem código - o intervalo mínimo entre períodos, principalmente,
// que o André pediu para ser ajustável e valer dos próximos
// agendamentos em diante.
//
// A CAPACIDADE do ônibus era uma constante em `sate.model.js`
// (CAP_ONIBUS = 44). Virou configuração pelo mesmo motivo: é um número
// da operação, não do domínio.
//
// O CADASTRO da frota também é configuração do SATE, mas o painel dele
// é tela e nasce em S3. Aqui só os números.
// ============================================================
import { conf } from '../../core/configuracoes.js';

// Os padrões vivem AQUI, no acesso, e não em core/configuracoes.js -
// aquele arquivo só sabe "o que foi gravado".
export const PADRAO = Object.freeze({
  intervalo_min_periodos: 120,
  capacidade_onibus: 44,
  capacidade_van: 2,
  antecedencia_min_dias: 5,
});

// Valor gravado só vence o padrão se for número finito e não negativo.
// Um valor estranho vindo do banco cai no padrão em vez de virar NaN
// atravessando as contas de saldo.
function num(chave, padrao) {
  const v = Number(conf('sate', chave));
  return Number.isFinite(v) && v >= 0 ? v : padrao;
}

// Zero é resposta legítima aqui: "sem intervalo mínimo" é uma escolha.
export const intervaloMinMin = () => num('intervalo_min_periodos', PADRAO.intervalo_min_periodos);
export const antecedenciaMinDias = () => num('antecedencia_min_dias', PADRAO.antecedencia_min_dias);

// Zero NÃO é resposta legítima nas capacidades: elas são divisores, e
// zero ali produziria Infinity ônibus. O `||` devolve o padrão.
export const capacidadeOnibus = () => num('capacidade_onibus', PADRAO.capacidade_onibus) || PADRAO.capacidade_onibus;
export const capacidadeVan = () => num('capacidade_van', PADRAO.capacidade_van) || PADRAO.capacidade_van;

export const DECLARACAO = {
  itens: [
    {
      chave: 'intervalo_min_periodos', escopo: 'rede', grupo: 'regras',
      tipo: 'numero', padrao: PADRAO.intervalo_min_periodos, min: 0, max: 600,
      rotulo: 'Intervalo mínimo entre períodos (minutos)',
      dica: 'Folga exigida entre a chegada prevista do ônibus da manhã e o embarque da tarde. Vale para os próximos agendamentos, não para os já confirmados.',
    },
    {
      chave: 'capacidade_onibus', escopo: 'rede', grupo: 'regras',
      tipo: 'numero', padrao: PADRAO.capacidade_onibus, min: 1, max: 90,
      rotulo: 'Lugares por ônibus',
      dica: 'Usado para calcular quantos ônibus uma turma precisa.',
    },
    {
      chave: 'capacidade_van', escopo: 'rede', grupo: 'regras',
      tipo: 'numero', padrao: PADRAO.capacidade_van, min: 1, max: 20,
      rotulo: 'Cadeirantes por van adaptada',
      dica: 'Usado para calcular quantas vans adaptadas uma turma precisa.',
    },
    {
      chave: 'antecedencia_min_dias', escopo: 'rede', grupo: 'regras',
      tipo: 'numero', padrao: PADRAO.antecedencia_min_dias, min: 0, max: 60,
      rotulo: 'Antecedência mínima da escola (dias)',
      dica: 'Quantos dias antes a escola precisa pedir. Quem aprova não tem esse limite.',
    },
  ],
};
