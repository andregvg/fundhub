// ============================================================
// FundHub - horarios/views/cargos.js
// Quais cargos compõem a equipe gestora. O `vinculo.papel` é texto
// livre, então sem esta lista o sistema não sabe responder "esta
// pessoa é gestora?" - e é essa resposta que decide quem aparece na
// grade por padrão.
//
// A tela é um PAINEL de configuração de rede (Bloco A): recebe um
// elemento onde desenhar, não abre modal. O MODEL mora em
// servidores/vinculos.model.js, que é o dono do domínio "cargo".
//
// Ao mudar aqui, a grade aberta atrás do modal de configuração NÃO
// repinta ao vivo - o cache do model já foi invalidado por
// definirCargoGestao, então a próxima abertura da escola lê fresco.
// Aceitável: configurar a equipe gestora é raro.
// ============================================================
import { getCargos, getCargosGestao, definirCargoGestao } from '../../servidores/vinculos.model.js';
import { esc } from '../../../shared/dom.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { toast } from '../../../shared/ui/toast.js';

export async function pintarCargosGestao(box) {
  if (!box) return;
  box.innerHTML = `
    <p class="form-hint">Cargo que não estiver ligado aqui não aparece por padrão
      na grade da escola nem entra no cálculo da cobertura. Ele continua podendo
      ser acrescentado escola a escola.</p>
    <div id="cg-lista">${loading()}</div>`;

  const lista = box.querySelector('#cg-lista');
  let cargos = [], gestao = new Set();
  try { [cargos, gestao] = await Promise.all([getCargos(), getCargosGestao()]); }
  catch (err) { lista.innerHTML = erroBox(err); return; }

  lista.innerHTML = cargos.length
    ? `<div class="cg-linhas">${cargos.map(c => `
        <label class="switch">
          <input type="checkbox" data-cargo="${esc(c)}" ${gestao.has(c) ? 'checked' : ''} />
          <span class="switch-trilho" aria-hidden="true"></span>
          <span class="switch-txt">${esc(c)}</span>
        </label>`).join('')}</div>`
    : `<p class="form-hint">Nenhum cargo em uso ainda. Registre um local de trabalho em Servidores.</p>`;

  lista.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cargo]'); if (!inp) return;
    inp.disabled = true;
    try {
      await definirCargoGestao(inp.dataset.cargo, inp.checked);
      toast({ titulo: 'Equipe gestora atualizada', texto: inp.dataset.cargo, tipo: 'sucesso' });
    } catch (err) {
      inp.checked = !inp.checked;      // desfaz o que o banco recusou
      reportarErro(err, { titulo: 'Não foi possível salvar' });
    } finally { inp.disabled = false; }
  });
}
