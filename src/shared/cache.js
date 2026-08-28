// ============================================================
// FundHub - shared/cache.js
// Registro das funções que invalidam cache de model. Existe para o
// botão Atualizar do cabeçalho poder dizer "recarregue tudo" sem que
// o kernel precise conhecer módulo nenhum.
//
// A inversão é a mesma do core/registry.js: o kernel oferece o ponto
// de registro, os módulos se registram. A diferença é que o registry
// conhece manifestos e este não conhece nada - só guarda funções
// anônimas. Assim a R1 (kernel nunca importa modules/) fica intacta.
//
// Hoje são cinco models com cache: escolas, locais, servidores,
// vinculos (cargos) e sate/atividades.
// ============================================================

const registrados = new Set();

export function registrarCache(limpar) {
  if (typeof limpar === 'function') registrados.add(limpar);
}

// Uma função que lança não pode impedir as outras de rodar: cache
// meio limpo é pior que cache não limpo, porque a tela mistura dado
// velho com dado novo sem avisar.
export function limparCaches() {
  for (const limpar of registrados) {
    try { limpar(); }
    catch (err) { console.warn('[cache] falha ao invalidar:', err); }
  }
}

// Só para teste.
export function _reset() { registrados.clear(); }
