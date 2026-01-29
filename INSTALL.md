# 🚀 OpenEurope - Installation & Launch Guide

## Quick Start - Installazione Automatica

### ⭐ Metodo Consigliato: Web Installer (TUTTI i sistemi)

1. Scarica il repository
2. Apri il terminale nella cartella del progetto
3. Esegui:
```bash
python3 web_installer.py
```

**Cosa succede automaticamente:**
- ✅ Browser si apre su http://localhost:9999
- ✅ Verifica Python 3.8+
- ✅ Verifica e installa pandas, openpyxl
- ✅ Avvia il server demo
- ✅ Apre la dashboard su http://localhost:8000

### Windows (Alternativo)
```batch
install_and_run.bat
```

### macOS / Linux (Alternativo)
```bash
chmod +x install_and_run.sh
./install_and_run.sh
```

### Cross-platform Python (Alternativo)
```bash
python3 install_and_run.py
```

---

## ✅ Cosa Fa il Web Installer

Il processo completamente automatico:
1. ✓ Verifica la versione di Python (richiesto 3.8+)
2. ✓ Installa pandas e openpyxl automaticamente
3. ✓ Verifica la struttura del progetto
4. ✓ Avvia il server HTTP demo
5. ✓ Reindirizza automaticamente alla dashboard
6. ✓ Interfaccia web intuitiva nel browser

**Non devi fare niente oltre a eseguire `python3 web_installer.py`!**

---

## 📊 Dopo l'Avvio

L'applicazione sarà disponibile su:
- **URL**: http://localhost:8000/START_HERE.html
- **Browser**: Si aprirà automaticamente

Puoi usare OpenEurope per:
- ✅ Creare audit energetici
- ✅ Gestire utenze (POD/PDR)
- ✅ Inserire consumi mensili
- ✅ Visualizzare grafici in tempo reale
- ✅ Esportare report PDF

---

## 🛠️ Installazione Manuale (Se Necessario)

Se l'installer automatico non funziona:

```bash
# 1. Clona il repository
git clone https://github.com/ivankuptsi98/operneurope.git
cd operneurope

# 2. Installa dipendenze
pip install pandas openpyxl

# 3. Avvia il server
python run_demo.py

# 4. Apri nel browser
# http://localhost:8000/START_HERE.html
```

---

## 🐛 Troubleshooting

### Errore: "Python non trovato"
- Installa Python 3.8+ da https://www.python.org/

### Errore: "Porta 8000 già in uso"
- Chiudi il processo che usa la porta 8000
- Su Linux/macOS: `lsof -i :8000`

### Errore: "Modulo pandas non trovato"
Installa manualmente:
```bash
pip install pandas openpyxl
```

### Browser non si apre automaticamente
Apri manualmente: http://localhost:8000/START_HERE.html

---

## 📝 Requisiti di Sistema

- Python 3.8+
- 100MB di spazio disco
- Connessione internet (per CDN: Chart.js, PapaParse, etc.)
- Browser moderno (Chrome, Firefox, Safari, Edge)

---

## 📚 Documentazione Completa

Vedi [README.md](README.md) nel repository per maggiori dettagli.

---

## 🖥️ Creare un installer Windows (.exe)

Se vuoi distribuire un installer standalone per Windows, usa `PyInstaller` su una macchina Windows (o CI Windows).

1. Apri PowerShell nella cartella del progetto
2. Esegui lo script che abbiamo incluso:

```powershell
powershell -ExecutionPolicy Bypass -File build_windows_installer.ps1
```

3. L'exe risultante sarà in `dist\\web_installer.exe`

Note:
- La build dell'.exe deve essere fatta su Windows per compatibilità nativa.
- Per build cross-platform in CI, configura una runner Windows (GitHub Actions, Azure Pipelines).
