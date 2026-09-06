// Declaração de configuração do módulo Escolas. NÃO é model: não fala
// com o banco (quem fala é core/configuracoes.js e escolas.model.js) e
// não é API pública. É declaração + acessos + o painel dos locais
// internos, e o PADRÃO mora aqui, num lugar só.
import { pref } from '../../core/configuracoes.js';
import {
  getLocaisInternos, criarLocalInterno, renomearLocalInterno, excluirLocalInterno,
} from './escolas.model.js';
import { esc } from '../../shared/dom.js';
import { ico } from '../../shared/ui/icones.js';
import { toast } from '../../shared/ui/toast.js';
import { confirmar } from '../../shared/ui/confirmar.js';
import { loading, erroBox } from '../../shared/ui/feedback.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal da escola na lista.', padrao: false },
    { chave: 'locais_internos', escopo: 'rede', grupo: 'regras',
      rotulo: 'Locais de trabalho internos',
      dica: 'Gerências, subsecretarias e coordenadorias da SME onde há servidores lotados. As escolas se cadastram na própria tela.',
      painel: pintarLocaisInternos },
  ],
};

export const mostrarTelefonesNoCard = () => pref('escolas', 'telefones_no_card') ?? false;

async function pintarLocaisInternos(box) {
  if (!box) return;
  box.innerHTML = loading();
  let lista;
  try { lista = await getLocaisInternos(); }
  catch (err) { box.innerHTML = erroBox(err); return; }

  box.innerHTML = `
    <div class="cfg-locais">
      ${lista.map(l => `
        <div class="cfg-local esc-row" data-id="${esc(l.id)}">
          <input class="cfg-local-nome" value="${esc(l.nome)}" aria-label="Nome de ${esc(l.nome)}" />
          ${l.tipo === 'sede'
            ? '<span class="form-hint">fallback</span>'
            : `<button type="button" class="mini-btn no cfg-local-del" aria-label="Excluir ${esc(l.nome)}"${
                l.vinculos ? ' disabled title="Há servidores neste local"' : ''}>${ico('excluir', { tam: 14 })}</button>`}
        </div>`).join('')}
      <form class="cfg-local-novo esc-row">
        <input id="cfg-local-add" placeholder="Nova gerência / subsecretaria" aria-label="Nome do novo local interno" />
        <button type="submit" class="mini-btn" aria-label="Adicionar local interno">${ico('adicionar', { tam: 14 })}</button>
      </form>
    </div>`;

  box.querySelectorAll('.cfg-local-nome').forEach(inp => {
    inp.addEventListener('change', async () => {
      const id = inp.closest('[data-id]').dataset.id;
      try {
        await renomearLocalInterno(id, inp.value);
        toast({ titulo: 'Nome atualizado', tipo: 'sucesso' });
      } catch (err) {
        toast({ titulo: 'Não foi possível renomear', texto: err.message || String(err), tipo: 'erro' });
        pintarLocaisInternos(box);
      }
    });
  });

  box.querySelectorAll('.cfg-local-del').forEach(b => {
    b.addEventListener('click', async () => {
      const linha = b.closest('[data-id]');
      const ok = await confirmar('Excluir este local de trabalho?', {
        detalhe: 'Só é possível se nenhum servidor estiver lotado aqui.',
        textoOk: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try {
        await excluirLocalInterno(linha.dataset.id);
        toast({ titulo: 'Local excluído', tipo: 'sucesso' });
        pintarLocaisInternos(box);
      } catch (err) {
        toast({ titulo: 'Não foi possível excluir', texto: err.message || String(err), tipo: 'erro' });
      }
    });
  });

  box.querySelector('.cfg-local-novo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = document.getElementById('cfg-local-add');
    if (!inp.value.trim()) return;
    try {
      await criarLocalInterno(inp.value);
      inp.value = '';
      pintarLocaisInternos(box);
      toast({ titulo: 'Local adicionado', tipo: 'sucesso' });
    } catch (err) {
      toast({ titulo: 'Não foi possível adicionar', texto: err.message || String(err), tipo: 'erro' });
    }
  });
}
