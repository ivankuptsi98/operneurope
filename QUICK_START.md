# 🚀 Come Avviare OpenEurope in Locale

## ⭐ Web Installer (CONSIGLIATO - TUTTI I SISTEMI)

### Comando unico per Windows, macOS, Linux:
```bash
python3 web_installer.py
```

**Cosa accade AUTOMATICAMENTE:**
1. ✅ Si apre il browser su http://localhost:9999
2. ✅ Verifica Python 3.8+ ✓
3. ✅ Verifica e installa pandas ✓
4. ✅ Verifica e installa openpyxl ✓
5. ✅ Verifica la struttura del progetto ✓
6. ✅ Avvia il server demo su http://localhost:8000
7. ✅ Reindirizza automaticamente alla dashboard

**Non devi fare niente! Tutto è automatico!**

---

## Opzione 2: Script Automatico

### Windows:
```batch
install_and_run.bat
```

### macOS/Linux:
```bash
chmod +x install_and_run.sh
./install_and_run.sh
```

### Python (Universal):
```bash
python3 install_and_run.py
```

---

## Opzione 3: Manuale (Se le altre non funzionano)

### 1. Clona il repository
```bash
git clone https://github.com/ivankuptsi98/operneurope.git
cd operneurope
```

### 2. Installa dipendenze
```bash
pip install pandas openpyxl
```

### 3. Avvia il server
```bash
python run_demo.py
```

### 4. Apri nel browser
```
http://localhost:8000/START_HERE.html
```

---

## 🔧 Requisiti Minimi

- Python 3.8+
- pip (package manager Python)
- Connessione internet (per CDN: Chart.js, PapaParse, etc.)

### Verifica Python:
```bash
python --version
```

Se non hai Python, scaricalo da: https://www.python.org/

---

## ❓ FAQ

**D: Il browser non si apre automaticamente?**
- A: Apri manualmente http://localhost:8000/START_HERE.html

**D: Errore "Porta 8000 già in uso"?**
- A: Un'altra app usa quella porta. Su Linux/macOS: `lsof -i :8000`

**D: Errore "pandas not found"?**
- A: Installa: `pip install pandas openpyxl`

**D: Come fermo il server?**
- A: Premi `Ctrl+C` nel terminale

---

## 📚 Prossimi Step

Una volta avviato, puoi:
- ✅ Creare un nuovo progetto di audit
- ✅ Aggiungere utenze (POD/PDR)
- ✅ Inserire consumi mensili
- ✅ Visualizzare grafici in tempo reale
- ✅ Esportare report PDF

Buon lavoro! 🎉
