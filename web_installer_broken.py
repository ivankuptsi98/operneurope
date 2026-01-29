#!/usr/bin/env python3
"""
OpenEurope - Web Installer (FIXED)
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

class InstallerHandler(http.server.SimpleHTTPRequestHandler):
    """Handler per il web installer"""
    
    def log_message(self, format, *args):
        """Riduci i messaggi di log"""
        if "GET" in format or "POST" in format:
            print(f"[SERVER] {format % args}")
    
    def do_GET(self):
        """Gestisci richieste GET"""
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(self.get_html().encode('utf-8'))
        elif self.path == '/api/check':
            self.handle_check()
        elif self.path == '/api/install':
            self.handle_install()
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Gestisci richieste POST"""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        if self.path == '/api/install':
            self.handle_install_post(body)
        else:
            self.send_response(404)
            self.end_headers()
    
    def handle_check(self):
        """Verifica lo stato dell'installazione"""
        try:
            status = {
                "python": self.check_python(),
                "pandas": self.check_module("pandas"),
                "openpyxl": self.check_module("openpyxl"),
                "structure": self.check_structure(),
                "all_ok": False
            }
            
            status["all_ok"] = (
                status["python"]["ok"] and
                status["pandas"]["ok"] and
                status["openpyxl"]["ok"] and
                status["structure"]["ok"]
            )
            
            print(f"[CHECK] Python: {status['python']['ok']}, pandas: {status['pandas']['ok']}, openpyxl: {status['openpyxl']['ok']}, structure: {status['structure']['ok']}")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(status).encode('utf-8'))
        except Exception as e:
            print(f"[ERROR] handle_check: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
    
    def handle_install(self):
        """Avvia l'installazione delle dipendenze"""
        print("[INSTALLER] === INIZIO INSTALLAZIONE ===")
        try:
            # Step 1: Aggiorna pip
            print("[INSTALLER] Step 1: Aggiornamento pip...")
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--upgrade", "pip"],
                capture_output=True,
                text=True,
                timeout=120
            )
            if result.returncode != 0:
                print(f"[INSTALLER] Avvertimento pip: {result.stderr[:200]}")
            else:
                print("[INSTALLER] ✓ pip aggiornato")
            
            # Step 2: Installa pandas
            print("[INSTALLER] Step 2: Installazione pandas...")
            result_pandas = subprocess.run(
                [sys.executable, "-m", "pip", "install", "pandas"],
                capture_output=True,
                text=True,
                timeout=180
            )
            
            if result_pandas.returncode != 0:
                error_msg = result_pandas.stderr if result_pandas.stderr else "Errore sconosciuto"
                print(f"[INSTALLER] ✗ ERRORE pandas: {error_msg[:200]}")
                raise Exception(f"Errore installazione pandas: {error_msg[:200]}")
            
            print("[INSTALLER] ✓ pandas installato")
            
            # Step 3: Installa openpyxl
            print("[INSTALLER] Step 3: Installazione openpyxl...")
            result_openpyxl = subprocess.run(
                [sys.executable, "-m", "pip", "install", "openpyxl"],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result_openpyxl.returncode != 0:
                error_msg = result_openpyxl.stderr if result_openpyxl.stderr else "Errore sconosciuto"
                print(f"[INSTALLER] ✗ ERRORE openpyxl: {error_msg[:200]}")
                raise Exception(f"Errore installazione openpyxl: {error_msg[:200]}")
            
            print("[INSTALLER] ✓ openpyxl installato")
            print("[INSTALLER] === INSTALLAZIONE COMPLETATA ===")
            
            result = {
                "success": True,
                "message": "Installazione completata con successo!"
            }
        except Exception as e:
            error_msg = str(e)
            print(f"[INSTALLER] === ERRORE: {error_msg} ===")
            result = {
                "success": False,
                "message": error_msg
            }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode('utf-8'))
    
    def handle_install_post(self, body):
        """Gestisci POST di installazione"""
        print(f"[INSTALLER_POST] Body: {body}")
        try:
            data = json.loads(body) if body else {}
            action = data.get("action")
            
            if action == "start_server":
                print("[INSTALLER_POST] Avvio server demo...")
                # Avvia il server della demo in background
                threading.Thread(
                    target=self.start_demo_server,
                    daemon=True
                ).start()
                
                result = {"success": True, "message": "Server avviato!"}
                print("[INSTALLER_POST] ✓ Server demo avviato in background")
            else:
                print(f"[INSTALLER_POST] Azione sconosciuta: {action}")
                result = {"success": False, "message": f"Azione sconosciuta: {action}"}
            
        except Exception as e:
            print(f"[INSTALLER_POST] Errore: {e}")
            result = {"success": False, "message": f"Errore: {str(e)}"}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode('utf-8'))
    
    @staticmethod
    def start_demo_server():
        """Avvia il server della demo"""
        try:
            print("[DEMO_SERVER] Avvio run_demo.py...")
            # Cambia in dir corretta
            os.chdir('/workspaces/operneurope')
            
            result = subprocess.run(
                [sys.executable, "run_demo.py"],
                capture_output=False,  # Mostra output
                text=True
            )
            print(f"[DEMO_SERVER] Server terminato con codice: {result.returncode}")
        except Exception as e:
            print(f"[DEMO_SERVER] Errore: {e}")
    
    @staticmethod
    def check_python():
        """Verifica Python"""
        try:
            version = f"{sys.version_info.major}.{sys.version_info.minor}"
            if sys.version_info >= (3, 8):
                return {
                    "ok": True,
                    "version": version,
                    "message": f"Python {version} ✓"
                }
            else:
                return {
                    "ok": False,
                    "version": version,
                    "message": f"Python 3.8+ richiesto, trovato {version}"
                }
        except Exception as e:
            return {
                "ok": False,
                "message": f"Errore: {str(e)}"
            }
    
    @staticmethod
    def check_module(module_name):
        """Verifica se un modulo Python è installato"""
        try:
            __import__(module_name)
            return {
                "ok": True,
                "message": f"{module_name} ✓"
            }
        except ImportError:
            return {
                "ok": False,
                "message": f"{module_name} mancante"
            }
        except Exception as e:
            return {
                "ok": False,
                "message": f"{module_name}: Errore ({str(e)[:30]})"
            }
    
    @staticmethod
    def check_structure():
        """Verifica la struttura del progetto"""
        required = [
            "openeurope.py",
            "run_demo.py",
            "demo/OpenEurope_Demo_Semplice_v3/app.js"
        ]
        
        results = {}
        all_ok = True
        for f in required:
            exists = Path(f).exists()
            results[f] = exists
            if not exists:
                all_ok = False
                print(f"[CHECK_STRUCTURE] ✗ File mancante: {f}")
        
        return {
            "ok": all_ok,
            "message": "Struttura OK" if all_ok else "File mancanti",
            "files": results
        }
    
    @staticmethod
    def get_html():
        """Ritorna l'HTML dell'installer"""
        return """
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenEurope - Web Installer</title>
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
        
        .header {
            text-align: center;
            margin-bottom: 40px;
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
        
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: #666;
            font-size: 14px;
        }
        
        .checks {
            margin: 30px 0;
        }
        
        .check-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            background: #f5f5f5;
            border-left: 4px solid #ddd;
            transition: all 0.3s ease;
        }
        
        .check-item.success {
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
        
        .check-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
            font-size: 14px;
            color: white;
            flex-shrink: 0;
        }
        
        .check-item.success .check-icon {
            background: #4caf50;
        }
        
        .check-item.error .check-icon {
            background: #f44336;
        }
        
        .check-item.loading .check-icon {
            background: #2196f3;
        }
        
        .check-text {
            flex: 1;
        }
        
        .check-label {
            font-weight: 600;
            color: #333;
            font-size: 14px;
            margin-bottom: 3px;
        }
        
        .check-message {
            color: #666;
            font-size: 12px;
        }
        
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
        
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 13px;
            color: #1976d2;
            line-height: 1.5;
            display: none;
        }
        
        .info-box.show {
            display: block;
        }
        
        .info-box.error {
            background: #ffebee;
            border-left-color: #f44336;
            color: #c62828;
        }
        
        .info-box.success {
            background: #e8f5e9;
            border-left-color: #4caf50;
            color: #2e7d32;
        }
        
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
        <div class="header">
            <div class="logo">OE</div>
            <h1>OpenEurope</h1>
            <p class="subtitle">Installer Web</p>
        </div>
        
        <div class="checks" id="checks">
            <div class="check-item loading" id="check-python">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">Python</div>
                    <div class="check-message" id="python-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <div class="check-item loading" id="check-pandas">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">pandas</div>
                    <div class="check-message" id="pandas-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <div class="check-item loading" id="check-openpyxl">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">openpyxl</div>
                    <div class="check-message" id="openpyxl-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <div class="check-item loading" id="check-structure">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">Struttura progetto</div>
                    <div class="check-message" id="structure-msg">Verifica in corso...</div>
                </div>
            </div>
        </div>
        
        <div class="actions">
            <button class="btn-secondary" onclick="location.reload()">Aggiorna</button>
            <button class="btn-primary" id="btn-install" onclick="installDependencies()" disabled>
                Installa Dipendenze
            </button>
            <button class="btn-primary" id="btn-start" onclick="startServer()" disabled style="display: none;">
                Avvia OpenEurope
            </button>
        </div>
        
        <div class="info-box" id="info-box"></div>
    </div>
    
    <script>
        let autoInstallAttempted = false;
        
        async function checkStatus() {
            try {
                console.log("[CHECK] Verifica dello stato...");
                const response = await fetch('/api/check');
                const status = await response.json();
                
                console.log("[CHECK] Risultato:", status);
                
                updateCheck('python', status.python);
                updateCheck('pandas', status.pandas);
                updateCheck('openpyxl', status.openpyxl);
                updateCheck('structure', status.structure);
                
                if (status.all_ok) {
                    console.log("[CHECK] Tutto OK! Avvio automatico...");
                    document.getElementById('btn-install').style.display = 'none';
                    document.getElementById('btn-start').style.display = 'block';
                    document.getElementById('btn-start').disabled = false;
                    showInfo('✓ Sistema pronto! Avvio automatico in corso...', 'success');
                    
                    setTimeout(() => {
                        console.log("[AUTO_START] Avvio server...");
                        startServerAutomatic();
                    }, 1500);
                } else if (!status.pandas.ok || !status.openpyxl.ok) {
                    if (!autoInstallAttempted) {
                        console.log("[AUTO_INSTALL] Dipendenze mancanti, installo automaticamente...");
                        autoInstallAttempted = true;
                        showInfo('📦 Installo dipendenze automaticamente...', 'info');
                        setTimeout(() => {
                            installDependencies();
                        }, 500);
                    }
                    document.getElementById('btn-install').disabled = false;
                } else {
                    document.getElementById('btn-install').disabled = false;
                }
            } catch (error) {
                console.error('[ERROR]', error);
                showInfo('❌ Errore nella verifica. Riprova.', 'error');
                document.getElementById('btn-install').disabled = false;
            }
        }
        
        function updateCheck(name, result) {
            const element = document.getElementById(`check-${name}`);
            const msgElement = document.getElementById(`${name}-msg`);
            
            element.classList.remove('loading', 'success', 'error');
            element.classList.add(result.ok ? 'success' : 'error');
            msgElement.textContent = result.message || (result.ok ? 'OK' : 'Errore');
        }
        
        async function installDependencies() {
            console.log("[INSTALL] Inizio installazione...");
            const btn = document.getElementById('btn-install');
            btn.disabled = true;
            btn.textContent = '📦 Installazione in corso...';
            
            try {
                const response = await fetch('/api/install');
                const result = await response.json();
                
                console.log("[INSTALL] Risultato:", result);
                
                if (result.success) {
                    showInfo('✓ Dipendenze installate! Ricaricando...', 'success');
                    setTimeout(() => {
                        location.reload();
                    }, 1500);
                } else {
                    showInfo(`❌ ${result.message}`, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Installa Dipendenze';
                }
            } catch (error) {
                console.error('[INSTALL_ERROR]', error);
                showInfo('❌ Errore durante installazione. Riprova.', 'error');
                btn.disabled = false;
                btn.textContent = 'Installa Dipendenze';
            }
        }
        
        async function startServer() {
            console.log("[START_SERVER] Avvio server...");
            const btn = document.getElementById('btn-start');
            btn.disabled = true;
            btn.textContent = '🚀 Avvio in corso...';
            
            try {
                const response = await fetch('/api/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start_server' })
                });
                
                const result = await response.json();
                console.log("[START_SERVER] Risultato:", result);
                
                if (result.success) {
                    showInfo('✓ Server avviato! Reindirizzamento...', 'success');
                    setTimeout(() => {
                        window.location.href = 'http://localhost:8000/START_HERE.html';
                    }, 1000);
                } else {
                    showInfo(`❌ ${result.message}`, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Avvia OpenEurope';
                }
            } catch (error) {
                console.error('[START_SERVER_ERROR]', error);
                showInfo('❌ Errore nel avvio. Riprova.', 'error');
                btn.disabled = false;
                btn.textContent = 'Avvia OpenEurope';
            }
        }
        
        async function startServerAutomatic() {
            console.log("[AUTO_START_SERVER] Avvio automatico del server...");
            try {
                const response = await fetch('/api/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start_server' })
                });
                
                const result = await response.json();
                console.log("[AUTO_START_SERVER] Risultato:", result);
                
                if (result.success) {
                    showInfo('✓ Server avviato! Apertura dashboard...', 'success');
                    setTimeout(() => {
                        window.location.href = 'http://localhost:8000/START_HERE.html';
                    }, 1000);
                } else {
                    console.error("[AUTO_START_SERVER] Errore:", result.message);
                    showInfo('❌ Errore. Clicca il pulsante per riprovare.', 'error');
                }
            } catch (error) {
                console.error('[AUTO_START_SERVER_ERROR]', error);
                showInfo('❌ Errore di connessione.', 'error');
            }
        }
        
        function showInfo(message, type = 'info') {
            const box = document.getElementById('info-box');
            box.textContent = message;
            box.className = `info-box show ${type}`;
        }
        
        // Avvia verifiche al caricamento
        window.addEventListener('load', () => {
            console.log("[LOAD] Pagina caricata, inizio verifiche...");
            checkStatus();
            
            // Riverifica ogni 3 secondi
            setInterval(checkStatus, 3000);
        });
    </script>
</body>
</html>
        """

def main():
    """Avvia il web installer"""
    try:
        os.chdir('/workspaces/operneurope')
    except:
        pass
    
    print(f"\n{'='*60}")
    print("  🚀 OpenEurope - Web Installer")
    print(f"{'='*60}\n")
    print(f"✓ Installer disponibile su: http://localhost:{PORT}")
    print(f"✓ Premi Ctrl+C per fermare\n")
    
    try:
        # Apri browser
        try:
            webbrowser.open(f'http://localhost:{PORT}')
            print(f"✓ Browser aperto automaticamente\n")
        except:
            print(f"⚠ Apri manualmente: http://localhost:{PORT}\n")
        
        # Avvia server
        with socketserver.TCPServer(("", PORT), InstallerHandler) as httpd:
            print(f"[SERVER] Web installer in esecuzione...\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✓ Installer fermato")
    except Exception as e:
        print(f"\n✗ Errore: {e}")

if __name__ == "__main__":
    main()
