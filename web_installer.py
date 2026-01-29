#!/usr/bin/env python3
"""
OpenEurope - Web Installer STABILE
Installer interattivo che funziona da browser
"""

import http.server
import socketserver
import subprocess
import sys
import os
import json
import threading
import time
import webbrowser
from pathlib import Path

PORT = 9999

# Classe TCPServer che riusa le porte
class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class InstallerHandler(http.server.SimpleHTTPRequestHandler):
    """Handler per il web installer"""
    
    def do_GET(self):
        """Gestisci richieste GET"""
        try:
            if self.path == '/':
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                html = self.get_html()
                self.wfile.write(html.encode('utf-8'))
            elif self.path == '/api/check':
                self.handle_check()
            elif self.path == '/api/install':
                self.handle_install()
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            print(f"[ERROR] GET {self.path}: {e}")
            self.send_error(500)
    
    def do_POST(self):
        """Gestisci richieste POST"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            if self.path == '/api/install':
                self.handle_install_post(body)
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            print(f"[ERROR] POST {self.path}: {e}")
            self.send_error(500)
    
    def log_message(self, format, *args):
        """Log minimalista"""
        pass  # Senza log
    
    def handle_check(self):
        """Verifica lo stato dell'installazione"""
        try:
            status = {
                "python": self.check_python(),
                "pandas": self.check_module("pandas"),
                "openpyxl": self.check_module("openpyxl"),
                "structure": self.check_structure(),
            }
            
            status["all_ok"] = all([
                status["python"]["ok"],
                status["pandas"]["ok"],
                status["openpyxl"]["ok"],
                status["structure"]["ok"]
            ])
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(status).encode('utf-8'))
        except Exception as e:
            print(f"[ERROR] handle_check: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
    
    def handle_install(self):
        """Installa le dipendenze"""
        print("[INSTALL] Inizio installazione...")
        try:
            # Pip upgrade
            print("[INSTALL] Aggiornamento pip...")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "--upgrade", "pip"],
                capture_output=True,
                timeout=120
            )
            
            # Pandas
            print("[INSTALL] Installazione pandas...")
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "pandas"],
                capture_output=True,
                text=True,
                timeout=180
            )
            if result.returncode != 0:
                raise Exception(result.stderr[:200])
            
            # Openpyxl
            print("[INSTALL] Installazione openpyxl...")
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "openpyxl"],
                capture_output=True,
                text=True,
                timeout=120
            )
            if result.returncode != 0:
                raise Exception(result.stderr[:200])
            
            print("[INSTALL] ✓ Completato")
            response = {"success": True, "message": "Installazione completata"}
        except Exception as e:
            print(f"[INSTALL] ✗ Errore: {e}")
            response = {"success": False, "message": str(e)[:200]}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def handle_install_post(self, body):
        """Gestisci POST per azioni: verifica tutto prima di avviare il server"""
        try:
            data = json.loads(body) if body else {}
            if data.get("action") == "start_server":
                # Verifica dipendenze e struttura
                status = {
                    "python": self.check_python(),
                    "pandas": self.check_module("pandas"),
                    "openpyxl": self.check_module("openpyxl"),
                    "structure": self.check_structure(),
                }
                all_ok = all([
                    status["python"]["ok"],
                    status["pandas"]["ok"],
                    status["openpyxl"]["ok"],
                    status["structure"]["ok"]
                ])
                if not all_ok:
                    msg = "Errore: "
                    for k, v in status.items():
                        if not v["ok"]:
                            msg += f"{k} ({v['message']}) "
                    response = {"success": False, "message": msg.strip()}
                else:
                    print("[INSTALL_POST] Tutto ok, avvio server demo...")
                    threading.Thread(
                        target=self.start_demo_server_and_open,
                        daemon=True
                    ).start()
                    response = {"success": True, "message": "Server avviato e browser aperto"}
            else:
                response = {"success": False, "message": "Azione sconosciuta"}
        except Exception as e:
            print(f"[INSTALL_POST] Errore: {e}")
            response = {"success": False, "message": str(e)}
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))

    @staticmethod
    def start_demo_server_and_open():
        """Avvia il server demo e apre il browser su START_HERE.html"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 8000))
            sock.close()
            if result == 0:
                print("[DEMO] Server già in esecuzione su porta 8000")
                webbrowser.open('http://localhost:8000/START_HERE.html')
                return
        except:
            pass
        try:
            print("[DEMO] Avvio server...")
            os.chdir('/workspaces/operneurope')
            subprocess.Popen(
                [sys.executable, "run_demo.py"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            # Attendi che il server parta
            for _ in range(10):
                time.sleep(1)
                try:
                    import socket
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    result = sock.connect_ex(('127.0.0.1', 8000))
                    sock.close()
                    if result == 0:
                        webbrowser.open('http://localhost:8000/START_HERE.html')
                        print("[DEMO] Browser aperto su START_HERE.html")
                        return
                except:
                    pass
            print("[DEMO] Server avviato ma browser non aperto (timeout)")
        except Exception as e:
            print(f"[DEMO] Errore: {e}")
    
    @staticmethod
    def start_demo_server():
        """Avvia il server demo"""
        # Verifica se server è già in esecuzione
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 8000))
            sock.close()
            if result == 0:
                print("[DEMO] Server già in esecuzione su porta 8000")
                return
        except:
            pass
        
        try:
            print("[DEMO] Avvio server...")
            os.chdir('/workspaces/operneurope')
            subprocess.Popen(
                [sys.executable, "run_demo.py"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception as e:
            print(f"[DEMO] Errore: {e}")
    
    @staticmethod
    def check_python():
        """Verifica Python"""
        version = f"{sys.version_info.major}.{sys.version_info.minor}"
        if sys.version_info >= (3, 8):
            return {"ok": True, "message": f"Python {version} ✓"}
        return {"ok": False, "message": f"Python 3.8+ richiesto"}
    
    @staticmethod
    def check_module(name):
        """Verifica modulo Python"""
        try:
            __import__(name)
            return {"ok": True, "message": f"{name} ✓"}
        except ImportError:
            return {"ok": False, "message": f"{name} mancante"}
    
    @staticmethod
    def check_structure():
        """Verifica struttura progetto"""
        files = [
            "openeurope.py",
            "run_demo.py",
            "demo/OpenEurope_Demo_Semplice_v3/app.js"
        ]
        ok = all(Path(f).exists() for f in files)
        return {
            "ok": ok,
            "message": "Struttura OK" if ok else "File mancanti"
        }
    
    @staticmethod
    def get_html():
        return """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenEurope - Installer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
        }
        .logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 32px;
            margin: 0 auto 20px;
        }
        h1 { color: #333; font-size: 28px; margin-bottom: 10px; text-align: center; }
        .subtitle { color: #666; font-size: 14px; text-align: center; margin-bottom: 30px; }
        .check-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            background: #f5f5f5;
            border-left: 4px solid #ddd;
        }
        .check-item.ok {
            background: #e8f5e9;
            border-left-color: #4caf50;
        }
        .check-item.error {
            background: #ffebee;
            border-left-color: #f44336;
        }
        .check-item.loading {
            background: #e3f2fd;
            border-left-color: #2196f3;
        }
        .icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
            color: white;
            flex-shrink: 0;
        }
        .check-item.ok .icon { background: #4caf50; }
        .check-item.error .icon { background: #f44336; }
        .check-item.loading .icon { background: #2196f3; }
        .label { font-weight: 600; color: #333; font-size: 14px; }
        .message { color: #666; font-size: 12px; margin-top: 3px; }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 30px;
        }
        button {
            flex: 1;
            padding: 14px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-secondary {
            background: #f0f0f0;
            color: #333;
        }
        .btn-secondary:hover {
            background: #e0e0e0;
        }
        .info {
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 13px;
            color: #2e7d32;
            line-height: 1.5;
            display: none;
        }
        .info.show { display: block; }
        .spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">OE</div>
        <h1>OpenEurope</h1>
        <p class="subtitle">Installer Web</p>
        
        <div id="checks">
            <div class="check-item loading" id="check-python">
                <div class="icon"><span class="spinner"></span></div>
                <div><div class="label">Python</div><div class="message" id="msg-python">Verifica...</div></div>
            </div>
            <div class="check-item loading" id="check-pandas">
                <div class="icon"><span class="spinner"></span></div>
                <div><div class="label">pandas</div><div class="message" id="msg-pandas">Verifica...</div></div>
            </div>
            <div class="check-item loading" id="check-openpyxl">
                <div class="icon"><span class="spinner"></span></div>
                <div><div class="label">openpyxl</div><div class="message" id="msg-openpyxl">Verifica...</div></div>
            </div>
            <div class="check-item loading" id="check-structure">
                <div class="icon"><span class="spinner"></span></div>
                <div><div class="label">Progetto</div><div class="message" id="msg-structure">Verifica...</div></div>
            </div>
        </div>
        
        <div class="actions">
            <button class="btn-secondary" onclick="location.reload()">Aggiorna</button>
            <button class="btn-primary" id="btn-install" onclick="install()" disabled>Installa</button>
            <button class="btn-primary" id="btn-start" onclick="start()" disabled style="display:none">Avvia</button>
        </div>
        
        <div class="info" id="info"></div>
    </div>
    
    <script>
        function show(id, status) {
            const el = document.getElementById(id);
            el.classList.remove('loading', 'ok', 'error');
            el.classList.add(status.ok ? 'ok' : 'error');
            const key = id.split('-')[1];
            document.getElementById('msg-' + key).textContent = status.message;
        }
        
        async function check() {
            try {
                const r = await fetch('/api/check');
                const s = await r.json();
                show('check-python', s.python);
                show('check-pandas', s.pandas);
                show('check-openpyxl', s.openpyxl);
                show('check-structure', s.structure);
                
                if (s.all_ok) {
                    document.getElementById('btn-install').style.display = 'none';
                    document.getElementById('btn-start').style.display = 'block';
                    document.getElementById('btn-start').disabled = false;
                    showInfo('✓ Pronto! Clicca Avvia', 'ok');
                    setTimeout(() => start(), 2000);
                } else {
                    document.getElementById('btn-install').disabled = false;
                }
            } catch(e) {
                console.error(e);
            }
        }
        
        async function install() {
            const btn = document.getElementById('btn-install');
            btn.disabled = true;
            btn.textContent = 'Installazione...';
            showInfo('Installazione in corso...', 'info');
            try {
                const r = await fetch('/api/install');
                const s = await r.json();
                if (s.success) {
                    showInfo('✓ Fatto! Ricaricando...', 'ok');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showInfo('✗ Errore: ' + s.message, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Installa';
                }
            } catch(e) {
                showInfo('✗ Errore di connessione', 'error');
                btn.disabled = false;
                btn.textContent = 'Installa';
            }
        }
        
        async function start() {
            const btn = document.getElementById('btn-start');
            btn.disabled = true;
            btn.textContent = 'Avvio...';
            showInfo('Avvio server...', 'info');
            try {
                const r = await fetch('/api/install', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({action: 'start_server'})
                });
                const s = await r.json();
                if (s.success) {
                    showInfo('✓ Server avviato! Apertura dashboard...', 'ok');
                    setTimeout(() => {
                        window.location.href = 'http://localhost:8000/START_HERE.html';
                    }, 1500);
                }
            } catch(e) {}
        }
        
        function showInfo(msg, type) {
            const el = document.getElementById('info');
            el.textContent = msg;
            el.className = 'info show';
        }
        
        window.addEventListener('load', check);
        setInterval(check, 3000);
    </script>
</body>
</html>"""

def main():
    os.chdir('/workspaces/operneurope')
    
    print(f"\n{'='*60}")
    print("  🚀 OpenEurope - Web Installer")
    print(f"{'='*60}\n")
    print(f"✓ Portale: http://localhost:{PORT}")
    print(f"✓ Premi Ctrl+C per fermare\n")
    
    try:
        # Crea server
        with ReuseAddrTCPServer(("", PORT), InstallerHandler) as httpd:
            print(f"[SERVER] In esecuzione su porta {PORT}\n")
            
            # Apri browser
            try:
                webbrowser.open(f'http://localhost:{PORT}')
                print(f"✓ Browser aperto\n")
            except:
                print(f"Apri: http://localhost:{PORT}\n")
            
            # Serve
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✓ Installer fermato")
    except Exception as e:
        print(f"\n✗ Errore: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
