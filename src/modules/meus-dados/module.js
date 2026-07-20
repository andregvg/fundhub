// Manifesto do módulo Meus Dados.
// Toda pessoa autorizada tem este módulo (ver meu_mapa_permissoes na
// migration 021) — é a única tela que não depende de papel.
//
// Não há senha a redefinir: o acesso ao FundHub é por link mágico no
// e-mail institucional ou pela conta Google, e nenhuma senha do hub
// existe para ser trocada. O que a pessoa gerencia aqui são os
// próprios dados de contato e a sessão.
export default {
  id: 'meus_dados',
  ico: '🪪',
  nome: 'Meus dados',
  desc: 'Seus dados de cadastro, contatos e sessão.',
  navNome: 'Meus dados',
  rota: '#/meus-dados',
  grupo: 'conta',
  nav: true,
  ativo: true,
  load: () => import('./meus-dados.view.js'),
};
