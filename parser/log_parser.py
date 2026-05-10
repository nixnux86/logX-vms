from pathlib import Path

KEY_LOGS = {
    "vmkernel": ["vmkernel.log", "vmkernel.log.*"],
    "hostd": ["hostd.log", "hostd.log.*"],
    "vpxa": ["vpxa.log", "vpxa.log.*"],
    "messages": ["messages", "messages.*"],
    "vobd": ["vobd.log", "vobd.log.*"],
    "auth": ["auth.log", "auth.log.*"],
    "shell": ["shell.log", "shell.log.*"],
    "syslog": ["syslog.log", "syslog.log.*"],
    "vmkwarning": ["vmkwarning.log", "vmkwarning.log.*"],
    "storage_devices": ["esxcli_storage-core-device-list.txt", "*storage-core-device-list*"],
    "network_nics": ["esxcli_network-nic-list.txt", "*network-nic-list*"],
}


def _find_log_candidates(extracted_dir: Path, names):
    found = []
    for name in names:
        found.extend([p for p in extracted_dir.rglob(name) if p.is_file()])
    return found


def _copy_combined_log(candidates, output_path: Path, max_bytes_per_file=25_000_000):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0

    with output_path.open("w", encoding="utf-8", errors="ignore") as out:
        for path in sorted(candidates, key=lambda p: str(p)):
            try:
                with path.open("r", errors="ignore") as src:
                    out.write(src.read(max_bytes_per_file).rstrip())
                    out.write("\n")
                count += 1
            except Exception:
                continue

    return count


def collect_key_logs(extracted_dir: Path, output_dir: Path):
    result = {}

    for log_type, patterns in KEY_LOGS.items():
        candidates = _find_log_candidates(extracted_dir, patterns)
        out_path = output_dir / f"{log_type}.log"

        if candidates:
            count = _copy_combined_log(candidates, out_path)
            result[log_type] = {"found": True, "files": count, "output": str(out_path)}
        else:
            result[log_type] = {"found": False, "files": 0, "output": str(out_path)}

    return result
