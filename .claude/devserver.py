"""Servidor estático de desenvolvimento do FundHub.

O `python -m http.server` não manda cabeçalho de cache, e o browser
passa a servir os módulos ES do cache heurístico — você edita um
arquivo, recarrega e continua vendo a versão antiga. Este servidor é
idêntico, só que com `Cache-Control: no-store`.

Uso: python .claude/devserver.py [porta]   (o launch.json já chama)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    ThreadingHTTPServer(("", porta), SemCache).serve_forever()
