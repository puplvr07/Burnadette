"""Small, offline checks for the deployment packaging safety boundary."""
import json
from pathlib import Path
import tempfile
import unittest

from validate_vercel_package import ROOT, excluded, runtime_requirements, source_inventory, verify_published


class PackagingTests(unittest.TestCase):
    def test_runtime_manifest_parity(self):
        self.assertEqual(sorted(runtime_requirements(ROOT)), ["fastapi==0.121.3", "uvicorn==0.38.0"])

    def test_pinned_published_inventory(self):
        self.assertEqual(verify_published(ROOT), 147)

    def test_source_exclusions_and_published_retention(self):
        function = json.loads((ROOT / "vercel.json").read_text())["functions"]["api/main.py"]
        patterns = function["excludeFiles"][1:-1].split(",")
        for name in [".git/config", ".env.local", "api/.env.production", "api/.venv/package.py", "api/tests/test_backend.py", "api/.pytest_runs/run/log", "api/__pycache__/main.pyc", "api/data/development/manifest.json", "frontend/src/api.ts", "ML/model.py", "processed/input.csv", "docs/report.md", "dist/output.js", "build/output.py", ".packaging/run/api/main.py"]:
            with self.subTest(name=name):
                self.assertTrue(excluded(name, patterns))
        for name in ["api/main.py", "api/dataset.py", "api/published.py", "api/data/published/manifest.json", "api/data/published/indonesia/2000.json"]:
            with self.subTest(name=name):
                self.assertFalse(excluded(name, patterns))
        self.assertEqual(function["includeFiles"], "api/data/published/**")

    def test_inventory_prunes_excluded_trees(self):
        parent = ROOT / ".packaging"
        parent.mkdir(exist_ok=True)
        self.assertEqual(parent.resolve().parent, ROOT)
        # Only this newly allocated workspace child is cleaned by TemporaryDirectory.
        with tempfile.TemporaryDirectory(prefix="inventory-test-", dir=parent) as temporary:
            root = Path(temporary)
            self.assertEqual(root.resolve().parent, parent.resolve())
            for name in ["api/main.py", "api/data/published/info.json", "frontend/node_modules/unused.js", "api/.venv/site.py", ".env.local"]:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("fixture")
            inventory = source_inventory(root, ["frontend/**", "**/.venv/**", ".env*"])
            self.assertEqual(inventory, ["api/data/published/info.json", "api/main.py"])


if __name__ == "__main__":
    unittest.main()
