// Manifesto do módulo SATE (Sistema de Agendamento de Transporte Extraclasse).
export default {
  id: 'sate',
  ico: '🚌',
  nome: 'SATE · Transporte',
  desc: 'Agendamento de transporte extraclasse.',
  navNome: 'SATE',
  rota: '#/sate',
  nav: true,
  ativo: true,
  load: () => import('./sate.view.js'),
};
