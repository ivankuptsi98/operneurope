openeurope.py#!/usr/bin/env python3
"""
OpenEurope Example Program
-------------------------

This script demonstrates a simplified workflow for automating an energy audit based on the
OpenEurope project description. It ingests a CSV file containing energy consumption data,
normalizes and cleans the dataset, calculates energy savings, logs an audit trail, and
generates a Markdown report summarising the results.

The implementation is intentionally minimal to serve as a proof of concept. In a full
production system, the ingestion layer would connect to industrial systems, the
calculation engine would implement validated energy models, and the reporting would
generate documents compliant with relevant regulations.
"""

import argparse
import logging
import os
from datetime import datetime
from typing import List, Dict, Tuple

import pandas as pd

def ingest_data(file_path: str, audit_log: List[Dict[str, str]]) -> pd.DataFrame:
    """Read consumption data from a CSV file.

    Parameters
    ----------
    file_path : str
        Path to the input CSV file.
    audit_log : list of dict
        A list used to record audit trail entries.

    Returns
    -------
    pd.DataFrame
        DataFrame containing the raw data.
    """
    logging.info("Ingesting data from %s", file_path)
    df = pd.read_csv(file_path)
    audit_log.append({
        "step": "ingestion",
        "timestamp": datetime.now().isoformat(),
        "message": f"Loaded {len(df)} rows from {file_path}"
    })
    return df

def normalize_data(df: pd.DataFrame, audit_log: List[Dict[str, str]]) -> pd.DataFrame:
    """Clean and normalise the data set.

    Drops any rows with missing consumption values and ensures numeric types.

    Parameters
    ----------
    df : pd.DataFrame
        The raw data.
    audit_log : list of dict
        A list used to record audit trail entries.

    Returns
    -------
    pd.DataFrame
        Normalised DataFrame.
    """
    logging.info("Normalising data")
    before_rows = len(df)
    # Drop rows with missing consumption values
    df_clean = df.dropna(subset=["consumption_before", "consumption_after"])
    dropped = before_rows - len(df_clean)
    audit_log.append({
        "step": "normalisation",
        "timestamp": datetime.now().isoformat(),
        "message": f"Dropped {dropped} rows with missing consumption values"
    })
    # Ensure numeric types
    df_clean = df_clean.copy()
    df_clean["consumption_before"] = df_clean["consumption_before"].astype(float)
    df_clean["consumption_after"] = df_clean["consumption_after"].astype(float)
    return df_clean

def calculate_savings(df: pd.DataFrame, audit_log: List[Dict[str, str]]) -> Tuple[float, float, float, float]:
    """Compute baseline and new consumption averages and energy savings.

    Parameters
    ----------
    df : pd.DataFrame
        The cleaned data set.
    audit_log : list of dict
        A list used to record audit trail entries.

    Returns
    -------
    tuple of (float, float, float, float)
        baseline_avg, new_avg, absolute savings, percentage savings
    """
    logging.info("Calculating energy savings")
    baseline_avg = df["consumption_before"].mean()
    new_avg = df["consumption_after"].mean()
    savings = baseline_avg - new_avg
    savings_percent = (savings / baseline_avg) * 100 if baseline_avg else 0.0
    audit_log.append({
        "step": "calculation",
        "timestamp": datetime.now().isoformat(),
        "message": (
            f"Computed baseline average {baseline_avg:.4f}, new average {new_avg:.4f}, "
            f"savings {savings:.4f} ({savings_percent:.2f}%)"
        )
    })
    return baseline_avg, new_avg, savings, savings_percent

def generate_report(
    output_dir: str,
    baseline_avg: float,
    new_avg: float,
    savings: float,
    savings_percent: float,
    audit_log: List[Dict[str, str]],
    input_file: str
) -> str:
    """Create a Markdown report summarising the results and audit trail.

    Parameters
    ----------
    output_dir : str
        Directory where the report will be saved.
    baseline_avg : float
        Average baseline consumption.
    new_avg : float
        Average new consumption.
    savings : float
        Absolute energy savings.
    savings_percent : float
        Percentage energy savings.
    audit_log : list of dict
        Audit trail entries.
    input_file : str
        Name of the input CSV file.

    Returns
    -------
    str
        Path to the generated report file.
    """
    logging.info("Generating report")
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, "energy_audit_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Energy Audit Report\n\n")
        f.write(f"**Input file:** {os.path.basename(input_file)}\n\n")
        f.write("## Summary\n\n")
        f.write(f"- Baseline average consumption: {baseline_avg:.2f}\n")
        f.write(f"- New average consumption: {new_avg:.2f}\n")
        f.write(f"- Absolute energy savings: {savings:.2f}\n")
        f.write(f"- Savings percentage: {savings_percent:.2f}%\n\n")
        f.write("## Audit Trail\n\n")
        for entry in audit_log:
            f.write(
                f"- {entry['timestamp']} [{entry['step']}] {entry['message']}\n"
            )
    return report_path

def main() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description=(
            "OpenEurope Energy Audit Example\n\n"
            "This command-line tool demonstrates a simplified energy audit workflow. "
            "It expects a CSV file containing consumption_before and consumption_after columns, "
            "cleans the data, calculates the average baseline and new consumption, and outputs a "
            "Markdown report with results and an audit trail."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "csv_file",
        help="Path to the input CSV file with consumption data"
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=".",
        help="Directory where the report will be saved (default: current directory)"
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    audit_log: List[Dict[str, str]] = []

    # Execute workflow
    df = ingest_data(args.csv_file, audit_log)
    df_clean = normalize_data(df, audit_log)
    baseline_avg, new_avg, savings, savings_percent = calculate_savings(df_clean, audit_log)
    report_path = generate_report(
        args.output_dir,
        baseline_avg,
        new_avg,
        savings,
        savings_percent,
        audit_log,
        args.csv_file
    )
    print(f"Report generated at: {report_path}")

if __name__ == "__main__":
    main()
