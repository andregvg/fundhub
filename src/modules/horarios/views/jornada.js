// ============================================================
// FundHub - horarios/views/jornada.js
// A semana inteira de UM servidor em UMA escola, numa gaveta só.
// Antes era um formulário de um bloco por vez, e montar a jornada de
// um gestor do zero custava cinco aberturas e dez cliques.
//
// Os campos de hora nascem VAZIOS. Antes vinham com 07:00/13:00
// chumbados, o que induzia a pessoa a aceitar um horário que não era
// o dela - pior que campo vazio, porque parece uma resposta.
//
// Sobreposição impede o salvamento; carga acima de 8h e mais de 6h
// contínuas ficam marcados e deixam salvar. Ver .claude/rules/dados.md.
// ============================================================
import { DIAS, criarBloco, atualizarBloco, excluirBloco, getBlocos,
  validarDia, totalDoDia, duracao } from '../horarios.model.js';
import { esc } from '../../../shared/dom.js';
import { ico } from '../../../shared/ui/icones.js';
import { drawerHead, abrirDrawer, fecharDrawer } from '../../../shared/ui/drawer.js';
import { confirmar } from '../../../shared/ui/confirmar.js';
import { toast } from '../../../shared/ui/toast.js';

const hhmm = (t) => String(t ?? '').slice(0, 5);
let estado = null;   // { servidor, unidadeId, dias: { [n]: linhas[] }, recarregar }

// Uma linha é { id?, inicio, fim, obs, excluir? }. `id` ausente = nova.
export function abrirJornada({ servidor, unidadeId, blocos, recarregar }) {
  const dias = {};
  for (const d of DIAS) {
    dias[d.n] = blocos
      .filter(b => b.servidor_id === servidor.id && b.dia_semana === d.n)
      .map(b => ({ id: b.id, inicio: hhmm(b.inicio), fim: hhmm(b.fim), obs: b.obs || '' }));
  }
  estado = { servidor, unidadeId, dias, recarregar };

  abrirDrawer(`
    ${drawerHead('Jornada da semana', esc(servidor.nome))}
    <div class="drawer-body">
      <form id="hj-form" class="esc-form">
        <div id="hj-dias"></div>
        <div class="form-foot">
          <span id="hj-msg" class="auth-msg"></span>
          <button type="submit" id="hj-save" class="btn-primary">Salvar jornada</button>
        </div>
      </form>
    </div>`);

  pintar();
  document.getElementById('hj-form').addEventListener('submit', salvar);
}

function pintar() {
  const box = document.getElementById('hj-dias');
  box.innerHTML = DIAS.map(d => {
    const linhas = estado.dias[d.n].filter(l => !l.excluir);
    const problemas = validarDia(linhas.filter(l => l.inicio && l.fim));
    const total = totalDoDia(linhas.filter(l => l.inicio && l.fim));
    return `<fieldset class="form-grupo hj-dia">
      <legend>${esc(d.nome)} ${total ? `<span class="hj-total">${esc(duracao(total))}</span>` : ''}</legend>
      <div class="hj-linhas">
        ${linhas.map((l, i) => `
          <div class="hj-linha" data-dia="${d.n}" data-i="${i}">
            <input type="time" class="hj-ini" value="${esc(l.inicio)}" aria-label="Início" />
            <span class="hj-ate">às</span>
            <input type="time" class="hj-fim" value="${esc(l.fim)}" aria-label="Fim" />
            <input type="text" class="hj-obs" value="${esc(l.obs)}" placeholder="observação (opcional)" />
            <button type="button" class="mini-btn no hj-del" aria-label="Remover bloco">${ico('excluir', { tam: 14 })}</button>
          </div>`).join('')
          || `<p class="form-hint">Sem jornada nesta ${esc(d.nome.toLowerCase())}.</p>`}
      </div>
      <button type="button" class="mini-btn hj-add" data-dia="${d.n}">${ico('adicionar', { tam: 14 })} bloco</button>
      ${problemas.map(p => `<p class="hj-prob n-${p.nivel}">
        ${ico(p.nivel === 'erro' ? 'erro' : 'atencao', { tam: 14 })} ${esc(p.texto)}</p>`).join('')}
    </fieldset>`;
  }).join('');

  box.querySelectorAll('.hj-add').forEach(b => b.addEventListener('click', () => {
    // Campos vazios de propósito - ver o cabeçalho deste arquivo.
    estado.dias[Number(b.dataset.dia)].push({ inicio: '', fim: '', obs: '' });
    pintar();
  }));
  box.querySelectorAll('.hj-del').forEach(b => b.addEventListener('click', () => {
    const linha = b.closest('.hj-linha');
    const dia = Number(linha.dataset.dia);
    const alvo = estado.dias[dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
    if (alvo.id) alvo.excluir = true;               // já existe no banco
    else estado.dias[dia] = estado.dias[dia].filter(l => l !== alvo);
    pintar();
  }));
  // Redesenha ao mudar a hora para os avisos acompanharem o que se digita.
  box.addEventListener('change', (e) => {
    const linha = e.target.closest('.hj-linha'); if (!linha) return;
    const dia = Number(linha.dataset.dia);
    const alvo = estado.dias[dia].filter(l => !l.excluir)[Number(linha.dataset.i)];
    alvo.inicio = linha.querySelector('.hj-ini').value;
    alvo.fim = linha.querySelector('.hj-fim').value;
    alvo.obs = linha.querySelector('.hj-obs').value;
    pintar();
  });
}

async function salvar(e) {
  e.preventDefault();
  const msg = document.getElementById('hj-msg');
  msg.className = 'auth-msg'; msg.textContent = '';

  // Validação de campo: inline, junto do formulário.
  for (const d of DIAS) {
    const linhas = estado.dias[d.n].filter(l => !l.excluir);
    for (const l of linhas) {
      if (!l.inicio || !l.fim) {
        msg.classList.add('err');
        msg.textContent = `${d.nome}: informe início e fim de todos os blocos.`;
        return;
      }
      if (l.fim <= l.inicio) {
        msg.classList.add('err');
        msg.textContent = `${d.nome}: o fim precisa ser depois do início.`;
        return;
      }
    }
    const erro = validarDia(linhas).find(p => p.nivel === 'erro');
    if (erro) { msg.classList.add('err'); msg.textContent = `${d.nome}: ${erro.texto}`; return; }
  }

  const btn = document.getElementById('hj-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    for (const d of DIAS) {
      for (const l of estado.dias[d.n]) {
        const payload = {
          servidor_id: estado.servidor.id,
          unidade_id: estado.unidadeId,
          dia_semana: d.n,
          inicio: l.inicio,
          fim: l.fim,
          obs: l.obs.trim() || null,
        };
        if (l.excluir && l.id) await excluirBloco(l.id);
        else if (l.id) await atualizarBloco(l.id, payload);
        else if (!l.excluir) await criarBloco(payload);
      }
    }
    fecharDrawer();
    await estado.recarregar();
    toast({ titulo: 'Jornada salva', texto: estado.servidor.nome, tipo: 'sucesso' });
  } catch (err) {
    toast({ titulo: 'Não foi possível salvar a jornada', texto: err.message || String(err), tipo: 'erro' });
    btn.disabled = false; btn.textContent = 'Salvar jornada';
  }
}
