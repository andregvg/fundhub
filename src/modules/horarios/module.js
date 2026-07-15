// Manifesto do módulo Horários de Trabalho.
export default {
  id: 'horarios',
  ico: '🕒',
  nome: 'Horários de Trabalho',
  desc: 'Jornada da equipe gestora, validada por regra.',
  navNome: 'Horários',
  rota: '#/horarios',
  nav: true,
  ativo: true,
  load: () => import('./horarios.view.js'),
};
