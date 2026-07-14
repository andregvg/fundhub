// Manifesto do módulo Notificações.
// `servico: true` → não tem rota nem tela: é iniciado pelo main.js
// logo após o login e vive no topo (sino) e nos toasts.
export default {
  id: 'notificacoes',
  ico: '🔔',
  nome: 'Notificações',
  desc: 'Alertas em tempo real, no sino do topo.',
  ativo: true,
  servico: true,
  load: () => import('./notificacoes.service.js'),
};
