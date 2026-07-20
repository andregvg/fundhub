# Changelog — FundHub

Registro das mudanças do Hub de Ferramentas do Ensino Fundamental (SME Ribeirão Preto).
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento **MINOR** = módulo novo ou mudança de modelo de dados, **PATCH** = correção.

> A versão exibida no rodapé do app vem de `src/core/config.js` (`CONFIG.versao`).
> Ao lançar: subir a versão lá **e** registrar aqui.

---

## [0.10.0] — 2026-07-19

Onda de **autorização e navegação**. O hub deixa de distinguir apenas
"admin / não-admin" e passa a ter permissões por módulo, com o mesmo mapa
valendo na interface **e** no banco.
Requer a migration **021** (no SQL Editor, depois da 020).

### Adicionado
- **Permissões por módulo** — mapa `módulo → nível` com quatro níveis:
  `oculto`, `proprios`, `leitura`, `escrita`. O nível vem do **papel**
  (preset em `papel_permissao`) e admite **exceção por pessoa**
  (`perfil.permissoes`). Papéis novos: Equipe SME, Transporte,
  Gestor(a) escolar — além de Administrador e Leitor. Um gestor escolar
  não vê Afastamentos nem no menu nem pela API. *(migration 021)*
- **Segmentos de atuação** — `perfil.segmentos`, com os básicos
  EMEF, EJA, CEI, EMEI e Conveniadas e os atalhos **Ensino Fundamental**
  (EMEF+EJA), **Educação Infantil** (CEI+EMEI+Conveniadas) e **Todas**.
  O filtro de segmento já abre **pré-preenchido** com a atuação da pessoa
  em Escolas, Servidores, Afastamentos, Visitas, Ocorrências, Horários,
  Projetos e SATE. É conveniência, não restrição: dá para ampliar na tela.
- **Menu lateral** agrupado (Módulos · Minha conta · Administração ·
  Documentação), com botão ☰ e **memória** do estado aberto/fechado.
  Os links do topo saíram — não cabiam mais.
- **Meus dados** (`#/meus-dados`) — a pessoa edita o próprio nome de
  exibição e, se o acesso estiver ligado a um cadastro de servidor,
  os próprios contatos e telefones. Sem senha: o acesso continua por
  link mágico ou conta Google.
- **Todos os Módulos** (`#/modulos`) — a antiga home de tiles. A tela
  inicial passou a ser a **Dashboard**.
- **Vínculo `perfil` ↔ `servidor`** — um acesso aponta para o cadastro
  funcional, evitando dado duplicado de quem é servidor e usuário.
- **Tela de acesso pendente** — quem autentica com e-mail institucional
  mas não está na allowlist agora recebe uma explicação, em vez de entrar
  num app de listas vazias bloqueadas em silêncio pelo RLS.
- **Máscara de telefone** com DDD, distinguindo fixo (8 dígitos) de
  celular (9), com DDD 16 assumido para quem digita só o número local.

### Alterado
- **Gestores & Coordenadores → Servidores** (`#/gestores` → `#/servidores`,
  com redirecionamento). O cadastro nunca foi só de gestão: agora cobre
  lotação na **sede** (equipe de acompanhamento, agentes administrativos),
  via `servidor.lotacao` e `servidor.cargo`. *(migration 021)*
- **Cards de Escolas e Servidores** exibem o **nome completo em caixa
  alta**, com o apelido abaixo — antes mostravam só o apelido.
- **Formulários** de escola e de servidor ganharam agrupamentos
  semânticos, e a gaveta ficou mais larga no desktop (560px, 680px em
  telas grandes) — os telefones não cabiam.
- **Servidores** ganhou RG, CPF e **código funcional** no formulário.
- **Botões** redesenhados no padrão discreto do GitHub: 32px de altura,
  borda de 1px, raio de 6px. O alvo de 40px do toque continua garantido
  por `@media (pointer: coarse)`.

### Corrigido
- O aviso "e-mail fora do domínio institucional" existia em `auth.js`
  mas **nunca era exibido** — `renderLogin` era chamado sem a flag.
- Telefones cadastrados sem DDD (`3626-1805`) eram exibidos como
  `(36) 2618-05`: a exibição passou a normalizar antes de formatar.

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
