// Manifesto do módulo Gestores & Coordenadores.
// Dono das entidades `servidor` e `vinculo` — Escolas, Afastamentos e
// Horários leem daqui (servidores.model.js é a API pública).
export default {
  id: 'servidores',
  ico: '👥',
  nome: 'Gestores & Coordenadores',
  desc: 'Equipe gestora, vínculos e contatos.',
  navNome: 'Gestores',
  rota: '#/gestores',
  nav: true,
  ativo: true,
  load: () => import('./servidores.view.js'),
};
