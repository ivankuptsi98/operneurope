# PowerShell script per creare un .exe usando PyInstaller
# Eseguire su Windows con Python 3.8+

# 1) Crea e attiva virtualenv (opzionale)
# python -m venv .venv
# .\.venv\Scripts\Activate.ps1

# 2) Installa PyInstaller
pip install --upgrade pip
pip install pyinstaller

# 3) Build dell'exe (onefile)
# Questo creerà dist/web_installer.exe
pyinstaller --onefile --name web_installer web_installer.py

# Note:
# - Eseguire nello stesso folder del repository
# - Il risultato si trova in 'dist\web_installer.exe'
# - Per includere file addizionali, modificare lo spec di PyInstaller
