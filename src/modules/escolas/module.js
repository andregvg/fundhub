// Manifesto do módulo Escolas.
export default {
  id: 'escolas',
  ico: 'escola',
  nome: 'Escolas',
  desc: 'Cadastro das 144 unidades escolares.',
  rota: '#/escolas',
  nav: true,
  ativo: true,
  config: () => import('./escolas.config.js'),
  load: () => import('./escolas.view.js'),
};
