// Manifesto do módulo Documentação.
// `admin: true` → o tile some da home e a rota é barrada pelo roteador
// para quem não é admin_sme. É documentação de funcionamento interno:
// não contém dado pessoal, mas também não interessa a quem só consulta.
export default {
  id: 'docs',
  ico: 'docs',
  nome: 'Documentação técnica',
  desc: 'Arquitetura, migrations e RLS - para quem mantém o código.',
  navNome: 'Docs técnicos',
  rota: '#/docs',
  grupo: 'ajuda',
  nav: true,
  ativo: true,
  // Segue restrita: nenhum papel recebe 'docs' no preset da 021, então
  // só is_admin() enxerga. Mesma regra de antes, outro mecanismo.
  load: () => import('./docs.view.js'),
};
