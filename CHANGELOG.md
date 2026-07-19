# Changelog — FundHub

Registro das mudanças do Hub de Ferramentas do Ensino Fundamental (SME Ribeirão Preto).
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento **MINOR** = módulo novo ou mudança de modelo de dados, **PATCH** = correção.

> A versão exibida no rodapé do app vem de `src/core/config.js` (`CONFIG.versao`).
> Ao lançar: subir a versão lá **e** registrar aqui.

---

## [0.9.0] — 2026-07-15

Onda de **integridade de dados** e fechamento dos módulos de rotina.
Requer as migrations **016 → 020** (nesta ordem, no SQL Editor).

### Adicionado
- **Telefones** — tabela dedicada `telefone`, fonte única para escolas **e** servidores,
  com tipo, rótulo e telefone principal. Editor reutilizável em Escolas e Gestores.
  Antes, escola tinha um array e servidor um único telefone. *(migration 016)*
- **Locais** — catálogo de destinos (endereço, ponto de desembarque, coordenadas),
  usado pelas atividades e solicitações do SATE. É a base do futuro cálculo de rota.
  Vive como aba admin dentro do SATE. *(migration 017)*
- **Afastamentos — visão Calendário**: grade mensal com um chip por servidor afastado,
  colorido por tipo, sobreposto ao **evento previsto no calendário escolar**.
- **Afastamentos — sincronização com a planilha do Drive**: espelha a aba “Lançamentos”
  (que segue recebendo os lançamentos e as respostas do formulário dos gestores).
  Idempotente por `chave_externa` — re-sincronizar atualiza, nunca duplica.
  Gestores sem cadastro são ignorados e listados. *(migration 020)*
- **Calendário — edição por intervalo**: aplica a configuração de um dia a todo um
  período (recesso, feriados, semana de provas) de uma vez.
- **Calendário — importação**: cola-se TSV/CSV com cabeçalho e os dias são criados
  ou atualizados; dispensa gerar seed para atualizar o calendário.
- **Auditoria consolidada** — migration que religa o gatilho em todas as tabelas
  auditáveis; idempotente e à prova de tabela ausente. *(migration 019)*
- **Versão e changelog** — versão no rodapé e este arquivo.

### Alterado
- **Afastamentos: ciclo de vida completo** — `ativo`, `importado` (aguardando
  confirmação) e `cancelado`. Cancelar deixou de apagar: preserva histórico e
  auditoria, com reativar e excluir definitivo à parte. *(migration 018)*
- **Afastamentos: vocabulário de tipos** ampliado para cobrir também os da planilha
  (entram *Falta Abonada* e *TRE*), evitando perda de registro na sincronização.
- **Afastamentos**: campo de processo com detecção de duplicata (mesmo servidor e
  início, ou mesmo processo), contagem de dias e busca.
- **Afastamentos**: avisa ao registrar em dia marcado como “não conceder afastamentos”.
- `vw_escola_pessoas` passou a ler o telefone principal da tabela nova, com queda
  para o campo legado.
- **SATE**: desenvolvimento **pausado** a pedido da coordenação — o módulo segue
  funcional; a evolução das regras foi suspensa.

### Corrigido
- Os chips do calendário de afastamentos abriam o formulário de edição para
  qualquer usuário autorizado; agora só administradores editam.
- Afastamentos deixava a tela inteira em erro quando a migration ainda não tinha
  rodado; agora a leitura degrada e as escritas explicam o que falta.
- Recuperação do repositório após uma interrupção que corrompeu `HEAD`, o índice e
  três arquivos de trabalho.

### Notas de migração
Rodar no SQL Editor, em ordem: `016_telefone.sql`, `017_local.sql`,
`018_afastamento_extra.sql`, `019_auditoria_completa.sql`, `020_afastamento_sync.sql`.
Todas são idempotentes; 016 e 017 fazem o backfill sozinhas. As colunas legadas de
telefone seguem no banco como reserva e serão removidas em versão futura.

---

## [0.8.0] — 2026-07-14

### Adicionado
- **Projetos & Pesquisas** — cadastro dos projetos ofertados às escolas e
  manifestação de interesse de cada unidade. *(migration 015)*
- **Notificações multi-módulo** — o sino passou a cobrir também afastamentos e
  ocorrências, além das solicitações de transporte. *(migration 014)*
- **Usuários & Acessos** com **auditoria** — visualizador do histórico de alterações
  (antes, depois e diferença campo a campo) e registro de último acesso. *(migration 011)*
- **Atas de Atendimento** com impressão em papel timbrado e numeração anual. *(013)*
- **Relatórios de Visita Técnica**. *(migration 012)*
- **Ocorrências** — atendimentos telefônicos da recepção. *(migration 010)*
- **Gestores & Coordenadores** e **Horários de Trabalho**. *(migration 009)*
- **Documentação** interna do sistema, em `#/docs`.

### Alterado
- **Arquitetura reorganizada em fatias verticais** — uma pasta por módulo sobre um
  núcleo que não conhece módulo algum. Substituiu a divisão por tipo de arquivo.

---

## [0.7.0] — 2026-07-14

### Adicionado
- **Calendário Escolar** com bloqueio de datas, consultado pelo SATE. *(migration 007)*
- **Afastamentos** (primeira versão) e painel no Dashboard. *(migration 008)*
- **Programação de Viagens** (antes “romaneio”), imprimível.
- **Notificações em tempo real** e controle de saldo da frota. *(migration 006)*
- **Escolas**: cadastro completo pelo administrador.
- **SATE**: atividade livre e transporte adaptado. *(migration 005)*

---

## [0.5.0] — 2026-07-13

### Adicionado
- **SATE** — solicitação de transporte extraclasse: a escola pede, a SME valida. *(004)*
- **Dashboard do dia** e login com Google.
- **Segurança** — RLS com negativa por padrão, login institucional e lista de
  leitura autorizada; publicação automática em produção e ambiente de testes.

---

## [0.1.0] — 2026-07-13

### Adicionado
- Primeira versão do hub e do módulo **Escolas**.

### Segurança
- Dados reais retirados do repositório e histórico reescrito; o repositório é
  público e nenhum dado sensível pode ser versionado.
