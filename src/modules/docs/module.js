// Manifesto do módulo Documentação.
// `admin: true` → o tile some da home e a rota é barrada pelo roteador
// para quem não é admin_sme. É documentação de funcionamento interno:
// não contém dado pessoal, mas também não interessa a quem só consulta.
export default {
  id: 'docs',
  ico: '📖',
  nome: 'Documentação',
  desc: 'Como o FundHub funciona por dentro.',
  navNome: 'Docs',
  rota: '#/docs',
  nav: true,
  ativo: true,
  admin: true,
  load: () => import('./docs.view.js'),
};
