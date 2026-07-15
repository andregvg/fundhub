// Manifesto do módulo Projetos & Pesquisas.
// Cobre o fluxo INTERNO (cadastro + interesse das escolas). O portal
// externo do proponente por token depende de Edge Function — backlog.
export default {
  id: 'projetos',
  ico: '🔬',
  nome: 'Projetos & Pesquisas',
  desc: 'Ofertas às escolas, anuências e interesse.',
  navNome: 'Projetos',
  rota: '#/projetos',
  nav: true,
  ativo: true,
  load: () => import('./projetos.view.js'),
};
