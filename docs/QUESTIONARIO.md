# Questionário — paradigmas do FundHub

Perguntas cujas respostas **mudam a arquitetura**, não só a tela. Estão
agrupadas por tema e, em cada uma, explico *por que* a resposta importa —
para você poder me dizer "essa não importa, toca o barco".

Responda direto no arquivo, embaixo de cada pergunta. Não precisa
responder tudo de uma vez: os temas são independentes.

---

## 1. Fonte da verdade

O FundHub hoje é um espelho de coisas que vivem em outros lugares
(planilhas do Drive, SAE, folha). Isso é sustentável enquanto o espelho
for só de leitura. Quando os dois lados passam a ser editáveis, alguém
precisa ganhar a disputa — e isso é decisão sua, não técnica.

1. **Para cada domínio abaixo, quem é a fonte da verdade: o FundHub ou a
   planilha/sistema externo?**
   - Cadastro de escolas →
   - Cadastro de servidores e lotações →
   - Afastamentos →
   - Calendário escolar →
   - Solicitações de transporte (SATE) →

2. **Onde você aceitaria que o FundHub passasse a ser o original**, com a
   planilha virando cópia (ou deixando de existir)?

3. **Existe alguém que edita as planilhas e não vai usar o FundHub?**
   Se sim, o espelho tem que continuar de mão dupla — o que é bem mais
   caro do que só importar.

4. **Quando o dado diverge** (a planilha diz uma coisa, o FundHub outra),
   o que deve acontecer: o FundHub sobrescreve, avisa e pede decisão, ou
   guarda os dois e marca o conflito?

---

## 2. Integração com o Drive

Hoje o FundHub **não lê o Drive** — os afastamentos entram por
copiar-e-colar. Isso foi uma decisão de segurança consciente (ver o
comentário em `afastamentos.view.js`), não uma limitação esquecida.

5. **Quantas planilhas você quer sincronizar, e com que frequência?**
   Uma vez por dia é um problema; a cada minuto é outro bem diferente.

6. **Essas planilhas contêm dado pessoal de servidor** (CPF, RG, laudo
   médico, motivo de licença)? Isso decide se dá para usar link público
   ou se exige conta de serviço.

7. **Quem é o dono das planilhas** — a sua conta pessoal, uma conta
   institucional, ou uma pasta compartilhada da Secretaria? Uma conta de
   serviço precisa ser convidada, e isso pode depender da TI da prefeitura.

8. **Você tem (ou consegue) permissão para criar uma conta de serviço no
   Google Cloud da prefeitura?** Se não, o caminho é outro (Apps Script
   publicado como Web App com token).

9. **A sincronização deve ser só de leitura, ou o FundHub também
   escreveria de volta na planilha?**

10. **O que acontece com uma linha que some da planilha?** Foi apagada
    por engano, foi cancelada, ou nunca deveria ter existido? Hoje o
    upsert nunca remove nada — o que é seguro, mas acumula lixo.

---

## 3. Permissões e papéis

Acabei de introduzir cinco papéis com um mapa módulo → nível. Os presets
que escrevi são um palpite meu.

11. **A lista de papéis está certa?** (Administrador, Equipe SME,
    Transporte, Gestor(a) escolar, Leitor). Falta algum — supervisão de
    ensino, direção de departamento, secretaria escolar, estagiário?

12. **Um gestor escolar deve ver os dados da própria escola apenas, ou
    também os das escolas "vizinhas" da mesma regional?**

13. **Coordenador e diretor da mesma escola têm o mesmo acesso**, ou o
    diretor vê coisas que o coordenador não vê?

14. **Quem cria acesso novo?** Só você, ou a Secretaria vai querer
    delegar isso para alguém sem dar poder total?

15. **Um gestor deve conseguir ver os próprios afastamentos?** Hoje sim
    (a policy libera o registro cujo `servidor_id` é o dele), mas o
    módulo inteiro está oculto para ele — então na prática não vê.
    Isso está certo?

16. **Existe dado que nem o administrador deveria ver sem deixar
    rastro?** (Laudo médico, motivo de licença, processo
    disciplinar.) Hoje a auditoria registra escrita, não leitura.

---

## 4. Segmentos e calendário

17. **O calendário escolar é único para a rede, ou cada segmento tem o
    seu?** Hoje `dia_calendario` tem a data como chave primária — ou
    seja, um calendário só. Se o EJA tem dias letivos próprios, isso é
    uma mudança de modelo (e é a razão de o filtro de segmento não ter
    entrado no Calendário).

18. **Uma escola pode mudar de segmento** (uma EMEI virar CEI, uma EMEF
    passar a ofertar EJA)? Se sim, o histórico anterior deve continuar
    associado ao segmento antigo?

19. **"Conveniadas" são escolas da rede ou entidades externas?** Isso
    muda o que faz sentido cadastrar sobre elas.

20. **A regional importa como recorte**, junto com o segmento? Hoje ela
    existe no banco mas quase não aparece nas telas.

---

## 5. Tempo e ciclo de vida

O FundHub tem `ano` em vínculos e horários, mas a maior parte das telas
assume o ano corrente.

21. **O que precisa ser consultável de anos anteriores** — e por quem?
    Vínculos, horários, afastamentos, ocorrências, todos?

22. **O que acontece na virada do ano letivo?** Os vínculos são
    recriados à mão, copiados do ano anterior, ou importados de algum
    lugar? Hoje isso é trabalho manual para 144 escolas.

23. **Um servidor que sai da rede** deve ser excluído, inativado, ou
    mantido com o vínculo encerrado? Hoje excluir apaga os afastamentos
    e horários dele junto (cascade) — o que talvez você não queira.

24. **Existe algum dado que precisa ser apagado por obrigação legal**
    depois de um prazo?

---

## 6. Operação real

25. **Onde o FundHub é usado de fato**: computador da SME, celular na
    visita à escola, ou os dois? Isso muda bastante as prioridades de
    interface.

26. **A conexão é confiável nos lugares de uso?** Se a equipe usa em
    visita técnica com internet ruim, funcionar offline deixa de ser
    luxo.

27. **Quantas pessoas você espera que usem**, e em que proporção entre
    equipe da SME e gestores das 144 escolas?

28. **Qual tarefa hoje consome mais tempo da sua equipe** e ainda não
    tem apoio no FundHub?

29. **Existe algum relatório que você monta à mão hoje** — recorrente,
    para a chefia ou para outro órgão — que valeria a pena o sistema
    gerar?

30. **O que acontece se o FundHub sair do ar por um dia?** A resposta
    diz o quanto vale investir em resiliência e backup.

---

## 7. Rumo

31. **O FundHub deve continuar restrito à Gerência de Ensino
    Fundamental**, ou há chance de outras gerências (Infantil, Especial,
    Administrativo) adotarem? Isso muda o modelo de permissões de novo.

32. **Os gestores escolares vão de fato entrar no sistema**, ou o acesso
    deles é mais teórico do que real? Se for real, a experiência de
    primeiro acesso merece muito mais cuidado.

33. **Existe algum sistema oficial da prefeitura com o qual o FundHub
    vai precisar conversar** — SAE, folha, protocolo? Existe API, ou
    seria raspagem/exportação manual?

34. **O que te deixaria confortável para dizer que o FundHub é o sistema
    oficial da Gerência**, e não uma ferramenta pessoal sua? (Backup,
    documentação, alguém além de você conseguindo manter, aval formal…)

35. **Se você tivesse que abandonar o projeto amanhã**, o que precisaria
    estar pronto para outra pessoa assumir?
