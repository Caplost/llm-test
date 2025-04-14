from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
from urllib.parse import parse_qs, urlparse
import ssl

class LLMHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            with open('index.html', 'rb') as file:
                self.wfile.write(file.read())
        elif self.path == '/style.css':
            self.send_response(200)
            self.send_header('Content-type', 'text/css')
            self.end_headers()
            with open('style.css', 'rb') as file:
                self.wfile.write(file.read())
        elif self.path == '/app.js':
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.end_headers()
            with open('app.js', 'rb') as file:
                self.wfile.write(file.read())
        elif self.path == '/config.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            with open('config.json', 'rb') as file:
                self.wfile.write(file.read())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            model_id = data.get('model')
            question = data.get('question')
            
            # 这里应该根据不同的模型调用相应的API
            # 为了演示，我们只返回一个简单的流式响应
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.send_header('Transfer-Encoding', 'chunked')
            self.end_headers()
            
            # 模拟流式响应
            response = f"这是{model_id}模型对问题'{question}'的回答：\n\n"
            for word in response.split():
                self.wfile.write(f"{len(word):x}\r\n{word}\r\n".encode('utf-8'))
                self.wfile.flush()
            
            self.wfile.write(b"0\r\n\r\n")
        else:
            self.send_response(404)
            self.end_headers()

def run(server_class=HTTPServer, handler_class=LLMHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting server on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run() 