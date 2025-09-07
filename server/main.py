import http.server
import socketserver
import urllib.parse
import os
import mimetypes
import base64
import json

PORT = 5000
STATIC_DIR = os.path.abspath("./")

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/convertimg":
            query = urllib.parse.parse_qs(parsed.query)
            file_path = query.get("path", [None])[0]
            if not file_path or not os.path.isfile(file_path):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"File not found")
                return
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"
            with open(file_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            data_url = f"data:{mime_type};base64,{b64}"
            result = json.dumps({"data_url": data_url}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(result)))
            self.end_headers()
            self.wfile.write(result)
        else:
            # static file serving
            if self.path == "/" or self.path == "":
                self.path = "/index.html"
            self.directory = STATIC_DIR
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()