// Declaração de configuração do módulo Servidores. NÃO é model: não
// fala com o banco (quem fala é core/configuracoes.js) e não é API
// pública. É declaração + acessos, e o PADRÃO mora aqui, num lugar só.
import { pref } from '../../core/configuracoes.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal do servidor na lista.', padrao: false },
    { chave: 'cards_por_linha', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'numero', rotulo: 'Cards por linha (telas largas)',
      min: 1, max: 6, padrao: 3 },
  ],
};

export const mostrarTelefonesNoCard = () => pref('servidores', 'telefones_no_card') ?? false;
export const cardsPorLinha = () => {
  const n = Number(pref('servidores', 'cards_por_linha'));
  return Number.isFinite(n) ? Math.max(1, Math.min(6, Math.round(n))) : 3;
};
