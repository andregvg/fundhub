// Manifesto do módulo Escolas.
export default {
  id: 'escolas',
  ico: '🏫',
  nome: 'Escolas',
  desc: 'Cadastro das 144 unidades escolares.',
  rota: '#/escolas',
  nav: true,
  ativo: true,
  load: () => import('./escolas.view.js'),
};
