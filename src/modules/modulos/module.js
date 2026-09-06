// Manifesto da página "Todos os Módulos".
// Era a home do hub (rota #/); virou um módulo próprio quando a
// Dashboard assumiu a tela inicial. O conteúdo é o mesmo: os tiles
// saem do registro, então módulo novo aparece aqui sozinho.
export default {
  id: 'modulos',
  ico: 'modulos',
  nome: 'Todos os Módulos',
  desc: 'Índice das ferramentas do hub.',
  navNome: 'Todos os Módulos',
  rota: '#/modulos',
  grupo: 'principal',
  nav: true,
  ativo: true,
  // De todo mundo por desenho: sem dados próprios, esconder não protege
  // nada. O banco diz o mesmo (meu_mapa_permissoes, migration 026); esta
  // linha é o que faz o módulo DEGRADAR em vez de sumir do menu enquanto
  // a migration não roda. Ver nivelEfetivo() em core/registry.js.
  publico: true,
  load: () => import('./modulos.view.js'),
};
