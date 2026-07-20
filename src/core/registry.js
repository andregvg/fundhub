// ============================================================
// FundHub — core/registry.js  (registro de módulos)
// Fonte ÚNICA de verdade sobre os módulos do hub: os tiles da página
// "Módulos", os itens do menu lateral e as rotas saem todos daqui.
// Cada módulo declara a si mesmo em `modules/<id>/module.js`.
//
// Só os manifestos são importados de forma estática (são minúsculos).
// A tela de cada módulo é carregada sob demanda pelo roteador, via
// `load()` → import() dinâmico. Nada de módulo inativo é baixado.
//
// Dois campos governam a navegação:
//   grupo — em que seção do menu lateral o item aparece;
//   perm  — a chave de permissão (default: o próprio id). Ver
//           core/permissoes.js; o mapa vem do banco (migration 021).
//
// Campos do manifesto — ver modules/docs/docs.content.js § "Novo módulo".
// ============================================================
import { podeVer } from './permissoes.js';

import dashboard    from '../modules/dashboard/module.js';
import modulos      from '../modules/modulos/module.js';
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
import meusDados    from '../modules/meus-dados/module.js';
import usuarios     from '../modules/usuarios/module.js';
import docs         from '../modules/docs/module.js';

// A ordem aqui é a ordem dentro de cada grupo do menu.
export const MODULOS = [
  dashboard, modulos,
  escolas, servidores, calendario, horarios, afastamentos,
  sate, viagens, projetos, ocorrencias, atas, visitas,
  notificacoes, meusDados, usuarios, docs,
];

// Seções do menu lateral, na ordem de exibição. Um módulo cai em
// "modulos" se não declarar grupo.
export const GRUPOS = [
  { id: 'principal', rotulo: '' },              // sem título: Dashboard e Módulos
  { id: 'modulos',   rotulo: 'Módulos' },
  { id: 'conta',     rotulo: 'Minha conta' },
  { id: 'admin',     rotulo: 'Administração' },
  { id: 'ajuda',     rotulo: 'Documentação' },
];

// A chave de permissão do módulo (default: o id).
export const chavePerm = (m) => m.perm || m.id;

// Módulos que o usuário pode enxergar. O nível 'oculto' some de tudo:
// menu, página de módulos e rota. Antes isto era só `m.admin`.
export function modulosVisiveis() {
  return MODULOS.filter(m => podeVer(chavePerm(m)));
}

// Itens de navegação, agrupados na ordem de GRUPOS. Devolve só os
// grupos que sobraram com pelo menos um item.
export function navPorGrupo() {
  const visiveis = modulosVisiveis().filter(m => m.nav && m.ativo && m.rota);
  return GRUPOS
    .map(g => ({ ...g, itens: visiveis.filter(m => (m.grupo || 'modulos') === g.id) }))
    .filter(g => g.itens.length);
}

// Serviços de fundo (sem tela): inicializados no boot, após o login.
export function servicos() {
  return MODULOS.filter(m => m.servico && m.ativo && podeVer(chavePerm(m)));
}

export function moduloPorRota(hash) {
  return MODULOS.find(m => m.rota && m.rota === hash) || null;
}

// Rotas que mudaram de endereço. Manter o de-para aqui evita link
// quebrado em favorito e em e-mail antigo.
export const REDIRECIONAMENTOS = {
  '#/gestores': '#/servidores',
};
