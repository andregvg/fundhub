// Manifesto do módulo Usuários & Acessos (admin).
// Gestão da allowlist (perfil) e das permissões. O visualizador de
// auditoria saiu daqui em 07/09/2026 e virou o módulo `auditoria`.
export default {
  id: 'usuarios',
  ico: 'acesso',
  nome: 'Usuários & Acessos',
  desc: 'Gestão de perfis e permissões de acesso.',
  navNome: 'Usuários',
  rota: '#/usuarios',
  grupo: 'admin',
  nav: true,
  ativo: true,
  doc: true,
  // `admin: true` saiu: quem barra agora é o mapa de permissões
  // (nenhum papel recebe 'usuarios' no preset, só is_admin()).
  load: () => import('./usuarios.view.js'),
};
