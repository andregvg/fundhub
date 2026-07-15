// Manifesto do módulo Atas de Atendimento.
export default {
  id: 'atas',
  ico: '📝',
  nome: 'Atas de Atendimento',
  desc: 'Redação e impressão em papel timbrado.',
  navNome: 'Atas',
  rota: '#/atas',
  nav: true,
  ativo: true,
  load: () => import('./atas.view.js'),
};
