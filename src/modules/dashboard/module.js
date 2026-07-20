// Manifesto do módulo Dashboard do dia.
export default {
  id: 'dashboard',
  ico: '📊',
  nome: 'Dashboard do dia',
  desc: 'Acompanhamento em tempo real.',
  navNome: 'Dashboard',
  rota: '#/dashboard',
  grupo: 'principal',   // é a tela inicial: fica acima das seções
  nav: true,
  ativo: true,
  load: () => import('./dashboard.view.js'),
};
