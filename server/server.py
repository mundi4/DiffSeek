import http.server
import socketserver
import urllib.parse
import urllib.request
import os
import mimetypes
import sys
import traceback


class ApiHandler(http.server.BaseHTTPRequestHandler):

    def _set_headers(
        self, status=200, content_type="text/plain; charset=utf-8", content_length=None
    ):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        if content_length is not None:
            self.send_header("Content-Length", str(content_length))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):  # preflight 요청 처리
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/api/fetch":
            if "url" not in query:
                self.send_error(400, "Missing 'url' parameter")
                return

            target = query["url"][0]
            scheme = urllib.parse.urlparse(target).scheme

            try:
                if scheme == "file":  # 로컬 파일 읽기
                    file_path = urllib.request.url2pathname(
                        urllib.parse.urlparse(target).path
                    )
                    if not os.path.isfile(file_path):
                        self.send_error(404, "File not found")
                        return
                    with open(file_path, "rb") as f:
                        data = f.read()
                    mime, _ = mimetypes.guess_type(file_path)
                    self._set_headers(
                        200, mime or "application/octet-stream", len(data)
                    )
                    self.wfile.write(data)

                elif scheme in ("http", "https"):  # 그냥 받아서 전달
                    with urllib.request.urlopen(target) as resp:
                        data = resp.read()
                        self._set_headers(
                            200, resp.info().get_content_type(), len(data)
                        )
                        self.wfile.write(data)

                else:
                    self.send_error(400, f"Unsupported scheme: {scheme}")

            except Exception as e:
                traceback.print_exc()
                try:
                    msg = f"Internal server error: {e}".encode("utf-8", "replace")
                    self._set_headers(500, "text/plain; charset=utf-8", len(msg))
                    self.wfile.write(msg)
                except (BrokenPipeError, ConnectionAbortedError):
                    # 클라가 이미 끊었을 때는 그냥 무시
                    pass
            return

        elif parsed.path == "/api/ping":
            self._set_headers(200, "text/plain; charset=utf-8")
            self.wfile.write(b"pong")
            return

        else:
            self.send_error(404, "Unknown endpoint")


if __name__ == "__main__":
    PORT = 5000

    # "127.0.0.1" 로 바인딩하면 오직 localhost (로컬 머신)에서만 접속 가능하다.
    # "0.0.0.0" 으로 바꾸면 네트워크 상의 다른 PC에서도 접근할 수 있음 (보안상 위험).
    # 코드가 이것저것 안가리고 들어오는 경로의 파일을 무조건 내어주기 때문에 주의.
    BINDING_ADDR = "127.0.0.1"
    # BINDING_ADDR = "0.0.0.0"

    with socketserver.ThreadingTCPServer((BINDING_ADDR, PORT), ApiHandler) as httpd:
        daemon_threads = True
        print(f"Serving at http://localhost:{PORT}")
        try:
            httpd.serve_forever(poll_interval=0.1)
        except KeyboardInterrupt:
            print("\nShutting down")
            httpd.server_close()
            sys.exit(0)
