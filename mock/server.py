import http.server
import socketserver
import os
import mimetypes

MOCK_DIR = os.path.dirname(__file__)
PORT = 5051

class CORSSimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS 헤더
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def translate_path(self, path):
        # Serve files from current (mock) directory
        rel_path = path.lstrip('/')
        return os.path.join(MOCK_DIR, rel_path)

if __name__ == "__main__":
    # ThreadingTCPServer 로 교체
    with socketserver.ThreadingTCPServer(("", PORT), CORSSimpleHTTPRequestHandler) as httpd:
        print(f"Serving at http://localhost:{PORT} (CORS enabled, threaded)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down")
            httpd.server_close()
