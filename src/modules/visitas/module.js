// Manifesto do módulo Relatórios de Visita Técnica.
export default {
  id: 'visitas',
  ico: '📋',
  nome: 'Relatórios de Visita',
  desc: 'Visitas técnicas às escolas.',
  navNome: 'Visitas',
  rota: '#/visitas',
  nav: true,
  ativo: true,
  load: () => import('./visitas.view.js'),
};
