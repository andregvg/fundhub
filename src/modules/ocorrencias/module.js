// Manifesto do módulo Ocorrências.
// Registro dos atendimentos telefônicos das recepcionistas, ligado à escola.
export default {
  id: 'ocorrencias',
  ico: '📞',
  nome: 'Ocorrências',
  desc: 'Registro de atendimentos telefônicos.',
  navNome: 'Ocorrências',
  rota: '#/ocorrencias',
  nav: true,
  ativo: true,
  load: () => import('./ocorrencias.view.js'),
};
