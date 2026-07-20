// Manifesto da página "Todos os Módulos".
// Era a home do hub (rota #/); virou um módulo próprio quando a
// Dashboard assumiu a tela inicial. O conteúdo é o mesmo: os tiles
// saem do registro, então módulo novo aparece aqui sozinho.
export default {
  id: 'modulos',
  ico: '🧩',
  nome: 'Todos os Módulos',
  desc: 'Índice das ferramentas do hub.',
  navNome: 'Todos os Módulos',
  rota: '#/modulos',
  grupo: 'principal',
  nav: true,
  ativo: true,
  load: () => import('./modulos.view.js'),
};
