#!/usr/bin/env python3
"""
OpenEurope - Installer e Launcher
Installa le dipendenze, verifica l'installazione e avvia l'applicazione web
"""

import sys
import os
import subprocess
import time
import webbrowser
import json
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
INSTALL_STATUS_PATH = BASE_DIR / "demo" / "OpenEurope_Demo_Semplice_v3" / "install_status.json"

# Colori per output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header():
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}")
    print("  OpenEurope - Installer & Launcher")
    print(f"{'='*60}{Colors.END}\n")

def print_status(message, status="info"):
    """Stampa un messaggio di stato formattato"""
    if status == "info":
        print(f"{Colors.BLUE}ℹ {message}{Colors.END}")
    elif status == "success":
        print(f"{Colors.GREEN}✓ {message}{Colors.END}")
    elif status == "warning":
        print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")
    elif status == "error":
        print(f"{Colors.RED}✗ {message}{Colors.END}")


def write_install_status(status, source="install_and_run"):
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        **status,
    }
    try:
        INSTALL_STATUS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as exc:
        print_status(f"Impossibile aggiornare {INSTALL_STATUS_PATH}: {exc}", "warning")

def check_python_version():
    """Verifica che Python 3.8+ sia installato"""
    print_status("Verifica versione Python...", "info")
    if sys.version_info < (3, 8):
        print_status(f"Python 3.8+ richiesto, trovato Python {sys.version}", "error")
        sys.exit(1)
    print_status(f"Python {sys.version.split()[0]} OK", "success")

def install_dependencies():
    """Installa le dipendenze richieste"""
    print_status("Installazione dipendenze...", "info")
    
    packages = ["pandas", "openpyxl"]
    
    for package in packages:
        print_status(f"Installazione {package}...", "info")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", package],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print_status(f"{package} installato", "success")
        except subprocess.CalledProcessError:
            print_status(f"Errore nell'installazione di {package}", "error")
            print_status("Tentativo di installazione con opzioni verbose...", "warning")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            except subprocess.CalledProcessError:
                print_status(f"Impossibile installare {package}", "error")
                sys.exit(1)

def verify_dependencies():
    """Verifica che le dipendenze siano correttamente installate"""
    print_status("Verifica dipendenze...", "info")
    
    packages = {
        "pandas": "Elaborazione dati",
        "openpyxl": "Lettura file Excel"
    }
    
    all_ok = True
    for package, description in packages.items():
        try:
            __import__(package)
            print_status(f"{package} ({description})", "success")
        except ImportError:
            print_status(f"{package} ({description}) - NON TROVATO", "error")
            all_ok = False
    
    return all_ok

def check_project_structure():
    """Verifica che la struttura del progetto sia corretta"""
    print_status("Verifica struttura progetto...", "info")
    
    required_files = [
        "openeurope.py",
        "run_demo.py",
        "demo/OpenEurope_Demo_Semplice_v3/app.js",
        "demo/OpenEurope_Demo_Semplice_v3/index.html",
        "sample_data.csv"
    ]
    
    all_ok = True
    for filepath in required_files:
        full_path = BASE_DIR / filepath
        if full_path.exists():
            print_status(f"{filepath}", "success")
        else:
            print_status(f"{filepath} - NON TROVATO", "error")
            all_ok = False
    
    return all_ok


def check_server_status():
    """Verifica se il server demo è attivo"""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        result = sock.connect_ex(('127.0.0.1', 8000))
        sock.close()
        if result == 0:
            return {"ok": True, "message": "Server attivo su 8000"}
        return {"ok": False, "message": "Server demo non avviato"}
    except Exception:
        return {"ok": False, "message": "Server demo non raggiungibile"}


def build_install_status():
    def module_status(name):
        try:
            __import__(name)
            return {"ok": True, "message": f"{name} ✓"}
        except ImportError:
            return {"ok": False, "message": f"{name} mancante"}

    structure_ok = check_project_structure()
    status = {
        "python": {"ok": sys.version_info >= (3, 8), "message": f"Python {sys.version.split()[0]}"},
        "pandas": module_status("pandas"),
        "openpyxl": module_status("openpyxl"),
        "structure": {"ok": structure_ok, "message": "Struttura OK" if structure_ok else "File mancanti"},
        "server": check_server_status(),
    }
    status["all_ok"] = all([
        status["python"]["ok"],
        status["pandas"]["ok"],
        status["openpyxl"]["ok"],
        status["structure"]["ok"],
    ])
    return status

def start_server():
    """Avvia il server di demo"""
    print_status("Avvio server OpenEurope...", "info")
    
    try:
        # Avvia il server in background
        process = subprocess.Popen(
            [sys.executable, "run_demo.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=BASE_DIR
        )
        
        print_status("Server in avvio...", "info")
        time.sleep(3)  # Attendi che il server si avvii
        
        # Verifica che il processo sia ancora in esecuzione
        if process.poll() is None:
            print_status("Server avviato con successo (PID: {})".format(process.pid), "success")
            return process
        else:
            stdout, stderr = process.communicate()
            print_status(f"Errore nell'avvio del server:\n{stderr}", "error")
            sys.exit(1)
            
    except Exception as e:
        print_status(f"Errore nell'avvio del server: {e}", "error")
        sys.exit(1)

def test_server_connection():
    """Testa che il server sia raggiungibile"""
    print_status("Test connessione server...", "info")
    
    import socket
    
    for attempt in range(5):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', 8000))
            sock.close()
            
            if result == 0:
                print_status("Server raggiungibile su http://localhost:8000", "success")
                return True
            else:
                print_status(f"Tentativo {attempt + 1}/5: Server non pronto, attesa...", "warning")
                time.sleep(1)
        except Exception as e:
            print_status(f"Tentativo {attempt + 1}/5: {e}", "warning")
            time.sleep(1)
    
    print_status("Server non raggiungibile", "error")
    return False

def open_browser():
    """Apre il browser alla URL dell'applicazione"""
    print_status("Apertura browser...", "info")
    
    url = "http://localhost:8000/START_HERE.html"
    try:
        webbrowser.open(url)
        print_status(f"Browser aperto: {url}", "success")
    except Exception as e:
        print_status(f"Impossibile aprire il browser automaticamente: {e}", "warning")
        print_status(f"Apri manualmente: {url}", "info")

def main():
    """Funzione principale"""
    print_header()
    
    # Verifica Python
    check_python_version()
    
    # Verifica struttura progetto
    if not check_project_structure():
        print_status("Struttura progetto incompleta!", "error")
        sys.exit(1)

    write_install_status(build_install_status())
    
    print()
    
    # Installa dipendenze
    install_dependencies()
    
    print()
    
    # Verifica dipendenze
    if not verify_dependencies():
        print_status("Verificare l'installazione delle dipendenze", "error")
        sys.exit(1)

    write_install_status(build_install_status())
    
    print()
    
    # Avvia server
    server_process = start_server()
    
    print()
    
    # Testa connessione
    if not test_server_connection():
        print_status("Chiusura server e uscita", "error")
        server_process.terminate()
        sys.exit(1)

    write_install_status(build_install_status())
    
    print()
    
    # Apri browser
    open_browser()
    
    print()
    print(f"{Colors.GREEN}{Colors.BOLD}✓ OpenEurope è pronto!{Colors.END}")
    print(f"{Colors.BLUE}URL: http://localhost:8000/START_HERE.html{Colors.END}")
    print(f"\n{Colors.YELLOW}Premi Ctrl+C per fermare il server{Colors.END}\n")
    
    # Mantieni il server in esecuzione
    try:
        server_process.wait()
    except KeyboardInterrupt:
        print_status("Arresto server...", "info")
        server_process.terminate()
        server_process.wait(timeout=5)
        print_status("Server fermato", "success")

if __name__ == "__main__":
    main()
