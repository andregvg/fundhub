// Manifesto do módulo Programação de Viagens.
// (NÃO chamar de "romaneio" — o nome oficial é Programação de Viagens.)
export default {
  id: 'viagens',
  ico: 'documento',
  nome: 'Programação de Viagens',
  desc: 'Viagens confirmadas para a empresa de transporte.',
  navNome: 'Viagens',
  rota: '#/viagens',
  nav: true,
  ativo: true,
  load: () => import('./viagens.view.js'),
};
