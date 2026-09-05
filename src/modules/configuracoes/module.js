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
  load: () => import('./configuracoes.view.js'),
};
