// Manifesto do módulo Afastamentos.
export default {
  id: 'afastamentos',
  ico: '🌴',
  nome: 'Afastamentos',
  desc: 'Férias, licenças e afastamentos.',
  rota: '#/afastamentos',
  nav: true,
  ativo: true,
  load: () => import('./afastamentos.view.js'),
};
