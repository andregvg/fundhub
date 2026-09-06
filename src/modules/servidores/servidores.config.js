// Declaração de configuração do módulo Servidores. NÃO é model: não
// fala com o banco (quem fala é core/configuracoes.js) e não é API
// pública. É declaração + acessos, e o PADRÃO mora aqui, num lugar só.
import { pref } from '../../core/configuracoes.js';

export const DECLARACAO = {
  itens: [
    { chave: 'telefones_no_card', escopo: 'usuario', grupo: 'exibicao',
      tipo: 'switch', rotulo: 'Exibir telefone no card',
      dica: 'Mostra o telefone principal do servidor na lista.', padrao: false },
  ],
};

export const mostrarTelefonesNoCard = () => pref('servidores', 'telefones_no_card') ?? false;
