// Manifesto do módulo Usuários & Acessos (admin).
// Gestão da allowlist (perfil) + o visualizador de auditoria.
export default {
  id: 'usuarios',
  ico: '🔐',
  nome: 'Usuários & Acessos',
  desc: 'Gestão de perfis, permissões e auditoria.',
  navNome: 'Usuários',
  rota: '#/usuarios',
  grupo: 'admin',
  nav: true,
  ativo: true,
  // `admin: true` saiu: quem barra agora é o mapa de permissões
  // (nenhum papel recebe 'usuarios' no preset, só is_admin()).
  load: () => import('./usuarios.view.js'),
};
