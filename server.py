import http.server
import socketserver
import os

PORT = 5080
DIRECTORY = "/Users/agenten/rom-app"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

class TCPServerDual(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    os.system(f"lsof -ti :{PORT} | xargs kill -9 2>/dev/null || true")
    with TCPServerDual(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Rom Guide App kører på http://0.0.0.0:{PORT} (http://localhost:{PORT})")
        httpd.serve_forever()
