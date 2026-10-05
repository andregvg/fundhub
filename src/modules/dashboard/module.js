// Manifesto do módulo Visão geral (a tela inicial). O id e a rota continuam
// `dashboard`: são endereço e chave de permissão, não nome de tela.
export default {
  id: 'dashboard',
  ico: 'dashboard',
  nome: 'Visão geral',
  desc: 'Acompanhamento em tempo real.',
  navNome: 'Visão geral',
  rota: '#/dashboard',
  grupo: 'principal',   // é a tela inicial: fica acima das seções
  nav: true,
  ativo: true,
  doc: true,
  config: () => import('./dashboard.config.js'),
  load: () => import('./dashboard.view.js'),
};
