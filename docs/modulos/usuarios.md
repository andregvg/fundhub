# Usuários & Acessos

> Quem pode entrar no FundHub e com qual papel.

## O que dá para fazer aqui

- Ver a lista de quem tem acesso (a allowlist) e o papel de cada pessoa.
- Adicionar, editar e remover acessos.
- Ajustar, pessoa a pessoa, o nível em módulos específicos.
- Ver quando cada pessoa entrou pela última vez.
- Ordenar a lista por qualquer coluna, buscar por nome ou e-mail e navegar por
  páginas quando ela ficar longa.

O histórico de alterações mudou de lugar: agora fica no módulo **Auditoria**.

## Quem pode o quê

Só administradores da SME abrem este módulo.

Cada acesso tem um **papel** (por exemplo, gestor escolar, equipe da SME,
transporte). O papel define, de uma vez, o nível da pessoa em cada módulo. Os
níveis são:

| Nível | O que permite |
|---|---|
| Oculto | O módulo não aparece - nem no menu, nem na tela, nem nos dados. |
| Próprios | Vê e mexe só no que é da própria escola. |
| Leitura | Vê tudo do módulo, não altera nada. |
| Escrita | Vê e altera tudo do módulo. |

## Passo a passo

### Encontrar um acesso na lista

1. Digite qualquer parte do nome, do e-mail ou do papel na caixa **Buscar na
   lista**. A lista vai estreitando enquanto você digita, sem precisar recarregar
   nada. Acento e maiúscula não atrapalham.
2. Para reorganizar, clique no título de uma coluna - por exemplo **Último
   acesso**, para ver primeiro quem entrou há mais tempo. Clicar de novo inverte
   a ordem.
3. A lista vem de 25 em 25. Use as setas no rodapé para avançar; ao lado delas
   fica a contagem ("1-25 de 63").

No celular a lista mostra só nome e papel. **Toque na linha** para abrir o resto
(e-mail, situação, segmentos, último acesso) e os botões de editar e remover.

### Adicionar um acesso

1. Clique em **Adicionar acesso**.
2. Informe o e-mail institucional da pessoa.
3. Escolha o **papel**. A descrição abaixo do campo explica o que ele libera.
4. Marque os **segmentos** em que a pessoa atua (Ensino Fundamental, Educação
   Infantil). Isso pré-preenche os filtros das telas para ela - não é
   restrição de acesso.
5. Se precisar de um ajuste fino, abra **Ver e ajustar** e mude o nível em
   módulos específicos. Use com parcimônia: exceção para muita gente é sinal de
   que falta um papel novo.
6. Salve.

## Regras que o sistema aplica

- **Só quem está na allowlist entra.** Ter um e-mail institucional não basta -
  o e-mail precisa estar cadastrado aqui.
- **O nível decide o que a pessoa consegue ler de fato**, não só o que aparece
  na tela. Esconder um botão é conforto; a barreira é o banco de dados.
- **Toda mudança de acesso fica registrada.** Trocar o papel de alguém, desativar
  um acesso ou criar uma exceção aparece no módulo **Auditoria**, com quem fez e
  quando. Esse registro não se apaga.

## Ligações com outros módulos

- O papel definido aqui vale em **todos** os módulos ao mesmo tempo.
- Os **segmentos de atuação** aparecem pré-marcados no filtro de segmento de
  Escolas, Servidores, Calendário e outras telas.
- Uma pessoa pode ser ligada ao seu cadastro de **servidor** - assim o sistema
  sabe que "quem entra" e "quem é" são a mesma pessoa, e "Meus dados" mostra o
  cargo e o local de trabalho dela.
- **Auditoria** guarda o histórico: o que mudou em cada acesso, quem mudou e
  quando, além de todas as entradas no sistema.

## Perguntas frequentes

**Adicionei o acesso e a pessoa continua sem ver nada.**
Confirme o papel: um papel de leitor mínimo enxerga poucas telas. E confirme
que o e-mail está exatamente igual ao que a pessoa usa para entrar.

**Posso dar acesso a um e-mail que não seja institucional?**
Não. O login do FundHub é restrito ao domínio da Secretaria.

> Atualizado na versão 0.24.0.
