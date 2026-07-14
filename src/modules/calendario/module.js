// Manifesto do módulo Calendário Escolar.
export default {
  id: 'calendario',
  ico: '📅',
  nome: 'Calendário Escolar',
  desc: 'Dias letivos, eventos e bloqueios de data.',
  navNome: 'Calendário',
  rota: '#/calendario',
  nav: true,
  ativo: true,
  load: () => import('./calendario.view.js'),
};
