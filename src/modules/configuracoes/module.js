// Manifesto do módulo Configurações (agregador: tela, sem model, sem
// dados próprios). Reúne as configurações de todos os módulos que a
// pessoa pode ver. É de todo mundo - entra em meu_mapa_permissoes()
// como 'escrita' para todos (migration 026), como Meus dados.
export default {
  id: 'configuracoes',
  ico: 'config',
  nome: 'Configurações',
  desc: 'Como cada módulo se comporta para você e para a rede.',
  navNome: 'Configurações',
  rota: '#/configuracoes',
  grupo: 'conta',
  nav: true,
  ativo: true,
  // De todo mundo por desenho: sem dados próprios, esconder não protege
  // nada. O banco diz o mesmo (meu_mapa_permissoes, migration 026); esta
  // linha é o que faz o módulo DEGRADAR em vez de sumir do menu enquanto
  // a migration não roda. Ver nivelEfetivo() em core/registry.js.
  publico: true,
  doc: true,
  load: () => import('./configuracoes.view.js'),
};
