# Usuários & Acessos

> Quem pode entrar no FundHub, com qual papel - e o histórico de tudo que foi
> alterado no sistema.

## O que dá para fazer aqui

- Ver a lista de quem tem acesso (a allowlist) e o papel de cada pessoa.
- Adicionar, editar e remover acessos.
- Ajustar, pessoa a pessoa, o nível em módulos específicos.
- Consultar o histórico de alterações (aba **Auditoria**).

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

### Adicionar um acesso

1. Na aba **Usuários**, clique em **Adicionar acesso**.
2. Informe o e-mail institucional da pessoa.
3. Escolha o **papel**. A descrição abaixo do campo explica o que ele libera.
4. Marque os **segmentos** em que a pessoa atua (Ensino Fundamental, Educação
   Infantil). Isso pré-preenche os filtros das telas para ela - não é
   restrição de acesso.
5. Se precisar de um ajuste fino, abra **Ver e ajustar** e mude o nível em
   módulos específicos. Use com parcimônia: exceção para muita gente é sinal de
   que falta um papel novo.
6. Salve.

### Consultar o histórico

1. Abra a aba **Auditoria**.
2. Filtre por módulo, por tipo de operação ou por autor.
3. Cada linha mostra o que mudou, com o valor antes e depois.

## Regras que o sistema aplica

- **Só quem está na allowlist entra.** Ter um e-mail institucional não basta -
  o e-mail precisa estar cadastrado aqui.
- **O nível decide o que a pessoa consegue ler de fato**, não só o que aparece
  na tela. Esconder um botão é conforto; a barreira é o banco de dados.
- **O histórico não se apaga.** Ninguém tem permissão para alterar ou remover
  registros de auditoria - nem por dentro do sistema, nem por acesso direto ao
  banco.

## Ligações com outros módulos

- O papel definido aqui vale em **todos** os módulos ao mesmo tempo.
- Os **segmentos de atuação** aparecem pré-marcados no filtro de segmento de
  Escolas, Servidores, Calendário e outras telas.
- Uma pessoa pode ser ligada ao seu cadastro de **servidor** - assim o sistema
  sabe que "quem entra" e "quem é" são a mesma pessoa, e "Meus dados" mostra o
  cargo e o local de trabalho dela.

## Perguntas frequentes

**Adicionei o acesso e a pessoa continua sem ver nada.**
Confirme o papel: um papel de leitor mínimo enxerga poucas telas. E confirme
que o e-mail está exatamente igual ao que a pessoa usa para entrar.

**Posso dar acesso a um e-mail que não seja institucional?**
Não. O login do FundHub é restrito ao domínio da Secretaria.

> Atualizado na versão 0.16.0.
