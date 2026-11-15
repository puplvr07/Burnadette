"""Isolate pytest temporary files from stale Windows directories and other runs."""
from pathlib import Path
from uuid import uuid4


def pytest_configure(config):
    # Respect an explicit CLI path; otherwise never reuse another run's directory.
    if config.option.basetemp is None:
        root = Path(__file__).resolve().parents[1] / '.pytest_runs'
        root.mkdir(exist_ok=True)
        config.option.basetemp = str(root / uuid4().hex)
