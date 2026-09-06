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
  doc: true,
  load: () => import('./ajuda.view.js'),
};
