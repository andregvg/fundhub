// Manifesto do módulo SATE (Sistema de Agendamento de Transporte Extraclasse).
export default {
  id: 'sate',
  ico: 'transporte',
  nome: 'SATE · Transporte',
  desc: 'Agendamento de transporte extraclasse.',
  navNome: 'SATE',
  rota: '#/sate',
  nav: true,
  ativo: true,
  doc: true,
  config: () => import('./sate.config.js'),
  load: () => import('./sate.view.js'),
};
