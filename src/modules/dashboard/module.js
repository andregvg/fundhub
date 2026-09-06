// Manifesto do módulo Dashboard do dia.
export default {
  id: 'dashboard',
  ico: 'dashboard',
  nome: 'Dashboard do dia',
  desc: 'Acompanhamento em tempo real.',
  navNome: 'Dashboard',
  rota: '#/dashboard',
  grupo: 'principal',   // é a tela inicial: fica acima das seções
  nav: true,
  ativo: true,
  doc: true,
  config: () => import('./dashboard.config.js'),
  load: () => import('./dashboard.view.js'),
};
