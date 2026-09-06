// ============================================================
// FundHub - core/registry.js  (registro de módulos)
// Fonte ÚNICA de verdade sobre os módulos do hub: os tiles da página
// "Módulos", os itens do menu lateral e as rotas saem todos daqui.
// Cada módulo declara a si mesmo em `modules/<id>/module.js`.
//
// Só os manifestos são importados de forma estática (são minúsculos).
// A tela de cada módulo é carregada sob demanda pelo roteador, via
// `load()` → import() dinâmico. Nada de módulo inativo é baixado.
//
// Três campos governam a navegação:
//   grupo   - em que seção do menu lateral o item aparece;
//   perm    - a chave de permissão (default: o próprio id). Ver
//             core/permissoes.js; o mapa vem do banco (migration 021).
//   publico - o módulo é de todo mundo por desenho e não some do menu
//             quando o banco cala. Ver nivelEfetivo() abaixo.
//
// Campos do manifesto - ver modules/docs/docs.content.js § "Novo módulo".
// ============================================================
import { nivel, OCULTO, LEITURA } from './permissoes.js';

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
import configuracoes from '../modules/configuracoes/module.js';
import usuarios     from '../modules/usuarios/module.js';
import ajuda        from '../modules/ajuda/module.js';
import docs         from '../modules/docs/module.js';

// A ordem aqui é a ordem dentro de cada grupo do menu.
export const MODULOS = [
  dashboard, modulos,
  escolas, servidores, calendario, horarios, afastamentos,
  sate, viagens, projetos, ocorrencias, atas, visitas,
  notificacoes, meusDados, configuracoes, usuarios, ajuda, docs,
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

// O nível EFETIVO de um módulo. Quase sempre é o que o banco disse; a
// única exceção é o módulo `publico: true`, que existe para qualquer
// pessoa logada por desenho - Ajuda, Módulos, Meus dados e Configurações
// não têm dados próprios, e esconder qualquer um deles não protege nada.
//
// Por que isto mora aqui e não em permissoes.js: o fato "este módulo é de
// todo mundo" é uma propriedade do MÓDULO, e este arquivo é a fonte única
// de verdade sobre módulos. E permissoes.js não pode importar daqui - o
// import é neste sentido, e o contrário fecharia ciclo (R4).
//
// Por que existe: até 06/09/2026 esse fato só estava escrito como literal
// SQL dentro de `meu_mapa_permissoes()` (migration 026). Como migration é
// aplicada à mão, na janela entre o deploy e o SQL esses quatro módulos
// SUMIAM do menu, em silêncio, em vez de degradar - o oposto do que
// .claude/rules/dados.md exige. Agora o front tem a mesma informação.
//
// Isto NÃO é controle de acesso. Quem barra continua sendo o RLS (R6): o
// nível concedido aqui é `leitura`, nunca `escrita`, então uma config de
// rede continua desabilitada até o banco dizer o contrário.
export function nivelEfetivo(mod) {
  const nv = nivel(chavePerm(mod));
  return (nv === OCULTO && mod.publico === true) ? LEITURA : nv;
}

export const veModulo = (mod) => nivelEfetivo(mod) !== OCULTO;

// Módulos que o usuário pode enxergar. O nível 'oculto' some de tudo:
// menu, página de módulos e rota. Antes isto era só `m.admin`.
export function modulosVisiveis() {
  return MODULOS.filter(veModulo);
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
  return MODULOS.filter(m => m.servico && m.ativo && veModulo(m));
}

// Só o caminho identifica o módulo: `#/servidores?unidade=…` é a mesma
// rota de `#/servidores`. A query é filtro de abertura, não endereço.
export const caminhoDaRota = (hash) => String(hash || '').split('?')[0];

export function moduloPorRota(hash) {
  const caminho = caminhoDaRota(hash);
  return MODULOS.find(m => m.rota && m.rota === caminho) || null;
}

// Rotas que mudaram de endereço. Manter o de-para aqui evita link
// quebrado em favorito e em e-mail antigo.
export const REDIRECIONAMENTOS = {
  '#/gestores': '#/servidores',
};
