from pathlib import Path
import argparse
import json
import time
import os
import shutil
import subprocess
import shlex
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

from parser.bundle import extract_bundle_safely
from parser.host_parser import parse_host_metadata
from parser.vm_parser import parse_vm_inventory, merge_vm_inventory
from parser.log_parser import collect_key_logs
from parser.troubleshoot import analyze_troubleshooting
from parser.path_mapping import parse_path_mapping


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
DATA_DIR = BASE_DIR / "data"
LOG_DATA_DIR = DATA_DIR / "logs"
LATEST_EXTRACTED_DIR = DATA_DIR / "latest_extracted"
TMP_DATA_DIR = DATA_DIR / "tmp"
CONSOLE_CWD = {"path": None}

VMS_JSON = DATA_DIR / "vms.json"
ANALYSIS_JSON = DATA_DIR / "analysis.json"
UPLOADS_JSON = DATA_DIR / "uploads.json"
HOST_INFO_JSON = DATA_DIR / "host_info.json"
PATH_MAPPING_JSON = DATA_DIR / "path_mapping.json"

UPLOAD_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
LOG_DATA_DIR.mkdir(exist_ok=True)
LATEST_EXTRACTED_DIR.mkdir(exist_ok=True)
TMP_DATA_DIR.mkdir(exist_ok=True)
os.environ.setdefault("LOGX_TMPDIR", str(TMP_DATA_DIR.resolve()))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024 * 1024


def is_allowed_file(filename: str) -> bool:
    name = filename.lower()
    return name.endswith(".tgz") or name.endswith(".tar.gz") or name.endswith(".tar") or name.endswith(".zip")


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: Path, payload):
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def load_existing_inventory():
    data = load_json(VMS_JSON, {"vms": []})
    if isinstance(data, dict):
        return data.get("vms", [])
    if isinstance(data, list):
        return data
    return []


def save_inventory(vms, host_meta=None):
    save_json(VMS_JSON, {
        "summary": {
            "total_vms": len(vms),
            "last_host": host_meta or {}
        },
        "vms": vms
    })


def save_analysis(payload):
    save_json(ANALYSIS_JSON, payload)


def get_recent_uploads(limit=5):
    uploads = load_json(UPLOADS_JSON, [])
    uploads = sorted(uploads, key=lambda x: x.get("uploaded_at", 0), reverse=True)
    return uploads[:limit]


def add_recent_upload(filename, size_bytes):
    uploads = load_json(UPLOADS_JSON, [])
    uploads = [u for u in uploads if u.get("filename") != filename]
    uploads.insert(0, {
        "filename": filename,
        "size_bytes": size_bytes,
        "uploaded_at": int(time.time())
    })
    save_json(UPLOADS_JSON, uploads[:50])


def has_analyzed_data():
    vms = load_existing_inventory()
    analysis = load_json(ANALYSIS_JSON, {"findings": []})
    return bool(vms) or bool(analysis.get("findings"))


@app.route("/")
def app_shell():
    return render_template("app.html", app_name="logX-vms")




def cleanup_work_dirs_before_extract():
    """
    Large vm-support bundles can be hundreds of MB and expand to multiple GB.
    Keep transient extraction inside data/tmp instead of the system /tmp, and
    clean older extracted working directories before each new analysis.
    """
    try:
        if LATEST_EXTRACTED_DIR.exists():
            shutil.rmtree(LATEST_EXTRACTED_DIR, ignore_errors=True)
        LATEST_EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    try:
        if TMP_DATA_DIR.exists():
            for child in TMP_DATA_DIR.iterdir():
                if child.is_dir() and child.name.startswith("logx_vms_"):
                    shutil.rmtree(child, ignore_errors=True)
        TMP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


def process_bundle_file(upload_path: Path, safe_name: str, append_mode: bool = False):
    cleanup_work_dirs_before_extract()
    with extract_bundle_safely(upload_path) as extracted_dir:
        host_meta = parse_host_metadata(extracted_dir, source_file=safe_name)
        parsed_vms = parse_vm_inventory(extracted_dir, host_meta=host_meta)
        collected_logs = collect_key_logs(extracted_dir, LOG_DATA_DIR)
        troubleshooting = analyze_troubleshooting(
            extracted_dir=extracted_dir,
            host_meta=host_meta,
            collected_logs=collected_logs
        )
        host_info = build_host_info(host_meta, extracted_dir)
        path_mapping = parse_path_mapping(extracted_dir)

        shutil.copytree(extracted_dir, LATEST_EXTRACTED_DIR, dirs_exist_ok=True)
        CONSOLE_CWD["path"] = str(LATEST_EXTRACTED_DIR.resolve())

    existing_vms = load_existing_inventory() if append_mode else []
    final_vms = merge_vm_inventory(existing_vms, parsed_vms)

    save_inventory(final_vms, host_meta)
    save_analysis(troubleshooting)
    save_host_info(host_info)
    save_json(PATH_MAPPING_JSON, path_mapping)

    return {
        "ok": True,
        "stage": "complete",
        "progress": 100,
        "append": append_mode,
        "source_file": safe_name,
        "host": host_meta,
        "parsed_count": len(parsed_vms),
        "total_count": len(final_vms),
        "vms": final_vms,
        "analysis": troubleshooting,
        "host_info": host_info,
        "path_mapping": path_mapping,
        "recent_uploads": get_recent_uploads()
    }


def build_host_info(host_meta, extracted_dir: Path):
    """
    Best-effort host specification summary from common ESXi/vCenter bundle files.
    """
    info = {
        "metadata": host_meta or {},
        "hardware": {},
        "storage": {},
        "network": {},
        "files_scanned": []
    }

    patterns = [
        "*system*version*",
        "*hardware*platform*",
        "*localcli_hardware*",
        "*esxcli_hardware*",
        "*storage*core*device*list*",
        "*network*nic*list*",
        "*vmware-version*",
        "esx.conf",
    ]

    text_blob = ""
    for pattern in patterns:
        for path in extracted_dir.rglob(pattern):
            if path.is_file():
                try:
                    text = path.read_text(errors="ignore")[:60000]
                    text_blob += "\n" + text
                    info["files_scanned"].append(str(path))
                except Exception:
                    pass

    import re

    def find_one(regex):
        m = re.search(regex, text_blob, re.IGNORECASE)
        return m.group(1).strip() if m else None

    info["hardware"]["vendor"] = find_one(r"Vendor(?: Name)?\s*:\s*(.+)")
    info["hardware"]["model"] = find_one(r"Model(?: Name)?\s*:\s*(.+)")
    info["hardware"]["serial_number"] = find_one(r"Serial(?: Number)?\s*:\s*(.+)")
    info["hardware"]["cpu_model"] = find_one(r"CPU(?: Model| Type)?\s*:\s*(.+)")
    info["hardware"]["cpu_packages"] = find_one(r"CPU Packages\s*:\s*(.+)")
    info["hardware"]["cpu_cores"] = find_one(r"CPU Cores\s*:\s*(.+)")
    info["hardware"]["memory"] = find_one(r"Memory Size\s*:\s*(.+)")
    info["network"]["vmnic_count_hint"] = len(re.findall(r"\bvmnic\d+\b", text_blob, re.IGNORECASE))
    info["storage"]["naa_device_count_hint"] = len(set(re.findall(r"\bnaa\.[A-Za-z0-9_.:-]+", text_blob, re.IGNORECASE)))

    return info


def save_host_info(payload):
    save_json(HOST_INFO_JSON, payload)




def clear_active_bundle_state():
    """Clear current active parsed state when no uploaded bundles remain."""
    for path in [VMS_JSON, ANALYSIS_JSON, HOST_INFO_JSON, PATH_MAPPING_JSON]:
        try:
            if path.exists():
                path.unlink()
        except Exception:
            pass

    for directory in [LATEST_EXTRACTED_DIR, LOG_DATA_DIR, TMP_DATA_DIR]:
        try:
            if directory.exists():
                shutil.rmtree(directory, ignore_errors=True)
            directory.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

    CONSOLE_CWD["path"] = None


def get_current_path_mapping_payload():
    cached = load_json(PATH_MAPPING_JSON, {"nodes": [], "edges": [], "tables": {}, "summary": {}})

    if (
        (not cached.get("nodes"))
        and LATEST_EXTRACTED_DIR.exists()
        and any(LATEST_EXTRACTED_DIR.iterdir())
    ):
        try:
            parsed = parse_path_mapping(LATEST_EXTRACTED_DIR)
            save_json(PATH_MAPPING_JSON, parsed)
            return parsed
        except Exception as exc:
            cached["error"] = str(exc)

    return cached


@app.route("/api/state", methods=["GET"])
def state_api():
    vms = load_existing_inventory()
    analysis = load_json(ANALYSIS_JSON, {"summary": {}, "findings": [], "log_files": {}})
    return jsonify({
        "ok": True,
        "has_data": has_analyzed_data(),
        "total_vms": len(vms),
        "vms": vms,
        "analysis": analysis,
        "host_info": load_json(HOST_INFO_JSON, {"metadata": {}, "hardware": {}, "storage": {}, "network": {}, "files_scanned": []}),
        "path_mapping": get_current_path_mapping_payload(),
        "recent_uploads": get_recent_uploads()
    })



@app.route("/api/path_mapping", methods=["GET"])
def path_mapping_api():
    return jsonify({"ok": True, "path_mapping": get_current_path_mapping_payload()})

@app.route("/api/host_info", methods=["GET"])
def host_info_api():
    return jsonify({
        "ok": True,
        "host_info": load_json(HOST_INFO_JSON, {"metadata": {}, "hardware": {}, "storage": {}, "network": {}, "files_scanned": []})
    })

@app.route("/api/inventory", methods=["GET"])
def inventory():
    vms = load_existing_inventory()
    analysis = load_json(ANALYSIS_JSON, {"summary": {}, "findings": [], "log_files": {}})
    return jsonify({
        "ok": True,
        "total": len(vms),
        "vms": vms,
        "analysis": analysis
    })


@app.route("/api/logs", methods=["GET"])
def logs_api():
    log_type = request.args.get("type", "vmkernel").lower()
    query = request.args.get("q", "").lower().strip()
    limit = int(request.args.get("limit", "3000"))

    if log_type not in {"vmkernel", "hostd", "vpxa", "messages", "vobd", "auth", "shell", "syslog", "vmkwarning", "storage_devices", "network_nics"}:
        return jsonify({"ok": False, "error": "Unsupported log type."}), 400

    log_path = LOG_DATA_DIR / f"{log_type}.log"
    if not log_path.exists():
        return jsonify({"ok": True, "type": log_type, "exists": False, "lines": [], "total": 0})

    lines = log_path.read_text(errors="ignore").splitlines()
    if query:
        lines = [line for line in lines if query in line.lower()]

    total = len(lines)
    lines = lines[-limit:]

    return jsonify({"ok": True, "type": log_type, "exists": True, "total": total, "lines": lines})


@app.route("/api/recent", methods=["GET"])
def recent_api():
    return jsonify({"ok": True, "recent_uploads": get_recent_uploads()})



@app.route("/api/open_upload", methods=["POST"])
def open_upload():
    payload = request.get_json(silent=True) or {}
    filename = secure_filename(payload.get("filename", ""))

    if not filename:
        return jsonify({"ok": False, "error": "Missing filename."}), 400

    upload_path = UPLOAD_DIR / filename
    if not upload_path.exists() or not upload_path.is_file():
        return jsonify({"ok": False, "error": "Uploaded file was not found."}), 404

    try:
        add_recent_upload(filename, upload_path.stat().st_size)
        return jsonify(process_bundle_file(upload_path, filename, append_mode=False))
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

@app.route("/api/upload/<filename>", methods=["DELETE"])
def delete_upload(filename):
    safe_name = secure_filename(filename)
    target = UPLOAD_DIR / safe_name

    uploads = load_json(UPLOADS_JSON, [])
    uploads = [u for u in uploads if u.get("filename") != safe_name]
    save_json(UPLOADS_JSON, uploads)

    deleted = False
    if target.exists() and target.is_file():
        target.unlink()
        deleted = True

    remaining = get_recent_uploads()
    if not remaining:
        clear_active_bundle_state()

    return jsonify({
        "ok": True,
        "deleted": deleted,
        "active_cleared": not bool(remaining),
        "recent_uploads": remaining
    })




SAFE_CONSOLE_COMMANDS = {
    "ls", "pwd", "find", "grep", "egrep", "cat", "head", "tail",
    "wc", "du", "sort", "uniq", "sed", "awk", "cd", "clear"
}

BLOCKED_TOKENS = [
    ";", "`", "$(", ">", "<", "/etc", "/root", "/home", "/proc", "/sys"
]


def get_console_cwd():
    root = LATEST_EXTRACTED_DIR.resolve()
    current = CONSOLE_CWD.get("path")
    if not current:
        CONSOLE_CWD["path"] = str(root)
        return root
    path = Path(current).resolve()
    if not str(path).startswith(str(root)):
        CONSOLE_CWD["path"] = str(root)
        return root
    return path


def is_safe_console_command(command: str):
    raw = command.strip()
    if not raw:
        return False, "Empty command."
    if len(raw) > 500:
        return False, "Command is too long."
    for token in BLOCKED_TOKENS:
        if token in raw:
            return False, f"Blocked token detected: {token}"
    first = raw.split()[0]
    if first not in SAFE_CONSOLE_COMMANDS:
        return False, f"Command not allowed: {first}"
    return True, ""


@app.route("/api/console", methods=["POST"])
def console_api():
    payload = request.get_json(silent=True) or {}
    command = payload.get("command", "").strip()
    if not LATEST_EXTRACTED_DIR.exists() or not any(LATEST_EXTRACTED_DIR.iterdir()):
        return jsonify({"ok": False, "error": "No extracted bundle is currently available", "cwd": "unavailable"}), 400
    safe, reason = is_safe_console_command(command)
    cwd = get_console_cwd()
    if not safe:
        return jsonify({"ok": False, "error": reason, "cwd": str(cwd)}), 400
    root = LATEST_EXTRACTED_DIR.resolve()
    if command == "clear":
        return jsonify({"ok": True, "clear": True, "cwd": str(cwd), "output": ""})
    if command == "pwd":
        rel = str(cwd.relative_to(root)) if cwd != root else "."
        return jsonify({"ok": True, "returncode": 0, "cwd": str(cwd), "output": rel})
    if command == "cd" or command.startswith("cd "):
        try:
            parts = shlex.split(command)
        except Exception:
            parts = command.split(maxsplit=1)

        target = parts[1] if len(parts) > 1 else "."
        if target == "-":
            target = "."

        next_path = (cwd / target).resolve()
        if not str(next_path).startswith(str(root)) or not next_path.exists() or not next_path.is_dir():
            return jsonify({
                "ok": False,
                "error": f"Directory is not available inside the extracted bundle: {target}",
                "cwd": str(cwd)
            }), 400

        CONSOLE_CWD["path"] = str(next_path)
        return jsonify({
            "ok": True,
            "returncode": 0,
            "cwd": str(next_path),
            "output": ""
        })
    try:
        result = subprocess.run(command, cwd=cwd, shell=True, text=True, capture_output=True, timeout=20)
        output = result.stdout
        if result.stderr:
            output += "\n[stderr]\n" + result.stderr
        return jsonify({"ok": True, "returncode": result.returncode, "cwd": str(cwd), "output": output[-20000:]})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Command timed out after 20 seconds.", "cwd": str(cwd)}), 408
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc), "cwd": str(cwd)}), 500

@app.route("/api/analyze", methods=["POST"] )
def analyze():
    if "bundle" not in request.files:
        return jsonify({"ok": False, "stage": "upload", "progress": 0, "error": "No bundle file uploaded."}), 400

    bundle = request.files["bundle"]
    append_mode = request.form.get("append", "false").lower() == "true"

    if not bundle.filename:
        return jsonify({"ok": False, "stage": "upload", "progress": 0, "error": "Empty filename."}), 400

    if not is_allowed_file(bundle.filename):
        return jsonify({
            "ok": False,
            "stage": "upload",
            "progress": 0,
            "error": "Unsupported file type. Please upload .tgz, .tar.gz, .tar, or .zip."
        }), 400

    safe_name = secure_filename(bundle.filename)
    upload_path = UPLOAD_DIR / safe_name
    bundle.save(upload_path)
    add_recent_upload(safe_name, upload_path.stat().st_size)

    try:
        with extract_bundle_safely(upload_path) as extracted_dir:
            host_meta = parse_host_metadata(extracted_dir, source_file=safe_name)
            parsed_vms = parse_vm_inventory(extracted_dir, host_meta=host_meta)
            collected_logs = collect_key_logs(extracted_dir, LOG_DATA_DIR)
            troubleshooting = analyze_troubleshooting(
                extracted_dir=extracted_dir,
                host_meta=host_meta,
                collected_logs=collected_logs
            )

            if LATEST_EXTRACTED_DIR.exists():
                shutil.rmtree(LATEST_EXTRACTED_DIR, ignore_errors=True)
            shutil.copytree(extracted_dir, LATEST_EXTRACTED_DIR, dirs_exist_ok=True)
            CONSOLE_CWD["path"] = str(LATEST_EXTRACTED_DIR.resolve())

        existing_vms = load_existing_inventory() if append_mode else []
        final_vms = merge_vm_inventory(existing_vms, parsed_vms)

        save_inventory(final_vms, host_meta)
        save_analysis(troubleshooting)

        return jsonify({
            "ok": True,
            "stage": "complete",
            "progress": 100,
            "append": append_mode,
            "source_file": safe_name,
            "host": host_meta,
            "parsed_count": len(parsed_vms),
            "total_count": len(final_vms),
            "vms": final_vms,
            "analysis": troubleshooting,
            "recent_uploads": get_recent_uploads()
        })

    except Exception as exc:
        return jsonify({"ok": False, "stage": "failed", "progress": 100, "error": str(exc)}), 500


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="logX-vms")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=5000, type=int)
    args = parser.parse_args()

    app.run(host=args.host, port=args.port, debug=True)
