// Manifesto do módulo Servidores.
// Era "Gestores & Coordenadores", mas o cadastro nunca foi só de
// gestão: os filtros já falavam em supervisores, e os Afastamentos
// precisam registrar também a equipe de acompanhamento e os agentes
// administrativos da sede. "Servidores" é o nome que cobre todos —
// e para de mentir sobre o próprio conteúdo.
//
// Dono das entidades `servidor` e `vinculo` — Escolas, Afastamentos e
// Horários leem daqui (servidores.model.js é a API pública).
// A rota antiga #/gestores continua funcionando: ver
// REDIRECIONAMENTOS em core/registry.js.
export default {
  id: 'servidores',
  ico: '👥',
  nome: 'Servidores',
  desc: 'Cadastro funcional, lotações e contatos.',
  navNome: 'Servidores',
  rota: '#/servidores',
  nav: true,
  ativo: true,
  load: () => import('./servidores.view.js'),
};
