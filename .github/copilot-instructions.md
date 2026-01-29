# OpenEurope Copilot Instructions

## Project Overview

**OpenEurope** is an energy audit automation platform with two complementary components:

1. **Python CLI Tool** (`openeurope.py`): Lightweight backend for processing energy consumption CSV/Excel data
2. **Interactive Web Demo** (`demo/OpenEurope_Demo_Semplice_v3/`): Zero-install browser-based dashboard for energy audits

The project emphasizes transparency through audit trails, supporting Italian energy standards (F1, F2, F3 gas consumption categories).

## Architecture & Data Flow

### Python Backend (`openeurope.py`)
Four-stage linear pipeline with audit logging at each step:

```
CSV/Excel Input → Ingest → Normalize → Calculate → Report
                    ↓         ↓           ↓          ↓
                 audit_log entries track all transformations
```

- **ingest_data()**: Loads CSV or Excel, appends audit entry with row count
- **normalize_data()**: Drops missing `consumption_before`/`consumption_after`, coerces float type, logs dropped rows
- **calculate_savings()**: Computes baseline avg, new avg, absolute and percentage savings
- **generate_report()**: Writes Markdown report + audit trail to output directory

Key pattern: All functions accept `audit_log: List[Dict[str, str]]` by reference, mutating it with entries containing `{"step", "timestamp", "message"}`.

### Web Demo (`demo/OpenEurope_Demo_Semplice_v3/`)
Client-side only (no server required). Multi-step wizard UI with local browser storage:

- **app.js**: 2200+ lines of vanilla JavaScript, no framework
- **Storage**: `openeurope_demo_v3` key in `localStorage` persists project state
- **Step flow**: Project → Consumption (F1/F2/F3/Gas) → Machinery → Self-production → Thermal → Dashboard → Audit log
- **External libs**: PapaParse (CSV), Chart.js (charts), pdfjs (PDF text extraction), tesseract.js (OCR), html2pdf (PDF export)
- **Localization**: All Italian (`it-IT`), numbers formatted with commas (thousands) and dots (decimals)

## Critical Patterns & Conventions

### Data Validation (Python & Web)
- **CSV columns**: Must include `consumption_before` and `consumption_after` (case-sensitive)
- **Missing values**: Rows with `NaN` in required columns are silently dropped; count logged
- **Type coercion**: Numeric strings auto-converted to float; invalid values become `null`/`NaN`
- Italian number format support in web app: `1.234,56` → `1234.56`

### Audit Trail Requirement
Every operation must append to audit log with ISO timestamp. Example:
```python
audit_log.append({
    "step": "calculation",
    "timestamp": datetime.now().isoformat(),
    "message": f"Computed savings {savings:.2f} ({savings_percent:.2f}%)"
})
```

### File I/O
- **Input formats**: `.csv`, `.xlsx`, `.xls` (auto-detected by extension)
- **Output**: Always Markdown (`.md`), fixed filename `energy_audit_report.md`
- **Default output dir**: Current working directory (`.`)
- **Excel support**: Python 3.8+ requires `pandas` with openpyxl backend

### Number Formatting
- Python: Use `f"{value:.2f}"` for 2-decimal precision in reports
- Web: `fmtNumber()` utility returns localized string or `"—"` for missing values

## Command-Line Workflows

### Running Python Tool
```bash
# Minimal usage
python openeurope.py sample_data.csv

# With custom output directory
python openeurope.py data.xlsx -o reports/
```

### Running Web Demo
```bash
# Extracts ZIP and serves on localhost:8000
python run_demo.py
# Then open http://localhost:8000/START_HERE.html
```

### Tests & Validation
No automated test suite exists. Validation is manual:
- Test with `sample_data.csv` and `sample_data.xlsx` (both in repo root)
- Verify `energy_audit_report.md` contains all calculation rows in audit trail
- Check for shebang issues: Python scripts require `#!/usr/bin/env python3` (not `/usr/bin/python`)

## Key Files & Responsibilities

| File | Purpose |
|------|---------|
| [openeurope.py](openeurope.py) | CLI entry point, all pipeline logic, pandas-based |
| [run_demo.py](run_demo.py) | ZIP extraction + HTTP server launcher for web demo |
| [demo/.../{app.js,index.html,styles.css}](demo/OpenEurope_Demo_Semplice_v3/) | Web UI, 100% client-side |
| [sample_data.csv](sample_data.csv) | Test dataset for CLI validation |

## Dependencies

| Tool | Usage | Min Version |
|------|-------|-------------|
| Python | Runtime | 3.8+ |
| pandas | Data manipulation (CLI only) | Latest |
| CDN libs | Web demo (no installation) | Built-in |

### Installing Pandas
```bash
pip install pandas
# For Excel: openpyxl backend auto-installed with pandas
```

## Common Tasks

**Add a new consumption metric** (e.g., water usage):
1. Add column to input CSV
2. In Python: extend `calculate_savings()` to compute new metric, append audit entry
3. In web demo: add form field in step 2, update localStorage schema

**Modify report format**:
- Python: Edit `generate_report()` function's f-string template
- Web: Locate report rendering logic in app.js (search `btnExportPDF` handler)

**Change data validation rules**:
- Edit `normalize_data()` logic and update corresponding audit message
- Update web app validation in form handlers (step-by-step in app.js)

## Known Limitations & TODOs

- No automated tests; manual validation against sample data required
- Web demo is 2200-line monolithic file (no module splitting)
- Italian-only localization (hardcoded strings in app.js)
- OCR (tesseract.js) can be slow on large PDF batches
- No real-time sync between CLI and web demo
