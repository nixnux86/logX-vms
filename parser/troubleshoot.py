from pathlib import Path
import re
from collections import Counter

RULES = {
    "crash_psod_core": {
        "title": "Crash / PSOD / Core Dump Indicators",
        "description": "Looks for purple screen, panic, core dump, and fatal exception traces.",
        "patterns": [r"\bpsod\b", r"purple screen", r"core dump", r"coredump", r"panic", r"fatal exception", r"world.*panic", r"backtrace"]
    },
    "vm_power": {
        "title": "VM Power / Reboot / Performance Indicators",
        "description": "Looks for VM power-on failure, reset, reboot, stun, snapshot, and timeout events.",
        "patterns": [r"power on failed", r"failed to power on", r"cannot power on", r"vmx.*failed", r"resetting virtual machine", r"reboot", r"stun", r"snapshot.*failed", r"timeout"]
    },
    "storage": {
        "title": "Storage / Path / Latency Indicators",
        "description": "Looks for APD/PDL, path down, NMP, HBA, datastore, SCSI, and latency events.",
        "patterns": [r"\bAPD\b", r"\bPDL\b", r"all paths down", r"path.*down", r"path.*dead", r"nmp", r"hba", r"scsi", r"datastore", r"latency", r"device.*naa\.", r"perennially reserved", r"reservation conflict", r"lost access to volume", r"reset to device", r"sense data", r"i/o error"]
    },
    "network_vmotion": {
        "title": "Network / vMotion Indicators",
        "description": "Looks for link state, vmnic, dropped packets, vMotion migration, and connectivity failures.",
        "patterns": [r"vmnic", r"link.*down", r"link.*up", r"uplink", r"packet.*drop", r"dropped.*packet", r"lost connectivity", r"network unreachable", r"vmotion", r"migration.*failed", r"tcpip", r"netstack", r"nic.*down"]
    },
    "recent_changes": {
        "title": "Recent Commands / Configuration Change Indicators",
        "description": "Looks for shell commands, config changes, service restart, user login, and hostd/vpxa operations.",
        "patterns": [r"esxcli", r"vim-cmd", r"localcli", r"config.*changed", r"reconfigure", r"service.*restart", r"user.*login", r"accepted password", r"shell", r"dcui", r"vpxa", r"hostd"]
    }
}


def _iter_text_files(extracted_dir: Path):
    """
    Yield likely useful text files first.

    Older versions stopped after the first 250 text files discovered by rglob().
    In large vm-support bundles, those first files can be unrelated, so real log
    files may never be scanned. This prioritizes common ESXi logs and command
    outputs, then continues with the broader text set.
    """
    priority_names = [
        "vmkernel.log", "hostd.log", "vpxa.log", "vobd.log", "vmkwarning.log",
        "messages", "shell.log", "auth.log", "syslog.log",
        "localcli_storage-core-path-list.txt", "localcli_storage-core-device-list.txt",
        "localcli_storage-san-fc-list.txt", "localcli_storage-nmp-device-list.txt",
        "esxcli_storage-core-device-list.txt", "esxcli_network-nic-list.txt",
    ]

    seen = set()

    for name in priority_names:
        for path in extracted_dir.rglob(name):
            if path.is_file() and path not in seen:
                seen.add(path)
                yield path

    interesting = ["*.log", "*.txt", "*.out", "*.conf", "*.cfg", "*.json"]
    for pattern in interesting:
        for path in extracted_dir.rglob(pattern):
            if path.is_file() and path not in seen:
                seen.add(path)
                yield path


def _scan_patterns(extracted_dir: Path, patterns, max_files=1500, max_bytes_per_file=8_000_000, max_samples=20):
    regexes = [re.compile(p, re.IGNORECASE) for p in patterns]
    count = 0
    scanned_files = 0
    files = Counter()
    samples = []

    for path in _iter_text_files(extracted_dir):
        if scanned_files >= max_files:
            break
        scanned_files += 1

        try:
            bytes_seen = 0
            with path.open("r", errors="ignore") as f:
                for line_no, line in enumerate(f, 1):
                    bytes_seen += len(line.encode("utf-8", errors="ignore"))
                    if bytes_seen > max_bytes_per_file:
                        break

                    if any(rx.search(line) for rx in regexes):
                        count += 1
                        files[str(path)] += 1
                        if len(samples) < max_samples:
                            samples.append({
                                "file": str(path),
                                "line": line_no,
                                "text": line.strip()[:500]
                            })
        except Exception:
            continue

    top_files = [{"file": k, "matches": v} for k, v in files.most_common(10)]
    return count, top_files, samples



def _severity(count):
    if count >= 50:
        return "high"
    if count >= 10:
        return "medium"
    if count > 0:
        return "low"
    return "none"


def analyze_troubleshooting(extracted_dir: Path, host_meta: dict, collected_logs: dict):
    findings = []

    for key, rule in RULES.items():
        count, top_files, samples = _scan_patterns(extracted_dir, rule["patterns"])
        findings.append({
            "key": key,
            "title": rule["title"],
            "description": rule["description"],
            "severity": _severity(count),
            "matches": count,
            "top_files": top_files,
            "samples": samples
        })

    findings.append({
        "key": "expert_tools",
        "title": "Expert Support / Automated Tools",
        "severity": "info",
        "matches": 0,
        "description": "For official root-cause analysis, send the support bundle to VMware/Broadcom Support. When available, also use Skyline Health Diagnostics or related health-check tooling.",
        "top_files": [],
        "samples": []
    })

    summary = {
        "host": host_meta,
        "total_findings": len(findings),
        "high": sum(1 for f in findings if f.get("severity") == "high"),
        "medium": sum(1 for f in findings if f.get("severity") == "medium"),
        "low": sum(1 for f in findings if f.get("severity") == "low"),
        "logs": collected_logs
    }

    return {"summary": summary, "findings": findings, "log_files": collected_logs}
