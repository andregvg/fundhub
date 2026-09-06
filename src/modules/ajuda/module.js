// Manifesto do módulo Ajuda (agregador: tela, sem model, sem dados
// próprios). Lista os tutoriais dos módulos que a pessoa enxerga.
// É de todo mundo - entra em meu_mapa_permissoes() como 'escrita'
// para todos (migration 026), como Meus dados e Configurações.
export default {
  id: 'ajuda',
  ico: 'ajuda',
  nome: 'Ajuda',
  desc: 'Como usar cada parte do sistema.',
  navNome: 'Ajuda',
  rota: '#/ajuda',
  grupo: 'ajuda',
  nav: true,
  ativo: true,
  // De todo mundo por desenho: sem dados próprios, esconder não protege
  // nada. O banco diz o mesmo (meu_mapa_permissoes, migration 026); esta
  // linha é o que faz o módulo DEGRADAR em vez de sumir do menu enquanto
  // a migration não roda. Ver nivelEfetivo() em core/registry.js.
  publico: true,
  doc: true,
  load: () => import('./ajuda.view.js'),
};
