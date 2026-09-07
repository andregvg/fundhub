// Manifesto do módulo Auditoria (admin).
// O console de "o que aconteceu no sistema": as mudanças de dado
// (audit_log, trigger no Postgres) e os eventos de aplicação
// (evento_log, migration 032).
//
// Nasceu separado de Usuários & Acessos em 07/09/2026: a aba de
// auditoria vivia lá por acidente histórico, e o assunto tem peso
// próprio. Ver a spec 2026-09-07-registros-e-logs-design.
//
// Sem `perm` e sem preset em papel_permissao: nenhum papel recebe
// 'auditoria', então nivel_modulo() devolve 'oculto' para todo
// não-admin e o roteador barra. Mesma postura de `usuarios`.
export default {
  id: 'auditoria',
  ico: 'auditoria',
  nome: 'Auditoria',
  desc: 'Histórico de alterações e registro de atividade do sistema.',
  rota: '#/auditoria',
  grupo: 'admin',
  nav: true,
  ativo: true,
  doc: true,
  config: () => import('./auditoria.config.js'),
  load: () => import('./auditoria.view.js'),
};
