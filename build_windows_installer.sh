#!/usr/bin/env bash
# Script helper: istruzioni per creare .exe (da Windows)
# Questo script non crea direttamente l'.exe su Linux. Serve come guida automatizzabile su Windows.

set -euo pipefail

echo "Questo script è pensato per essere eseguito su Windows (Git Bash o WSL)."
echo "Per buildare l'exe, eseguire il file PowerShell 'build_windows_installer.ps1' su Windows." 

echo "Suggerimento rapido: su Windows PowerShell (con permessi):"
echo "  powershell -ExecutionPolicy Bypass -File build_windows_installer.ps1"
