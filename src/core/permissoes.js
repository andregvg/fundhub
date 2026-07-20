// ============================================================
// FundHub — core/permissoes.js  (autorização por módulo)
// Substitui o antigo "admin sim / admin não" por um mapa
// módulo → nível, que vem do banco (meu_mapa_permissoes) e é a
// MESMA fonte que o RLS consulta. Ver migration 021.
//
// Os quatro níveis:
//   oculto   — o módulo não existe para essa pessoa.
//   proprios — vê e mexe só no que é da própria escola/cadastro.
//   leitura  — vê tudo do módulo, não escreve.
//   escrita  — vê e escreve tudo.
//
// Regra de ouro deste arquivo: ele decide o que APARECE. Quem decide
// o que a pessoa consegue LER de fato é o RLS. Se os dois
// discordarem, o banco vence — e é assim que tem que ser.
// ============================================================

export const OCULTO = 'oculto';
export const PROPRIOS = 'proprios';
export const LEITURA = 'leitura';
export const ESCRITA = 'escrita';

// Ordem crescente de poder — permite comparar níveis sem if aninhado.
const ORDEM = { [OCULTO]: 0, [PROPRIOS]: 1, [LEITURA]: 2, [ESCRITA]: 3 };

export const NIVEIS = [
  { valor: OCULTO,   rotulo: 'Oculto',   desc: 'Não aparece no menu nem na API.' },
  { valor: PROPRIOS, rotulo: 'Próprios', desc: 'Só o que é da própria escola.' },
  { valor: LEITURA,  rotulo: 'Leitura',  desc: 'Vê tudo, não edita.' },
  { valor: ESCRITA,  rotulo: 'Escrita',  desc: 'Vê e edita tudo.' },
];

export const rotulaNivel = (n) => NIVEIS.find(x => x.valor === n)?.rotulo || 'Oculto';

// O mapa do usuário logado. Preenchido no boot por perfil.js.
let _mapa = {};

export function definirMapa(mapa) {
  _mapa = mapa && typeof mapa === 'object' ? mapa : {};
}

export function limparMapa() { _mapa = {}; }

export function mapaAtual() { return { ..._mapa }; }

// Nível efetivo num módulo. Módulo desconhecido = oculto: a política
// segura por omissão é esconder, não mostrar.
export function nivel(modulo) {
  const v = _mapa[modulo];
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
