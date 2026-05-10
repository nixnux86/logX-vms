from pathlib import Path
import re


def _find_hostname_from_text(text):
    patterns = [
        r"Hostname:\s*([A-Za-z0-9._-]+)",
        r"Host Name:\s*([A-Za-z0-9._-]+)",
        r"hostName['\"]?\s*[:=]\s*['\"]?([A-Za-z0-9._-]+)",
        r"localhostName['\"]?\s*[:=]\s*['\"]?([A-Za-z0-9._-]+)"
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _find_version_from_text(text):
    patterns = [
        r"VMware ESXi\s+([0-9][^\s,]+)",
        r"VMware vCenter Server\s+([0-9][^\s,]+)",
        r"Product:\s*VMware\s+.*?\s*([0-9]+\.[0-9][^\s,]*)",
        r"Version:\s*([0-9]+\.[0-9]+[^\s,]*)",
        r"build[- ]?([0-9]{5,})"
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1) if m.groups() else m.group(0)
    return None



def _find_vmsupport_version_from_text(text):
    patterns = [
        r"vmsupport\s+(?:version|Version)[:\s]+([A-Za-z0-9._-]+)",
        r"VMware\s+vmsupport\s+([A-Za-z0-9._-]+)",
        r"Support\s+bundle\s+created\s+by\s+vmsupport\s+([A-Za-z0-9._-]+)",
        r"vmsupport[-_ ]?([0-9]+(?:\.[0-9]+)+[A-Za-z0-9._-]*)"
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def parse_host_metadata(extracted_dir: Path, source_file: str = ""):
    candidates = []

    for rel in [
        "commands/localcli_system_version_get.txt",
        "commands/esxcli_system_version_get.txt",
        "commands/hostname.txt",
        "etc/vmware/esx.conf",
        "var/log/vmkernel.log",
        "var/log/hostd.log",
        "json/vmware-version.json",
    ]:
        candidates.extend(extracted_dir.rglob(rel))

    for pattern in ["*version*", "*hostname*", "esx.conf", "*.json", "vmkernel.log", "hostd.log"]:
        candidates.extend([p for p in extracted_dir.rglob(pattern) if p.is_file()])

    text_blob = ""
    for path in candidates[:120]:
        try:
            text_blob += "\n" + path.read_text(errors="ignore")[:25000]
        except Exception:
            continue

    hostname = _find_hostname_from_text(text_blob)
    version = _find_version_from_text(text_blob)
    vmsupport_version = _find_vmsupport_version_from_text(text_blob)
    vmsupport_version = _find_vmsupport_version_from_text(text_blob)

    if not hostname and source_file:
        m = re.search(r"(?:esx|vc|vcenter)-([A-Za-z0-9._-]+?)-\d{4}", source_file, re.IGNORECASE)
        if m:
            hostname = m.group(1)

    bundle_type = "vCenter" if re.search(r"vc|vcenter", source_file, re.IGNORECASE) else "ESXi"

    return {
        "hostname": hostname or "unknown-host",
        "version": version or "unknown-version",
        "bundle_type": bundle_type,
        "source_file": source_file,
        "vmsupport_version": vmsupport_version or "unknown"
    }
