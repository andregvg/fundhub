// Manifesto do módulo SATE (Sistema de Agendamento de Transporte Extraclasse).
// Desde a 0.34.0 o SATE tem PÁGINA PRÓPRIA (sate.html, entrada src/sate.js):
// no FundHub, `externo` faz o menu e o tile abrirem essa página em nova aba,
// e `#/sate` redireciona para ela. `rota` continua existindo para a ajuda
// (#/ajuda?m=sate) e para o endereço antigo.
export default {
  id: 'sate',
  ico: 'onibus',
  nome: 'SATE · Transporte',
  desc: 'Agendamento de transporte extraclasse.',
  navNome: 'SATE',
  rota: '#/sate',
  externo: 'sate.html',
  nav: true,
  ativo: true,
  doc: true,
  config: () => import('./sate.config.js'),
  load: () => import('./sate.view.js'),
};
