// ============================================================
// FundHub — core/segmentos.js  (segmentos de ensino)
// Vocabulário único dos segmentos e das combinações que a rede usa
// no dia a dia. Fica no kernel porque QUASE todo módulo filtra por
// segmento — e todos precisam concordar sobre o que "Educação
// Infantil" significa.
//
// O banco só conhece os segmentos-BASE (ver migration 021). As
// combinações abaixo são atalhos de interface: expandem para os
// básicos na hora de filtrar. Isso evita ter que migrar o banco toda
// vez que a Secretaria inventar um novo agrupamento.
// ============================================================

// Segmentos-base. O `codigo` é o que está em unidade_escolar.segmento
// (mais 'EJA', que vem da flag tem_eja).
export const SEGMENTOS = [
  { codigo: 'EMEF',       rotulo: 'EMEF',        ico: '📗' },
  { codigo: 'EJA',        rotulo: 'EJA',         ico: '🌙' },
  { codigo: 'CEI',        rotulo: 'CEI',         ico: '🧸' },
  { codigo: 'EMEI',       rotulo: 'EMEI',        ico: '🎨' },
  { codigo: 'CONVENIADA', rotulo: 'Conveniadas', ico: '🤝' },
];

export const CODIGOS = SEGMENTOS.map(s => s.codigo);

export const rotulaSegmento = (c) =>
  SEGMENTOS.find(s => s.codigo === c)?.rotulo || c;

// Atalhos: um clique marca vários segmentos-base de uma vez.
// A ordem é a que aparece na interface.
export const ATALHOS = [
  { id: 'fundamental', rotulo: 'Ensino Fundamental', segmentos: ['EMEF', 'EJA'] },
  { id: 'infantil',    rotulo: 'Educação Infantil',  segmentos: ['CEI', 'EMEI', 'CONVENIADA'] },
  { id: 'todas',       rotulo: 'Todas',              segmentos: [...CODIGOS] },
];

// Normaliza qualquer entrada (string solta, atalho, lista mista) para
// uma lista de segmentos-base sem repetição, na ordem canônica.
export function expandir(sel) {
  if (!sel) return [];
  const bruto = Array.isArray(sel) ? sel : [sel];
  const out = new Set();
  for (const item of bruto) {
    const v = String(item || '').trim().toUpperCase();
    if (!v) continue;
    const atalho = ATALHOS.find(a => a.id.toUpperCase() === v || a.rotulo.toUpperCase() === v);
    if (atalho) { atalho.segmentos.forEach(s => out.add(s)); continue; }
    if (CODIGOS.includes(v)) out.add(v);
  }
  return CODIGOS.filter(c => out.has(c));
}

// Qual atalho a seleção representa exatamente (ou null se for uma
// combinação livre). Serve para destacar o botão certo na interface.
export function atalhoDe(sel) {
  const lista = expandir(sel);
  if (!lista.length) return null;
  return ATALHOS.find(a =>
    a.segmentos.length === lista.length && a.segmentos.every(s => lista.includes(s)))?.id || null;
}

// Os segmentos aos quais uma unidade pertence. Uma EMEF com EJA
// pertence aos DOIS — por isso devolve lista, não string. Espelha
// unidade_segmentos() no Postgres; se mudar aqui, mude lá.
export function segmentosDaUnidade(u) {
  if (!u) return [];
  const out = [];
  const base = String(u.segmento || '').trim().toUpperCase();
  if (base) out.push(base);
  if (u.tem_eja) out.push('EJA');
  return out;
}

// A unidade entra no recorte? Seleção vazia = sem recorte (tudo passa).
export function unidadeNoSegmento(u, sel) {
  const filtro = expandir(sel);
  if (!filtro.length) return true;
  return segmentosDaUnidade(u).some(s => filtro.includes(s));
}

// Rótulo curto para exibir a seleção corrente ("Educação Infantil",
// "EMEF + EJA", "Todas as unidades").
export function rotuloSelecao(sel) {
  const lista = expandir(sel);
  if (!lista.length) return 'Todos os segmentos';
  const atalho = atalhoDe(lista);
  if (atalho) return ATALHOS.find(a => a.id === atalho).rotulo;
  return lista.map(rotulaSegmento).join(' + ');
}
