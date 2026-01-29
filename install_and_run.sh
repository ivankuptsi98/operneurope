#!/bin/bash

# OpenEurope - Installer & Launcher per Linux/macOS
# Installa dipendenze e avvia l'applicazione

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}${BOLD}============================================================${NC}"
echo -e "${BLUE}${BOLD}  OpenEurope - Installer & Launcher${NC}"
echo -e "${BLUE}${BOLD}============================================================${NC}\n"

# Verifica Python
echo -e "${BLUE}[*]${NC} Verifica Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[X] Python 3 non trovato! Installare Python 3.8+${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}[+] Python $PYTHON_VERSION OK${NC}"

# Installa dipendenze
echo ""
echo -e "${BLUE}[*]${NC} Installazione dipendenze..."

echo -e "${BLUE}[*]${NC} Installazione pandas..."
python3 -m pip install --quiet pandas
if [ $? -ne 0 ]; then
    echo -e "${RED}[X] Errore nell'installazione di pandas${NC}"
    exit 1
fi
echo -e "${GREEN}[+] pandas installato${NC}"

echo -e "${BLUE}[*]${NC} Installazione openpyxl..."
python3 -m pip install --quiet openpyxl
if [ $? -ne 0 ]; then
    echo -e "${RED}[X] Errore nell'installazione di openpyxl${NC}"
    exit 1
fi
echo -e "${GREEN}[+] openpyxl installato${NC}"

# Verifica dipendenze
echo ""
echo -e "${BLUE}[*]${NC} Verifica dipendenze..."

python3 -c "import pandas" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}[X] pandas non trovato${NC}"
    exit 1
fi
echo -e "${GREEN}[+] pandas OK${NC}"

python3 -c "import openpyxl" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}[X] openpyxl non trovato${NC}"
    exit 1
fi
echo -e "${GREEN}[+] openpyxl OK${NC}"

# Verifica struttura progetto
echo ""
echo -e "${BLUE}[*]${NC} Verifica struttura progetto..."

if [ ! -f "openeurope.py" ]; then
    echo -e "${RED}[X] openeurope.py non trovato${NC}"
    exit 1
fi
echo -e "${GREEN}[+] openeurope.py OK${NC}"

if [ ! -f "run_demo.py" ]; then
    echo -e "${RED}[X] run_demo.py non trovato${NC}"
    exit 1
fi
echo -e "${GREEN}[+] run_demo.py OK${NC}"

if [ ! -f "demo/OpenEurope_Demo_Semplice_v3/app.js" ]; then
    echo -e "${RED}[X] app.js non trovato${NC}"
    exit 1
fi
echo -e "${GREEN}[+] app.js OK${NC}"

# Test connessione porta
check_port() {
    if command -v lsof &> /dev/null; then
        lsof -i :8000 >/dev/null 2>&1
        return $?
    elif command -v ss &> /dev/null; then
        ss -tuln | grep :8000 >/dev/null 2>&1
        return $?
    else
        return 1
    fi
}

if check_port; then
    echo -e "${YELLOW}[!] Porta 8000 già in uso. Fermare il processo e riprovare.${NC}"
    exit 1
fi

# Avvia il server
echo ""
echo -e "${BLUE}[*]${NC} Avvio server OpenEurope..."
echo -e "${GREEN}[+]${NC} Server in avvio... apri il browser tra qualche secondo"
echo ""

# Detect OS e apri browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sleep 2
    open "http://localhost:8000/START_HERE.html"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    sleep 2
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:8000/START_HERE.html"
    fi
fi

# Avvia il server in foreground
python3 run_demo.py

echo ""
echo -e "${GREEN}[+] OpenEurope fermato${NC}"
