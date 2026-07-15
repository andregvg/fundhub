// Manifesto do módulo Usuários & Acessos (admin).
// Gestão da allowlist (perfil) + o visualizador de auditoria.
export default {
  id: 'usuarios',
  ico: '🔐',
  nome: 'Usuários & Acessos',
  desc: 'Gestão de perfis, permissões e auditoria.',
  navNome: 'Usuários',
  rota: '#/usuarios',
  nav: true,
  ativo: true,
  admin: true,
  load: () => import('./usuarios.view.js'),
};
