// Manifesto do módulo Dashboard do dia.
export default {
  id: 'dashboard',
  ico: '📊',
  nome: 'Dashboard do dia',
  desc: 'Acompanhamento em tempo real.',
  navNome: 'Dashboard',
  rota: '#/dashboard',
  nav: true,
  ativo: true,
  load: () => import('./dashboard.view.js'),
};
