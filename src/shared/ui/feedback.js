// ============================================================
// FundHub - shared/ui/feedback.js
// Estados de carregamento, vazio e erro. Um único visual para todos
// os módulos: se mudar aqui, muda no hub inteiro.
// ============================================================
import { esc, falha } from '../dom.js';
import { toast } from './toast.js';

export const loading = (txt = 'Carregando…') => `<div class="loading">${esc(txt)}</div>`;

export const emptyState = (ico, titulo, msg = '') => `
  <div class="empty">
    <div class="empty-ico">${ico}</div>
    <h3>${esc(titulo)}</h3>
    ${msg ? `<p>${msg}</p>` : ''}
  </div>`;

// Erro amigável (a mensagem crua do Supabase entra escapada).
export const erroBox = (err) =>
  `<p class="count">Não foi possível carregar: ${esc(err?.message || err)}</p>`;

// Erros que a pessoa consegue corrigir no formulário que está aberto na
// frente dela. Códigos do Postgres, no mesmo idioma que escolas.model.js
// e afastamentos.model.js já usam para 42P01/42703.
const CORRIGIVEL = new Set([
  '23505',   // unique_violation   - número de ata repetido, segundo vínculo aberto
  '23514',   // check_violation    - valor fora do domínio permitido
  '23502',   // not_null_violation - campo obrigatório vazio
]);

// Frase genérica em português por código, para quando o model NÃO
// traduziu o erro (não tem `.amigavel = true`). Nunca adivinhamos pela
// aparência da mensagem - heurística de string sobre texto de erro é
// frágil e falha em silêncio.
const GENERICA = {
  '23505': 'Já existe um registro com esses dados. Confira os campos.',
  '23502': 'Um campo obrigatório ficou em branco.',
  '23514': 'Um dos valores não é aceito neste campo.',
};

// Erro de gravação: inline quando dá para consertar ali, toast quando não dá.
// Rede, chave estrangeira (23503) e permissão negada pelo RLS (42501) não se
// consertam no formulário - e a gaveta pode fechar antes de a pessoa ler.
//
// Contrato de tradução: o texto cru do Postgres é em inglês e não vai
// para a tela. Um model que traduziu o erro marca `err.amigavel = true`
// junto com `err.code` - só aí `err.message` aparece inline. Sem isso,
// mostramos a frase genérica do código e o texto cru vai só para o
// console (para quem for depurar, não para o gestor escolar).
export function reportarErro(err, { msg, titulo = 'Não foi possível salvar' } = {}) {
  const cru = err?.message || String(err);
  if (msg && CORRIGIVEL.has(err?.code)) {
    if (err?.amigavel) { falha(msg, cru); return; }
    console.warn('[reportarErro] mensagem crua do banco, sem tradução:', cru);
    falha(msg, GENERICA[err.code] || 'Não foi possível salvar. Confira os campos.');
    return;
  }
  toast({ titulo, texto: cru, tipo: 'erro' });
}
