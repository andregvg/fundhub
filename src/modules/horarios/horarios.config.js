// Declaração de configuração do módulo Horários. NÃO é model. Itens de
// rede: quais cargos são equipe gestora, a janela de cobertura por tipo
// de escola e o dia da semana de cada escala. Os painéis moram em
// views/ (cargos.js e este arquivo); os acessos, aqui.
import { pintarCargosGestao } from './views/cargos.js';

export const DECLARACAO = {
  itens: [
    { chave: 'cargos_gestao', escopo: 'rede', grupo: 'regras',
      rotulo: 'Equipe gestora',
      dica: 'Quais cargos entram na grade e na cobertura por padrão.',
      painel: pintarCargosGestao },
  ],
};
