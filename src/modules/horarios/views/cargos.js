// ============================================================
// FundHub - horarios/views/cargos.js
// Quais cargos compõem a equipe gestora. O `vinculo.papel` é texto
// livre, então sem esta lista o sistema não sabe responder "esta
// pessoa é gestora?" - e é essa resposta que decide quem aparece na
// grade por padrão.
//
// A tela mora aqui, e não em Servidores, porque Horários é o único
// consumidor e Servidores não tem hoje nenhuma superfície de gestão
// de cargos. O MODEL mora em servidores/vinculos.model.js, que é o
// dono do domínio.
// ============================================================
import { getCargos, getCargosGestao, definirCargoGestao } from '../../servidores/vinculos.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { loading, erroBox, reportarErro } from '../../../shared/ui/feedback.js';
import { drawerHead, abrirDrawer } from '../../../shared/ui/drawer.js';
import { toast } from '../../../shared/ui/toast.js';

export async function abrirCargos({ recarregar }) {
  abrirDrawer(`
    ${drawerHead('Equipe gestora', 'Quais cargos entram na grade e na cobertura')}
    <div class="drawer-body">
      <p class="form-hint">Cargo que não estiver ligado aqui não aparece por padrão
        na grade da escola nem entra no cálculo da cobertura. Ele continua podendo
        ser acrescentado escola a escola.</p>
      <div id="cg-lista">${loading()}</div>
    </div>`);

  const box = document.getElementById('cg-lista');
  let cargos = [], gestao = new Set();
  try { [cargos, gestao] = await Promise.all([getCargos(), getCargosGestao()]); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  box.innerHTML = cargos.length
    ? `<div class="cg-linhas">${cargos.map(c => `
        <label class="switch cg-linha">
          <input type="checkbox" data-cargo="${esc(c)}" ${gestao.has(c) ? 'checked' : ''} />
          <span class="switch-trilho" aria-hidden="true"></span>
          <span class="switch-txt">${esc(c)}</span>
        </label>`).join('')}</div>`
    : `<p class="form-hint">Nenhum cargo em uso ainda. Cadastre um vínculo em Servidores.</p>`;

  box.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-cargo]'); if (!inp) return;
    inp.disabled = true;
    try {
      await definirCargoGestao(inp.dataset.cargo, inp.checked);
      toast({ titulo: 'Equipe gestora atualizada', texto: inp.dataset.cargo, tipo: 'sucesso' });
      await recarregar();
    } catch (err) {
      inp.checked = !inp.checked;      // desfaz o que o banco recusou
      reportarErro(err, { titulo: 'Não foi possível salvar' });
    } finally { inp.disabled = false; }
  });
}
