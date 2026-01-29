#!/usr/bin/env python3

"""
Simple local launcher for the OpenEurope Demo.

This script extracts the provided demo ZIP archive into a temporary
directory (``demo`` by default) and then starts a basic HTTP server
bound to ``localhost`` so you can interact with the application
through your web browser. It uses only standard library modules and
should work on any recent Python 3 interpreter.

Usage:
    python3 run_demo.py

Once running, open ``http://localhost:8000/START_HERE.html`` in your
browser to launch the demo. You can stop the server at any time
by pressing :kbd:`Ctrl+C` in the terminal.

Note: This script does not require any external dependencies and
will not modify your repository; it simply extracts the contents
into a local directory for inspection. You can delete the ``demo``
directory after use.
"""

import http.server
import os
import socketserver
import webbrowser
import zipfile
from pathlib import Path

# Path to the ZIP file relative to this script
ZIP_NAME = "OpenEurope_Demo_Semplice_v3.zip"

# Directory where the zip will be extracted
EXTRACT_DIR = "demo"

def ensure_demo_extracted(base_dir: Path) -> Path:
    """Ensure that the demo contents are extracted to ``EXTRACT_DIR``.

    If the directory already exists, the zip file will not be
    re-extracted. The function returns the absolute path to the
    extracted directory.
    """
    extract_path = base_dir / EXTRACT_DIR
    if extract_path.exists():
        return extract_path

    zip_path = base_dir / ZIP_NAME
    if not zip_path.exists():
        raise FileNotFoundError(f"Could not find {ZIP_NAME} in {base_dir}")

    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(extract_path)
    return extract_path


def start_server(directory: Path, port: int = 8000) -> None:
    """Start an HTTP server serving ``directory`` on ``localhost``.

    The server runs until interrupted (e.g. Ctrl+C). When the server
    starts, the default browser will open the ``START_HERE.html`` page
    if it exists within the directory.
    """
    os.chdir(directory)

    handler = http.server.SimpleHTTPRequestHandler
    
    # Crea una classe TCPServer personalizzata che riusa la porta
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True
    
    try:
        with ReusableTCPServer(("", port), handler) as httpd:
            # Try to open the start page in the default browser
            start_page = directory / "START_HERE.html"
            if start_page.exists():
                try:
                    webbrowser.open(f"http://localhost:{port}/START_HERE.html")
                except Exception:
                    pass
            print(f"Serving OpenEurope demo at http://localhost:{port}")
            print("Press Ctrl+C to stop the server.")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nServer stopped")
    except OSError as e:
        print(f"Errore avvio server: {e}")
        print(f"La porta {port} potrebbe essere già in uso.")
        print(f"Usa 'lsof -i :{port}' per trovare il processo.")
        raise


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    extract_path = ensure_demo_extracted(base_dir)
    start_server(extract_path)


if __name__ == "__main__":
    main()
