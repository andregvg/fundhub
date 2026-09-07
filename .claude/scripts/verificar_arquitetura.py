#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FundHub - verificacao arquitetural deterministica.

Doze checagens mecanicas das regras de CLAUDE.md e .claude/rules/.
Nao substitui revisao: cobre o que da para verificar sem julgamento.

Uso:
    python .claude/scripts/verificar_arquitetura.py
    python .claude/scripts/verificar_arquitetura.py --so-pii    # so a varredura de segredo/PII

Saida: exit 0 se nao ha violacao bloqueante; exit 1 se ha.
Avisos (limite de linhas, consistencia do registro) nao alteram o exit code.

Supressao de falso positivo: escreva `fundhub:ok-<n>` na propria linha
(ex.: `// fundhub:ok-8 numero ficticio de exemplo`) - sempre com o motivo.
"""

import os
import re
import subprocess
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(RAIZ, 'src')

# Limites da regra R11.
LIMITE_VIEW = 400
LIMITE_MODEL = 250

IGNORAR_DIRS = {'.git', 'node_modules', '_private'}

problemas = []   # (severidade, check, arquivo, linha, mensagem)


def add(sev, check, arquivo, linha, msg):
    rel = os.path.relpath(arquivo, RAIZ).replace('\\', '/')
    problemas.append((sev, check, rel, linha, msg))


def arquivos(base, ext=None):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in IGNORAR_DIRS]
        for f in filenames:
            if ext is None or f.endswith(ext):
                yield os.path.join(dirpath, f)


def ler(caminho):
    with open(caminho, 'r', encoding='utf-8', errors='replace') as fh:
        return fh.read()


def linhas_de(caminho):
    return ler(caminho).splitlines()


def suprimido(linha, check):
    return ('fundhub:ok-%d' % check) in linha


def rel_src(caminho):
    return os.path.relpath(caminho, SRC).replace('\\', '/')


def camada(caminho):
    """'kernel' | 'shell' | 'main' | 'modulo:<id>'"""
    r = rel_src(caminho)
    if r.startswith('core/') or r.startswith('shared/'):
        return 'kernel'
    if r.startswith('shell/'):
        return 'shell'
    if r.startswith('modules/'):
        return 'modulo:' + r.split('/')[1]
    return 'main'


# `from '...'` pega import estatico (inclusive multilinha, porque `from` fica
# colado na string). `import('...')` e DINAMICO: e carregado sob demanda e por
# isso NAO fecha ciclo em tempo de carga - e justamente o mecanismo que o
# registry usa para nao depender das views.
RE_FROM = re.compile(r"""\bfrom\s*['"]([^'"]+)['"]""")
RE_DYN = re.compile(r"""\bimport\s*\(\s*['"]([^'"]+)['"]""")


def imports_de(caminho, texto, regex):
    out = []
    base = os.path.dirname(caminho)
    for alvo in regex.findall(texto):
        if not alvo.startswith('.'):
            continue                      # CDN / bare specifier: nao ha no projeto
        out.append(os.path.normpath(os.path.join(base, alvo)))
    return out


# ------------------------------------------------------------------
# Coleta
# ------------------------------------------------------------------
js = sorted(arquivos(SRC, '.js'))
estaticos = {}    # so `from '...'`  - usado na deteccao de ciclo
grafo = {}        # estaticos + dinamicos - usado nas regras de fronteira
textos = {}

for f in js:
    textos[f] = ler(f)
    estaticos[f] = imports_de(f, textos[f], RE_FROM)
    grafo[f] = estaticos[f] + imports_de(f, textos[f], RE_DYN)


# ------------------------------------------------------------------
# 1. Ciclos no grafo de imports  (R4)
# ------------------------------------------------------------------
def check_ciclos():
    estado = {}
    pilha = []
    vistos = set()

    def visita(n):
        estado[n] = 'aberto'
        pilha.append(n)
        for m in estaticos.get(n, []):
            if m not in grafo:
                continue
            if estado.get(m) == 'aberto':
                ciclo = pilha[pilha.index(m):] + [m]
                chave = tuple(sorted(set(ciclo)))
                if chave not in vistos:
                    vistos.add(chave)
                    caminho = ' -> '.join(rel_src(x) for x in ciclo)
                    add('BLOQUEIA', 1, n, 0, 'ciclo de import: ' + caminho)
            elif m not in estado:
                visita(m)
        pilha.pop()
        estado[n] = 'fechado'

    for f in js:
        if f not in estado:
            visita(f)


# ------------------------------------------------------------------
# 2. Cross-modulo so por *.model.js  (R2)
# ------------------------------------------------------------------
def check_fronteira_modulo():
    for f in js:
        cf = camada(f)
        if not cf.startswith('modulo:'):
            continue
        for alvo in grafo[f]:
            ca = camada(alvo)
            if not ca.startswith('modulo:') or ca == cf:
                continue
            if not os.path.basename(alvo).endswith('.model.js'):
                add('BLOQUEIA', 2, f, 0,
                    'importa %s de outro modulo; so *.model.js atravessa a fronteira'
                    % rel_src(alvo))


# ------------------------------------------------------------------
# 3. View nao fala com o Supabase  (R3)
# ------------------------------------------------------------------
def eh_view(caminho):
    r = rel_src(caminho)
    return r.endswith('.view.js') or '/views/' in r


def check_view_sem_supabase():
    for f in js:
        if not eh_view(f):
            continue
        for alvo in grafo[f]:
            if rel_src(alvo).replace('\\', '/') == 'core/supabase.js':
                add('BLOQUEIA', 3, f, 0,
                    'view importa core/supabase.js; todo acesso a dado passa pelo model')
        for i, linha in enumerate(textos[f].splitlines(), 1):
            if re.search(r'\bsb\s*\(\s*\)', linha) and not suprimido(linha, 3):
                add('BLOQUEIA', 3, f, i, 'view usa o cliente Supabase: ' + linha.strip()[:70])


# ------------------------------------------------------------------
# 4. Model nao toca no DOM  (R3)
# ------------------------------------------------------------------
RE_DOM = re.compile(r'\b(document\.|innerHTML|querySelector|addEventListener|window\.location)')


def check_model_sem_dom():
    for f in js:
        if not f.endswith('.model.js'):
            continue
        for i, linha in enumerate(textos[f].splitlines(), 1):
            m = RE_DOM.search(linha)
            if m and not suprimido(linha, 4):
                add('BLOQUEIA', 4, f, i, 'model toca no DOM (%s)' % m.group(1))


# ------------------------------------------------------------------
# 5. Kernel nao importa modules/ nem shell/  (R1)
# ------------------------------------------------------------------
def check_direcao_kernel():
    for f in js:
        if camada(f) != 'kernel':
            continue
        eh_registry = rel_src(f) == 'core/registry.js'
        eh_router = rel_src(f) == 'core/router.js'
        for alvo in grafo[f]:
            ca = camada(alvo)
            if ca.startswith('modulo:'):
                if eh_registry and os.path.basename(alvo) == 'module.js':
                    continue          # excecao nomeada: manifestos
                # Excecao nomeada: o roteador abre o painel de configuracao
                # por import() DINAMICO no clique da engrenagem (spec
                # 2026-09-05-configuracoes-por-modulo, D8). O kernel dispara,
                # o modulo responde - mesma inversao de mod.load().
                if (eh_router and alvo not in estaticos.get(f, [])
                        and rel_src(alvo) == 'modules/configuracoes/painel.js'):
                    continue
                add('BLOQUEIA', 5, f, 0,
                    'kernel importa %s; o kernel nao conhece modulo' % rel_src(alvo))
            elif ca == 'shell':
                add('BLOQUEIA', 5, f, 0,
                    'kernel importa %s; o kernel nao conhece a moldura' % rel_src(alvo))


# ------------------------------------------------------------------
# 6. Formatacao de data/hora so em shared/format.js  (R8)
# ------------------------------------------------------------------
# O BUG: extrair data civil de um timestamp. `toISOString()` devolve UTC, entao
# .slice(0,10) volta um dia a noite no Brasil. Isso bloqueia sempre.
RE_DATA_CIVIL_DE_TS = re.compile(
    r'toISOString\s*\(\s*\)\s*\.\s*(?:slice|substring|substr)\s*\(\s*0\s*,\s*10\s*\)'
    r'|toISOString\s*\(\s*\)\s*\.\s*split\s*\(\s*[\'"]T[\'"]\s*\)')

# Formatacao para EXIBICAO fora de format.js: perde o fuso America/Sao_Paulo.
RE_EXIBICAO = re.compile(r'\.(toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(')

# `new Date().toISOString()` para carimbar timestamp e CORRETO - so nao esta
# centralizado. Vira aviso: o destino e um agoraISO() em shared/format.js.
RE_TS_AGORA = re.compile(r'\.toISOString\s*\(\s*\)')


def check_datas():
    for f in js:
        if rel_src(f) == 'shared/format.js':
            continue
        for i, linha in enumerate(textos[f].splitlines(), 1):
            if suprimido(linha, 6):
                continue
            if RE_DATA_CIVIL_DE_TS.search(linha):
                add('BLOQUEIA', 6, f, i,
                    'data civil extraida de toISOString() - volta um dia a noite; usar hojeISO()')
            elif RE_EXIBICAO.search(linha):
                m = RE_EXIBICAO.search(linha)
                add('BLOQUEIA', 6, f, i,
                    '%s() fora de shared/format.js - formatacao de exibicao '
                    'precisa do fuso America/Sao_Paulo' % m.group(1))
            elif RE_TS_AGORA.search(linha):
                add('AVISO', 6, f, i,
                    'toISOString() para carimbar timestamp - correto, mas centralizar '
                    'em shared/format.js (agoraISO())')


# ------------------------------------------------------------------
# 7. Cor literal em modulo  (R9)
# ------------------------------------------------------------------
RE_COR = re.compile(r'(#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()')


def check_cores():
    """Cor no JS bloqueia: e dado/dominio contaminado por apresentacao.
    Cor no CSS avisa: costuma ser sombra ou folha de impressao."""
    base = os.path.join(SRC, 'modules')
    for f in list(arquivos(base, '.css')) + list(arquivos(base, '.js')):
        if f.endswith('.content.js'):
            continue                       # arquivo de conteudo, nao de estilo
        for i, linha in enumerate(linhas_de(f), 1):
            if linha.lstrip().startswith(('*', '//', '/*')):
                continue                   # comentario
            m = RE_COR.search(linha)
            if m and not suprimido(linha, 7):
                sev = 'AVISO' if f.endswith('.css') else 'BLOQUEIA'
                add(sev, 7, f, i,
                    'cor literal "%s" em modulo - usar var(--token) de tokens.css'
                    % m.group(1).strip())


# ------------------------------------------------------------------
# 8. Segredo e PII  (R7)  - o repositorio e publico
# ------------------------------------------------------------------
# Chaves de verdade sao longas. Mencionar "sb_secret_" numa frase que PROIBE a
# chave nao pode disparar alarme - senao a propria documentacao vira violacao.
RE_SEGREDO = re.compile(r'sb_secret_[A-Za-z0-9_\-]{15,}')
RE_JWT = re.compile(r'\beyJ[A-Za-z0-9_\-]{30,}')
RE_EMAIL = re.compile(r'([A-Za-z0-9._%+\-]+)@educacao\.pmrp\.sp\.gov\.br')
RE_CPF = re.compile(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b')
RE_TELEFONE = re.compile(r'\((\d{2})\)\s?(\d{4,5})-(\d{4})')

# Locais de e-mail que sao claramente exemplo, nao pessoa.
LOCAIS_EXEMPLO = {
    'seu.email', 'seu_email', 'seuemail', 'email', 'e-mail', 'nome',
    'nome.sobrenome', 'fulano', 'ciclano', 'beltrano', 'exemplo', 'usuario',
    'teste', 'test', 'admin', 'voce', 'dev', 'x', '%', '_',
}

EXT_PII = ('.js', '.css', '.html', '.md', '.sql', '.json', '.yml', '.yaml', '.py', '.txt')


def digitos_ficticios(*partes):
    """'99999','9999' -> True (placeholder). '3211','8054' -> False (parece real)."""
    d = ''.join(partes)
    return len(set(d)) <= 2 or d in ('12345678', '123456789', '1234567890')


def check_pii():
    for f in arquivos(RAIZ):
        if not f.endswith(EXT_PII):
            continue
        rel = os.path.relpath(f, RAIZ).replace('\\', '/')
        if rel.startswith('data/') and rel.endswith('.json'):
            continue                       # gitignored
        for i, linha in enumerate(linhas_de(f), 1):
            if suprimido(linha, 8):
                continue

            m = RE_SEGREDO.search(linha)
            if m:
                add('BLOQUEIA', 8, f, i, 'CHAVE SECRETA do Supabase no repositorio publico')
                continue
            if RE_JWT.search(linha):
                add('BLOQUEIA', 8, f, i, 'JWT no repositorio publico')
                continue

            m = RE_EMAIL.search(linha)
            if m and m.group(1).lower() not in LOCAIS_EXEMPLO:
                add('BLOQUEIA', 8, f, i,
                    'e-mail institucional de pessoa real: %s@...' % m.group(1))
                continue

            m = RE_CPF.search(linha)
            if m and not digitos_ficticios(re.sub(r'\D', '', m.group(0))):
                add('BLOQUEIA', 8, f, i, 'CPF no repositorio publico: ' + m.group(0))
                continue

            m = RE_TELEFONE.search(linha)
            if m and not digitos_ficticios(m.group(2), m.group(3)):
                add('BLOQUEIA', 8, f, i,
                    'telefone que parece real: %s' % m.group(0))


# ------------------------------------------------------------------
# 9. Limite de linhas  (R11)
# ------------------------------------------------------------------
# Uma view pode declarar que e uma SUPERFICIE INDIVISIVEL - uma tela cujas
# partes mutam um estado so, onde cortar produz dois arquivos que precisam ser
# lidos e editados juntos (o mesmo mal que a R11 evita ao proibir divisao por
# tipo tecnico). A marca exige MOTIVO: sem ele e so silenciar a checagem.
MARCA_INDIVISIVEL = re.compile(r'@superficie-indivisivel:\s*(\S.*?)\s*$', re.M)


def isencao_declarada(texto):
    # So vale no cabecalho: uma marca enterrada no meio do arquivo passa
    # despercebida por quem abre para editar.
    cabecalho = '\n'.join(texto.splitlines()[:40])
    m = MARCA_INDIVISIVEL.search(cabecalho)
    return m.group(1) if m else None


def check_tamanho():
    for f in js:
        if f.endswith('.content.js'):
            continue                       # conteudo e isento
        n = len(textos[f].splitlines())
        if eh_view(f) and n > LIMITE_VIEW:
            motivo = isencao_declarada(textos[f])
            if motivo:
                add('ISENTO', 9, f, 0,
                    'view com %d linhas (limite %d), superficie indivisivel: %s'
                    % (n, LIMITE_VIEW, motivo))
            else:
                add('AVISO', 9, f, 0,
                    'view com %d linhas (limite %d) - dividir por superficie em views/, '
                    'ou declarar @superficie-indivisivel com o motivo'
                    % (n, LIMITE_VIEW))
        elif f.endswith('.model.js') and n > LIMITE_MODEL:
            add('AVISO', 9, f, 0,
                'model com %d linhas (limite %d) - avaliar separar um agregado'
                % (n, LIMITE_MODEL))


# ------------------------------------------------------------------
# 10. Consistencia do registro
# ------------------------------------------------------------------
CAMPOS_MANIFESTO = ('id', 'ico', 'nome')


def check_registro():
    registry = os.path.join(SRC, 'core', 'registry.js')
    if not os.path.exists(registry):
        return
    txt_reg = ler(registry)
    main_css = os.path.join(SRC, 'styles', 'main.css')
    txt_css = ler(main_css) if os.path.exists(main_css) else ''

    base = os.path.join(SRC, 'modules')
    for mod in sorted(os.listdir(base)):
        pasta = os.path.join(base, mod)
        if not os.path.isdir(pasta):
            continue

        manifesto = os.path.join(pasta, 'module.js')
        if os.path.exists(manifesto):
            txt = ler(manifesto)
            for campo in CAMPOS_MANIFESTO:
                if not re.search(r'\b%s\s*:' % campo, txt):
                    add('AVISO', 10, manifesto, 0, 'manifesto sem o campo "%s"' % campo)
            if ("modules/%s/module.js" % mod) not in txt_reg.replace('\\', '/'):
                add('AVISO', 10, manifesto, 0,
                    'modulo "%s" tem manifesto mas nao esta em core/registry.js' % mod)

        for css in sorted(arquivos(pasta, '.css')):
            nome = os.path.basename(css)
            if ("modules/%s/%s" % (mod, nome)) not in txt_css.replace('\\', '/'):
                add('AVISO', 10, css, 0,
                    'CSS sem @import em styles/main.css - nao carrega')


# ------------------------------------------------------------------
# 11. Tutorial por modulo (spec 2026-09-05-ajuda-por-modulo)
# ------------------------------------------------------------------
def _git_ct(caminho):
    """Timestamp do ultimo commit que tocou `caminho` (0 se nao rastreado)."""
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', caminho],
            cwd=RAIZ, capture_output=True, text=True, timeout=10)
        return int(out.stdout.strip()) if out.stdout.strip() else 0
    except Exception:
        return 0


def check_documentacao():
    modulos_dir = os.path.join(SRC, 'modules')
    docs_dir = os.path.join(RAIZ, 'docs', 'modulos')
    com_doc = set()

    for mod in sorted(os.listdir(modulos_dir)):
        manifesto = os.path.join(modulos_dir, mod, 'module.js')
        if not os.path.isfile(manifesto):
            continue
        if not re.search(r'\bdoc\s*:\s*true\b', ler(manifesto)):
            continue
        com_doc.add(mod)
        md = os.path.join(docs_dir, mod + '.md')
        if not os.path.isfile(md):
            add('BLOQUEIA', 11, manifesto, 0,
                'modulo declara doc:true mas nao ha docs/modulos/%s.md' % mod)
        elif _git_ct(os.path.join('src', 'modules', mod)) > _git_ct(os.path.join('docs', 'modulos', mod + '.md')):
            add('AVISO', 11, md, 0,
                'codigo de src/modules/%s/ mais novo que o tutorial - revisar' % mod)

    if os.path.isdir(docs_dir):
        for f in sorted(os.listdir(docs_dir)):
            if not f.endswith('.md'):
                continue
            mod = f[:-3]
            if mod not in com_doc:
                add('BLOQUEIA', 11, os.path.join(docs_dir, f), 0,
                    'docs/modulos/%s.md sem modulo correspondente com doc:true' % mod)


# ------------------------------------------------------------------
# 12. Classe CSS orfa  (--)
# ------------------------------------------------------------------
# Uma classe escrita no markup que nao existe em CSS nenhum NEM e usada como
# seletor em JS nao faz nada - e ninguem percebe, porque CSS ausente e
# silencioso. Foi o que quase aconteceu com `.gira-90`: escopada em
# `.hg-mover` dentro de horarios.css, invisivel para qualquer outra tela que
# tentasse usa-la.
#
# AVISO, nao bloqueio: nome montado em runtime (`serie-${n}`) e classe de
# terceiro sempre vao existir, e falso positivo que barra commit vira ruido
# ignorado - que e pior do que nao ter a checagem.
RE_CLASSE_DEF = re.compile(r'\.(-?[_a-zA-Z][\w-]*)')
RE_CLASSE_ATTR = re.compile(r'class\s*=\s*["\']([^"\']*)["\']')
RE_SELETOR_JS = re.compile(
    r'(?:querySelectorAll|querySelector|closest|matches)\(\s*[`\'"]([^`\'"]*)[`\'"]')
RE_CLASSLIST_JS = re.compile(
    r'classList\.(?:add|remove|toggle|contains|replace)\(\s*[`\'"]([\w-]+)[`\'"]')
RE_COMENTARIO_CSS = re.compile(r'/\*.*?\*/', re.S)
RE_NOME_CLASSE = re.compile(r'-?[_a-zA-Z][\w-]*')

# Classes que o navegador ou uma convencao do hub define, nunca o nosso CSS.
CLASSES_EXTERNAS = {
    'ico',            # so o envelope de ico(); o estilo vem de .ico em components.css
}


def check_classes_orfas():
    definidas = set()
    for f in arquivos(SRC, '.css'):
        css = RE_COMENTARIO_CSS.sub(' ', ler(f))
        definidas.update(RE_CLASSE_DEF.findall(css))

    usadas_como_seletor = set()
    fontes = list(arquivos(SRC, '.js')) + [os.path.join(RAIZ, 'index.html')]
    for f in fontes:
        if not os.path.isfile(f):
            continue
        txt = ler(f)
        for linha in txt.splitlines():
            if RE_SELETOR_JS.search(linha):
                usadas_como_seletor.update(RE_CLASSE_DEF.findall(linha))
        usadas_como_seletor.update(RE_CLASSLIST_JS.findall(txt))

    conhecidas = definidas | usadas_como_seletor | CLASSES_EXTERNAS

    for f in fontes:
        if not os.path.isfile(f):
            continue
        if f.endswith('.content.js'):
            continue                      # conteudo, com markup de exemplo
        for i, linha in enumerate(linhas_de(f), 1):
            if suprimido(linha, 12):
                continue
            for valor in RE_CLASSE_ATTR.findall(linha):
                # Um `${...}` com aspas dentro faz a captura parar no meio da
                # expressao. Do `${` em diante nao ha classe confiavel - o que
                # vem depois e pedaco de codigo (`===`, um identificador JS).
                antes, tem_expr, _ = valor.partition('${')
                nomes = antes.split()
                # E se o `${` vem GRUDADO no texto anterior, o ultimo token e
                # so o prefixo de um nome montado em runtime (`serie-${n}`).
                if tem_expr and antes and not antes[-1].isspace():
                    nomes = nomes[:-1]
                for nome in nomes:
                    # So identificador de classe. O que sobra e pedaco de
                    # expressao (`===`, `?`, `||`) capturado quando o atributo
                    # tem um `${...}` com aspas dentro - nao e classe nenhuma.
                    if not RE_NOME_CLASSE.fullmatch(nome):
                        continue
                    if nome not in conhecidas:
                        add('AVISO', 12, f, i,
                            'classe "%s" nao existe em CSS nenhum nem e usada como seletor' % nome)


# ------------------------------------------------------------------
# Execucao
# ------------------------------------------------------------------
TITULOS = {
    1: 'R4  ciclos de import',
    2: 'R2  fronteira de modulo',
    3: 'R3  view sem Supabase',
    4: 'R3  model sem DOM',
    5: 'R1  direcao de dependencias',
    6: 'R8  datas em shared/format.js',
    7: 'R9  cores por token',
    8: 'R7  segredo e PII',
    9: 'R11 limite de linhas',
    10: '--  consistencia do registro',
    11: '--  tutorial por modulo',
    12: '--  classe CSS orfa',
}


def main():
    so_pii = '--so-pii' in sys.argv

    if so_pii:
        check_pii()
    else:
        check_ciclos()
        check_fronteira_modulo()
        check_view_sem_supabase()
        check_model_sem_dom()
        check_direcao_kernel()
        check_datas()
        check_cores()
        check_pii()
        check_tamanho()
        check_registro()
        check_documentacao()
        check_classes_orfas()

    bloqueios = [p for p in problemas if p[0] == 'BLOQUEIA']
    avisos = [p for p in problemas if p[0] == 'AVISO']

    for sev, rotulo in (('BLOQUEIA', 'BLOQUEIA'), ('AVISO', 'AVISO'), ('ISENTO', 'ISENCAO DECLARADA')):
        grupo = [p for p in problemas if p[0] == sev]
        if not grupo:
            continue
        print('\n%s  (%d)' % (rotulo, len(grupo)))
        print('=' * 62)
        atual = None
        for _, check, arq, lin, msg in sorted(grupo, key=lambda p: (p[1], p[2], p[3])):
            if check != atual:
                atual = check
                print('\n  [%d] %s' % (check, TITULOS.get(check, '')))
            onde = '%s:%d' % (arq, lin) if lin else arq
            print('      %s\n          %s' % (onde, msg))

    print('\n' + '-' * 62)
    isentos = [p for p in problemas if p[0] == 'ISENTO']
    if not bloqueios and not avisos:
        print('OK - nenhuma violacao encontrada.'
              + (' %d isencao(oes) declarada(s).' % len(isentos) if isentos else ''))
    else:
        print('%d bloqueante(s) . %d aviso(s)%s'
              % (len(bloqueios), len(avisos),
                 ' . %d isencao(oes)' % len(isentos) if isentos else ''))
    print('-' * 62)

    return 1 if bloqueios else 0


if __name__ == '__main__':
    sys.exit(main())
