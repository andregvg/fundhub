// ============================================================
// FundHub — core/registry.js  (registro de módulos)
// Fonte ÚNICA de verdade sobre os módulos do hub: os tiles da home,
// os itens da navegação e as rotas saem todos daqui. Cada módulo
// declara a si mesmo em `modules/<id>/module.js` (o manifesto).
//
// Só os manifestos são importados de forma estática (são minúsculos).
// A tela de cada módulo é carregada sob demanda pelo roteador, via
// `load()` → import() dinâmico. Nada de módulo inativo é baixado.
//
// Campos do manifesto — ver modules/docs/docs.content.js § "Novo módulo".
// ============================================================
import dashboard    from '../modules/dashboard/module.js';
import escolas      from '../modules/escolas/module.js';
import servidores   from '../modules/servidores/module.js';
import calendario   from '../modules/calendario/module.js';
import horarios     from '../modules/horarios/module.js';
import afastamentos from '../modules/afastamentos/module.js';
import sate         from '../modules/sate/module.js';
import viagens      from '../modules/viagens/module.js';
import projetos     from '../modules/projetos/module.js';
import ocorrencias  from '../modules/ocorrencias/module.js';
import atas         from '../modules/atas/module.js';
import visitas      from '../modules/visitas/module.js';
import notificacoes from '../modules/notificacoes/module.js';
import usuarios     from '../modules/usuarios/module.js';
import docs         from '../modules/docs/module.js';

// A ordem aqui é a ordem dos tiles na home.
export const MODULOS = [
  dashboard, escolas, servidores, calendario, horarios, afastamentos,
  sate, viagens, projetos, ocorrencias, atas, visitas,
  notificacoes, usuarios, docs,
];

// Módulos que o usuário pode enxergar (esconde os `admin` de quem não é admin).
export function modulosVisiveis(perfil) {
  return MODULOS.filter(m => !m.admin || perfil?.isAdmin);
}

// Itens da barra de navegação, na ordem declarada.
export function modulosNav(perfil) {
  return modulosVisiveis(perfil).filter(m => m.nav && m.ativo && m.rota);
}

// Serviços de fundo (sem tela): inicializados no boot, após o login.
export function servicos() {
  return MODULOS.filter(m => m.servico && m.ativo);
}

export function moduloPorRota(hash) {
  return MODULOS.find(m => m.rota && m.rota === hash) || null;
}
