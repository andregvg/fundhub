// ============================================================
// FundHub - core/permissoes.js  (autorização por módulo)
// Substitui o antigo "admin sim / admin não" por um mapa
// módulo → nível, que vem do banco (meu_mapa_permissoes) e é a
// MESMA fonte que o RLS consulta. Ver migration 021.
//
// Os quatro níveis:
//   oculto   - o módulo não existe para essa pessoa.
//   proprios - vê e mexe só no que é da própria escola/cadastro.
//   leitura  - vê tudo do módulo, não escreve.
//   escrita  - vê e escreve tudo.
//
// Regra de ouro deste arquivo: ele decide o que APARECE. Quem decide
// o que a pessoa consegue LER de fato é o RLS. Se os dois
// discordarem, o banco vence - e é assim que tem que ser.
// ============================================================

export const OCULTO = 'oculto';
export const PROPRIOS = 'proprios';
export const LEITURA = 'leitura';
export const ESCRITA = 'escrita';

// Ordem crescente de poder - permite comparar níveis sem if aninhado.
const ORDEM = { [OCULTO]: 0, [PROPRIOS]: 1, [LEITURA]: 2, [ESCRITA]: 3 };

export const NIVEIS = [
  { valor: OCULTO,   rotulo: 'Oculto',   desc: 'Não aparece no menu nem na API.' },
  { valor: PROPRIOS, rotulo: 'Próprios', desc: 'Só o que é da própria escola.' },
  { valor: LEITURA,  rotulo: 'Leitura',  desc: 'Vê tudo, não edita.' },
  { valor: ESCRITA,  rotulo: 'Escrita',  desc: 'Vê e edita tudo.' },
];

export const rotulaNivel = (n) => NIVEIS.find(x => x.valor === n)?.rotulo || 'Oculto';

// O mapa do usuário logado. Preenchido no boot por perfil.js a partir
// de `meu_mapa_permissoes()` (migration 034), que devolve:
//
//   { padrao: 'escrita', modulos: {} }                    ← admin
//   { padrao: 'oculto',  modulos: { escolas: 'leitura' } } ← os demais
//
// `padrao` é o nível de um módulo SEM regra própria. Ele existe porque
// admin não tem lista: `is_admin()` quer dizer tudo, inclusive módulos
// que ainda não existem. Antes esse fato era um `return OCULTO` aqui
// dentro - a política morava no JavaScript, longe do banco que decide
// todo o resto.
let _modulos = {};
let _padrao = OCULTO;

// Aceita o formato da 034 e também os dois anteriores. Migrations são
// aplicadas à mão: entre o deploy deste arquivo e a execução do SQL o
// banco ainda responde no formato velho, e a tela não pode quebrar
// nessa janela (.claude/rules/dados.md).
export function definirMapa(mapa) {
  if (!mapa || typeof mapa !== 'object') { _modulos = {}; _padrao = OCULTO; return; }

  if (mapa.modulos && typeof mapa.modulos === 'object') {   // 034 em diante
    _modulos = mapa.modulos;
    _padrao = mapa.padrao || OCULTO;
    return;
  }

  // Formato antigo: o objeto inteiro é o mapa de módulos. A chave '*' é
  // o sentinela da 033, que esta migration substituiu - lido aqui só
  // para atravessar a janela de deploy. Some quando a 034 estiver
  // aplicada em todos os bancos.
  const { '*': curingaAntigo, ...resto } = mapa;
  _modulos = resto;
  _padrao = curingaAntigo || OCULTO;
}

export function limparMapa() { _modulos = {}; _padrao = OCULTO; }

export function mapaAtual() { return { padrao: _padrao, modulos: { ..._modulos } }; }

// Nível efetivo num módulo: a regra própria vence o padrão. Nível
// desconhecido cai em oculto - esconder é a falha segura, e um valor
// estranho vindo do banco não pode abrir uma tela.
export function nivel(modulo) {
  const v = _modulos[modulo] ?? _padrao;
  return ORDEM[v] === undefined ? OCULTO : v;
}

export const podeVer      = (m) => ORDEM[nivel(m)] >= ORDEM[PROPRIOS];
export const veTudo       = (m) => ORDEM[nivel(m)] >= ORDEM[LEITURA];
export const podeEscrever  = (m) => nivel(m) === ESCRITA;
export const soProprios   = (m) => nivel(m) === PROPRIOS;

// Escrita no escopo: quem tem 'proprios' escreve dentro da própria
// escola. A view usa isto para decidir se mostra o botão de editar;
// o RLS (escreve_unidade) confirma na hora de gravar.
export const podeEscreverNaUnidade = (m, unidadeId, minhasUnidades = []) => {
  if (podeEscrever(m)) return true;
  return soProprios(m) && minhasUnidades.includes(unidadeId);
};
