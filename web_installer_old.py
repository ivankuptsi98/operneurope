#!/usr/bin/env python3
"""
OpenEurope - Web Installer
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
from pathlib import Path

PORT = 9999

class InstallerHandler(http.server.SimpleHTTPRequestHandler):
    """Handler per il web installer"""
    
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
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(status).encode('utf-8'))
    
    def handle_install(self):
        """Avvia l'installazione"""
        try:
            print("[INSTALLER] Inizio installazione delle dipendenze...")
            
            # Aggiorna pip
            print("[INSTALLER] Aggiornamento pip...")
            result_pip = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--upgrade", "pip"],
                capture_output=True,
                text=True,
                timeout=120
            )
            if result_pip.returncode == 0:
                print("[INSTALLER] pip aggiornato con successo")
            else:
                print(f"[INSTALLER] Avvertimento pip: {result_pip.stderr}")
            
            # Installa pandas
            print("[INSTALLER] Installazione di pandas...")
            result_pandas = subprocess.run(
                [sys.executable, "-m", "pip", "install", "pandas"],
                capture_output=True,
                text=True,
                timeout=180
            )
            
            if result_pandas.returncode != 0:
                error_detail = result_pandas.stderr if result_pandas.stderr else "Errore sconosciuto"
                raise Exception(f"Errore pandas: {error_detail}")
            
            print("[INSTALLER] pandas installato correttamente")
            
            # Installa openpyxl
            print("[INSTALLER] Installazione di openpyxl...")
            result_openpyxl = subprocess.run(
                [sys.executable, "-m", "pip", "install", "openpyxl"],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result_openpyxl.returncode != 0:
                error_detail = result_openpyxl.stderr if result_openpyxl.stderr else "Errore sconosciuto"
                raise Exception(f"Errore openpyxl: {error_detail}")
            
            print("[INSTALLER] openpyxl installato correttamente")
            print("[INSTALLER] Installazione completata con successo!")
            
            result = {
                "success": True,
                "message": "Installazione completata! Ricaricando..."
            }
        except Exception as e:
            error_msg = str(e)
            print(f"[INSTALLER] ERRORE: {error_msg}")
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
        try:
            data = json.loads(body) if body else {}
            
            if data.get("action") == "start_server":
                # Avvia il server della demo in background
                threading.Thread(
                    target=self.start_demo_server,
                    daemon=True
                ).start()
                
                result = {"success": True, "message": "Server avviato!"}
            else:
                result = {"success": False, "message": "Azione sconosciuta"}
            
        except Exception as e:
            result = {"success": False, "message": f"Errore: {str(e)}"}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode('utf-8'))
    
    @staticmethod
    def start_demo_server():
        """Avvia il server della demo"""
        try:
            subprocess.Popen(
                [sys.executable, "run_demo.py"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(3)  # Attendi che si avvii
        except Exception as e:
            print(f"Errore nell'avvio del server: {e}")
    
    @staticmethod
    def check_python():
        """Verifica Python"""
        try:
            version = f"{sys.version_info.major}.{sys.version_info.minor}"
            if sys.version_info >= (3, 8):
                return {
                    "ok": True,
                    "version": version,
                    "message": f"Python {version} OK"
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
                "message": f"{module_name} installato"
            }
        except ImportError:
            return {
                "ok": False,
                "message": f"{module_name} non trovato"
            }
    
    @staticmethod
    def check_structure():
        """Verifica la struttura del progetto"""
        required = [
            "openeurope.py",
            "run_demo.py",
            "demo/OpenEurope_Demo_Semplice_v3/app.js"
        ]
        
        all_ok = all(Path(f).exists() for f in required)
        
        return {
            "ok": all_ok,
            "message": "Struttura OK" if all_ok else "File mancanti",
            "files": {f: Path(f).exists() for f in required}
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
        
        .progress-box {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            display: none;
        }
        
        .progress-box.show {
            display: block;
        }
        
        .progress-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 15px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s ease;
        }
        
        .progress-log {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 10px;
            font-size: 12px;
            font-family: 'Courier New', monospace;
            max-height: 200px;
            overflow-y: auto;
            color: #333;
            line-height: 1.5;
        }
        
        .log-line {
            padding: 4px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .log-line:last-child {
            border-bottom: none;
        }
        
        .log-success {
            color: #4caf50;
        }
        
        .log-info {
            color: #2196f3;
        }
        
        .log-error {
            color: #f44336;
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
        
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">OE</div>
            <h1>OpenEurope</h1>
            <p class="subtitle">Installer Web Interattivo</p>
        </div>
        
        <div class="checks" id="checks">
            <!-- Verifica Python -->
            <div class="check-item loading" id="check-python">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">Python</div>
                    <div class="check-message" id="python-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <!-- Verifica pandas -->
            <div class="check-item loading" id="check-pandas">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">pandas</div>
                    <div class="check-message" id="pandas-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <!-- Verifica openpyxl -->
            <div class="check-item loading" id="check-openpyxl">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">openpyxl</div>
                    <div class="check-message" id="openpyxl-msg">Verifica in corso...</div>
                </div>
            </div>
            
            <!-- Verifica struttura -->
            <div class="check-item loading" id="check-structure">
                <div class="check-icon"><span class="spinner"></span></div>
                <div class="check-text">
                    <div class="check-label">Struttura progetto</div>
                    <div class="check-message" id="structure-msg">Verifica in corso...</div>
                </div>
            </div>
        </div>
        
        <!-- Barra di progresso -->
        <div class="progress-box" id="progress-box">
            <div class="progress-title" id="progress-title">Installazione in corso...</div>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-log" id="progress-log"></div>
        </div>
        
        <!-- Messaggi info -->
        <div class="info-box" id="info-box"></div>
        
        <div class="actions">
            <button class="btn-secondary" onclick="location.reload()">Aggiorna</button>
            <button class="btn-primary" id="btn-install" onclick="installDependencies()" disabled>
                Installa Dipendenze
            </button>
            <button class="btn-primary" id="btn-start" onclick="startServer()" disabled style="display: none;">
                Avvia Applicazione
            </button>
        </div>
    </div>
    
    <script>
        let installInProgress = false;
        let autoInstallAttempted = false;
        
        async function checkStatus() {
            try {
                const response = await fetch('/api/check');
                const status = await response.json();
                
                updateCheck('python', status.python);
                updateCheck('pandas', status.pandas);
                updateCheck('openpyxl', status.openpyxl);
                updateCheck('structure', status.structure);
                
                if (status.all_ok) {
                    document.getElementById('btn-install').disabled = true;
                    document.getElementById('btn-install').style.display = 'none';
                    document.getElementById('btn-start').disabled = false;
                    document.getElementById('btn-start').style.display = 'block';
                    showInfo('✓ Tutto è pronto! Avvio automatico in corso...', 'success');
                    
                    // Avvia automaticamente il server
                    setTimeout(() => {
                        startServerAutomatic();
                    }, 1500);
                } else if (!status.pandas.ok || !status.openpyxl.ok) {
                    // Installa automaticamente se dipendenze mancano
                    if (!autoInstallAttempted) {
                        autoInstallAttempted = true;
                        addLog('Dipendenze non trovate. Installazione automatica...', 'info');
                        installDependencies();
                    }
                }
            } catch (error) {
                console.error('Errore:', error);
                addLog('Errore nella verifica dello stato', 'error');
        }
        
        function updateCheck(name, result) {
            const element = document.getElementById(`check-${name}`);
            const msgElement = document.getElementById(`${name}-msg`);
            
            element.classList.remove('loading', 'success', 'error');
            element.classList.add(result.ok ? 'success' : 'error');
            msgElement.textContent = result.message || (result.ok ? 'OK' : 'Errore');
        }
        
        async function installDependencies() {
            if (installInProgress) return;
            installInProgress = true;
            
            const btn = document.getElementById('btn-install');
            btn.disabled = true;
            
            // Mostra barra di progresso
            const progressBox = document.getElementById('progress-box');
            const progressLog = document.getElementById('progress-log');
            const progressFill = document.getElementById('progress-fill');
            progressBox.classList.add('show');
            progressLog.innerHTML = '';
            progressFill.style.width = '0%';
            
            addLog('Avvio installazione...', 'info');
            progressFill.style.width = '20%';
            
            try {
                addLog('Installazione di pandas...', 'info');
                progressFill.style.width = '40%';
                
                const response = await fetch('/api/install');
                const result = await response.json();
                
                progressFill.style.width = '80%';
                
                if (result.success) {
                    addLog('✓ Installazione completata!', 'success');
                    progressFill.style.width = '100%';
                    showInfo('✓ Dipendenze installate con successo! Ricaricando...', 'success');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    addLog(`✗ Errore: ${result.message}`, 'error');
                    showInfo(`✗ Errore: ${result.message}`, 'error');
                    btn.disabled = false;
                    installInProgress = false;
                }
            } catch (error) {
                addLog(`✗ Errore di connessione: ${error.message}`, 'error');
                showInfo('✗ Errore durante l\'installazione. Riprova.', 'error');
                btn.disabled = false;
                installInProgress = false;
            }
        }
        
        async function startServer() {
            const btn = document.getElementById('btn-start');
            btn.disabled = true;
            btn.textContent = 'Avvio in corso...';
            
            try {
                const response = await fetch('/api/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start_server' })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showInfo('✓ Server avviato! Reindirizzamento in corso...', 'success');
                    setTimeout(() => {
                        window.location.href = 'http://localhost:8000/START_HERE.html';
                    }, 1500);
                } else {
                    showInfo(`✗ Errore: ${result.message}`, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Avvia Applicazione';
                }
            } catch (error) {
                showInfo(`✗ Errore nell'avvio del server: ${error.message}`, 'error');
                btn.disabled = false;
                btn.textContent = 'Avvia Applicazione';
            }
        }
        
        async function startServerAutomatic() {
            try {
                const response = await fetch('/api/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start_server' })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addLog('✓ Server avviato con successo!', 'success');
                    setTimeout(() => {
                        addLog('✓ Apertura dashboard in corso...', 'success');
                        window.location.href = 'http://localhost:8000/START_HERE.html';
                    }, 1000);
                } else {
                    addLog(`✗ Errore nell'avvio: ${result.message}`, 'error');
                }
            } catch (error) {
                addLog(`✗ Errore di connessione: ${error.message}`, 'error');
            }
        }
        
        function addLog(message, type = 'info') {
            const log = document.getElementById('progress-log');
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('it-IT');
            line.textContent = `[${timestamp}] ${message}`;
            
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        }
        
        function showInfo(message, type = 'info') {
            const box = document.getElementById('info-box');
            box.textContent = message;
            box.className = `info-box show ${type}`;
        }
        
        // Controlla lo stato al caricamento
        window.addEventListener('load', () => {
            addLog('Verifica dello stato in corso...', 'info');
            checkStatus();
            
            // Riverifica ogni 2 secondi durante l'installazione
            setInterval(checkStatus, 2000);
        });
    </script>
</body>
</html>
        """

def main():
    """Avvia il web installer"""
    os.chdir('/workspaces/operneurope')
    
    print(f"\n{'='*60}")
    print("  OpenEurope - Web Installer")
    print(f"{'='*60}\n")
    print(f"✓ Installer disponibile su: http://localhost:{PORT}")
    print(f"✓ Apri il browser automaticamente...")
    print(f"✓ Premi Ctrl+C per fermare\n")
    
    try:
        webbrowser_available = True
        try:
            import webbrowser
            webbrowser.open(f'http://localhost:{PORT}')
        except:
            webbrowser_available = False
            print(f"⚠ Apri manualmente: http://localhost:{PORT}\n")
        
        with socketserver.TCPServer(("", PORT), InstallerHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Installer fermato")
    except Exception as e:
        print(f"✗ Errore: {e}")

if __name__ == "__main__":
    main()
