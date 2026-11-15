"""Offline packaging estimate; never links to Vercel or creates a deployment.

Run with the project's Python 3.12 venv. Only installed runtime dependency
distributions are copied, including their active transitive dependencies. Native
files retain the host platform: Windows staging is NOT a Linux Vercel artifact.
"""
import argparse
import fnmatch
import hashlib
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_SHA256 = "36bef71830c26f50b3dc4689eb022fbbfdb575f553880d85bcdd758814da3af5"
REVISION = "0e6e66965e4782c369210a8d88dc62a538a0fcbf"
PACKAGE_LIMIT = 500_000_000
RESPONSE_LIMIT = 4_500_000


def excluded(name, patterns):
    return any(fnmatch.fnmatchcase(name, pattern) or
               (pattern.startswith("**/") and fnmatch.fnmatchcase(name, pattern[3:]))
               for pattern in patterns)


def source_inventory(root, patterns):
    """Prune excluded trees, including hidden caches; do not follow links."""
    result = []
    for directory, dirs, files in os.walk(root, followlinks=False):
        parent = Path(directory)
        dirs[:] = [name for name in sorted(dirs)
                   if not excluded((parent / name).relative_to(root).as_posix() + "/", patterns)]
        for name in sorted(files):
            candidate = parent / name
            relative = candidate.relative_to(root).as_posix()
            if not excluded(relative, patterns):
                if candidate.is_symlink():
                    raise ValueError(f"Refusing source symlink: {relative}")
                result.append(relative)
    return sorted(result)


def verify_published(root):
    published = root / "api/data/published"
    manifest_bytes = (published / "manifest.json").read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != MANIFEST_SHA256:
        raise ValueError("Published manifest differs from the approved pinned snapshot")
    manifest = json.loads(manifest_bytes)
    if manifest["git_revision"] != REVISION or len(manifest["files"]) != 147:
        raise ValueError("Unexpected published revision or inventory")
    expected = set(manifest["files"]) | {"manifest.json"}
    actual = {file.relative_to(published).as_posix() for file in published.rglob("*.json")}
    if actual != expected:
        raise ValueError("Published JSON inventory differs from the manifest")
    for name, checksum in manifest["files"].items():
        if hashlib.sha256((published / name).read_bytes()).hexdigest() != checksum:
            raise ValueError(f"Published checksum mismatch: {name}")
    return len(manifest["files"])


def runtime_requirements(root):
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    requirements = [line.strip() for line in (root / "api/requirements.txt").read_text().splitlines()
                    if line.strip() and not line.startswith("#")]
    if sorted(requirements) != sorted(project["project"]["dependencies"]):
        raise ValueError("pyproject.toml and api/requirements.txt runtime dependencies differ")
    if project["tool"]["vercel"]["entrypoint"] != "api.main:app":
        raise ValueError("Expected native api.main:app entrypoint")
    return requirements


def copy_runtime_dependencies(requirements, destination):
    # pip ships its own PEP 508 parser, avoiding a new validator dependency.
    from pip._vendor.packaging.requirements import Requirement
    pending = [Requirement(value) for value in requirements]
    copied = {}
    while pending:
        requirement = pending.pop()
        if requirement.marker and not requirement.marker.evaluate({"extra": ""}):
            continue
        distribution = metadata.distribution(requirement.name)
        name = distribution.metadata["Name"]
        if requirement.specifier and not requirement.specifier.contains(distribution.version):
            raise ValueError(f"Installed {name} does not satisfy {requirement}")
        if name.lower() in copied:
            continue
        copied[name.lower()] = {"name": name, "version": distribution.version}
        if not distribution.files:
            raise ValueError(f"No installed file inventory for {name}")
        for relative in distribution.files:
            # Console entrypoint executables live outside site-packages and are
            # unnecessary for native ASGI serving. Do not copy interpreter files.
            if ".." in relative.parts or "__pycache__" in relative.parts or relative.suffix == ".pyc":
                continue
            source = Path(distribution.locate_file(relative))
            target = destination / relative
            if source.is_symlink():
                raise ValueError(f"Refusing dependency symlink: {name}/{relative}")
            if source.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        pending.extend(Requirement(value) for value in distribution.requires or [])
    return sorted(copied.values(), key=lambda item: item["name"].lower())


STAGED_SMOKE = r'''
import asyncio, json, pathlib, sys
stage = pathlib.Path(sys.argv[1]).resolve()
sys.path.insert(0, str(stage))
import api.main, fastapi, pydantic, uvicorn
for module in (api.main, fastapi, pydantic, uvicorn):
    assert pathlib.Path(module.__file__).resolve().is_relative_to(stage), module.__file__

async def request(app, path, query=b"", origin=None):
    messages = []
    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}
    async def send(message):
        messages.append(message)
    headers = [(b"host", b"package.test")]
    if origin: headers.append((b"origin", origin.encode()))
    await app({"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
               "method": "GET", "scheme": "https", "path": path, "raw_path": path.encode(),
               "query_string": query, "headers": headers, "client": ("127.0.0.1", 1234),
               "server": ("package.test", 443), "root_path": ""}, receive, send)
    start = next(item for item in messages if item["type"] == "http.response.start")
    body = b"".join(item.get("body", b"") for item in messages if item["type"] == "http.response.body")
    assert start["status"] == 200, (start["status"], body[:300])
    return body, dict(start["headers"])

async def main():
    app = api.main.app
    async with app.router.lifespan_context(app):
        meta_bytes, headers = await request(app, "/meta", origin="https://frontend.example.test")
        assert headers.get(b"access-control-allow-origin") == b"https://frontend.example.test"
        _, rejected = await request(app, "/meta", origin="https://unlisted.example.test")
        assert b"access-control-allow-origin" not in rejected
        meta = json.loads(meta_bytes)
        assert meta["dataset"]["mode"] == "published_json" and not meta["is_fake"]
        regions_bytes, _ = await request(app, "/regions")
        indonesia = next(region for region in json.loads(regions_bytes) if region["id"] == "indonesia")
        bbox = ",".join(str(value) for value in indonesia["bbox"])
        sizes = {}
        for source in ("harmonized", "modis", "viirs"):
            query = f"bbox={bbox}&start={meta['date_start']}&end={meta['date_end']}&source={source}&region=indonesia"
            body, _ = await request(app, "/calendar", query.encode())
            response = json.loads(body)
            assert response["cells_in_area"] == 3384 and len(response["weeks"]) == 1313
            sizes[source] = len(body)
        print(json.dumps({"smoke": "staged import/lifespan/meta/regions/calendar/CORS passed",
                          "indonesia_serialized_response_bytes": sizes}))
asyncio.run(main())
'''


def validate():
    if sys.version_info[:2] != (3, 12):
        raise ValueError("Use Python 3.12 to match the deployment runtime")
    config = json.loads((ROOT / "vercel.json").read_text())
    function = config["functions"]["api/main.py"]
    if config["framework"] != "fastapi" or config["fluid"] is not True or function["maxDuration"] != 60:
        raise ValueError("Unexpected backend function configuration")
    patterns = function["excludeFiles"].removeprefix("{").removesuffix("}").split(",")
    requirements = runtime_requirements(ROOT)
    count = verify_published(ROOT)
    staging_parent = ROOT / ".packaging"
    staging_parent.mkdir(exist_ok=True)
    if staging_parent.is_symlink() or staging_parent.resolve().parent != ROOT:
        raise ValueError("Staging must stay inside the workspace")
    # Each run owns a fresh directory; never clear a user-selected path.
    with tempfile.TemporaryDirectory(prefix="vercel-", dir=staging_parent) as temporary:
        stage = Path(temporary).resolve()
        if stage.parent != staging_parent.resolve():
            raise ValueError("Staging escaped workspace")
        inventory = source_inventory(ROOT, patterns)
        for name in inventory:
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        if verify_published(stage) != count:
            raise ValueError("Published inventory changed in staging")
        dependencies = copy_runtime_dependencies(requirements, stage)
        environment = {key: value for key, value in os.environ.items()
                       if not key.startswith(("BURN_", "PYTHON")) and key != "FRONTEND_ORIGINS"}
        environment.update({"BURN_DATA_MODE": "published_json", "FRONTEND_ORIGINS": "https://frontend.example.test"})
        smoke = subprocess.run([sys.executable, "-I", "-B", "-c", STAGED_SMOKE, str(stage)],
                               cwd=stage, env=environment, check=True, capture_output=True, text=True)
        smoke_result = json.loads(smoke.stdout)
        files = [file for file in stage.rglob("*") if file.is_file()]
        size = sum(file.stat().st_size for file in files)
        responses = smoke_result["indonesia_serialized_response_bytes"]
        if size >= PACKAGE_LIMIT or max(responses.values()) >= RESPONSE_LIMIT:
            raise ValueError("Staging or response exceeds a standard Vercel limit")
        report = {
            "measurement_kind": "local uncompressed staging estimate; NOT a Vercel build artifact",
            "host_platform": platform.platform(), "python": platform.python_version(),
            "dependency_method": "offline copy of installed runtime distributions and active host transitive dependencies",
            "limitations": "Host-native dependencies; Vercel Linux wheels, builder files and optional bytecode may differ. No cloud cold-start, RSS, latency, routing or deployment measured.",
            "runtime_dependencies": dependencies,
            "source_inventory": inventory, "source_file_count": len(inventory),
            "staged_total_file_count": len(files), "staged_uncompressed_bytes": size,
            "package_limit_bytes": PACKAGE_LIMIT, "package_headroom_bytes": PACKAGE_LIMIT - size,
            "published_files_verified": count, "manifest_sha256": MANIFEST_SHA256,
            "published_revision": REVISION, "exclude_patterns": patterns,
            **smoke_result, "response_limit_bytes": RESPONSE_LIMIT,
            "response_minimum_headroom_bytes": RESPONSE_LIMIT - max(responses.values()),
        }
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true", help="Also write ignored .packaging-report.json at the repository root")
    args = parser.parse_args()
    report = validate()
    rendered = json.dumps(report, indent=2)
    if args.report:
        (ROOT / ".packaging-report.json").write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
