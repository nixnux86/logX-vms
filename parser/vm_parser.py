from pathlib import Path
import re
from typing import Dict, List


def _to_int(value):
    try:
        return int(value)
    except Exception:
        return None


def _parse_vmx_file(path: Path, host_meta: Dict) -> Dict:
    data = {
        "name": path.stem,
        "host": host_meta.get("hostname", "unknown-host"),
        "source": "vmx",
        "vmx_path": str(path),
        "datastore": None,
        "guest_os": None,
        "uuid": None,
        "vcpu": None,
        "cpu_cores_per_socket": None,
        "memory_mb": None,
        "disk_count": 0,
        "disk_summary": None,
        "disk_list": [],
        "network_count": 0,
        "network_summary": None,
        "network_list": [],
        "world_id": None,
        "process_id": None,
        "cartel_id": None,
        "vm_status": None,
        "power_state": None
    }

    try:
        text = path.read_text(errors="ignore")
    except Exception:
        return data

    kv = {}
    for line in text.splitlines():
        m = re.match(r'^\s*([^#][^=]+?)\s*=\s*"(.*?)"\s*$', line)
        if m:
            kv[m.group(1).strip()] = m.group(2).strip()

    data["name"] = kv.get("displayName") or data["name"]
    data["guest_os"] = kv.get("guestOS")
    data["uuid"] = kv.get("uuid.bios") or kv.get("uuid.location")
    data["vcpu"] = _to_int(kv.get("numvcpus"))
    data["cpu_cores_per_socket"] = _to_int(kv.get("cpuid.coresPerSocket"))
    data["memory_mb"] = _to_int(kv.get("memSize"))

    disks = []
    for key, value in kv.items():
        lower = key.lower()
        if lower.endswith(".filename") and value.lower().endswith((".vmdk", ".rdm", ".rdmp")):
            disks.append(value)

    disks = list(dict.fromkeys(disks))
    data["disk_count"] = len(disks)
    data["disk_list"] = disks
    if disks:
        data["disk_summary"] = ", ".join(disks[:4]) + (" ..." if len(disks) > 4 else "")

    ethernet_prefixes = set()
    for key in kv:
        m = re.match(r"^(ethernet\d+)\.(.+)$", key, re.IGNORECASE)
        if m:
            ethernet_prefixes.add(m.group(1))

    nics = []
    for prefix in sorted(ethernet_prefixes):
        present = kv.get(f"{prefix}.present", "TRUE").upper()
        if present == "FALSE":
            continue

        conn = (
            kv.get(f"{prefix}.networkName")
            or kv.get(f"{prefix}.portgroupName")
            or kv.get(f"{prefix}.connectionType")
            or "unknown"
        )
        adapter = kv.get(f"{prefix}.virtualDev") or "unknown-adapter"
        address = kv.get(f"{prefix}.generatedAddress") or kv.get(f"{prefix}.address") or ""
        label = f"{adapter}:{conn}"
        if address:
            label += f" ({address})"
        nics.append(label)

    data["network_count"] = len(nics)
    data["network_list"] = nics
    if nics:
        data["network_summary"] = ", ".join(nics[:4]) + (" ..." if len(nics) > 4 else "")

    parts = path.parts
    if "volumes" in parts:
        idx = parts.index("volumes")
        if idx + 1 < len(parts):
            data["datastore"] = parts[idx + 1]

    return data


def _parse_getallvms_file(path: Path, host_meta: Dict) -> List[Dict]:
    results = []
    try:
        lines = path.read_text(errors="ignore").splitlines()
    except Exception:
        return results

    for line in lines:
        line = line.strip()
        if not line or line.lower().startswith("vmid"):
            continue

        m = re.match(r"^(\d+)\s+(.+?)\s+(\[[^\]]+\]\s+.+?\.vmx)\s+(\S+)", line)
        if not m:
            continue

        vmid, name, vmx_path, guest_os = m.groups()
        dsm = re.search(r"\[([^\]]+)\]", vmx_path)

        results.append({
            "name": name.strip(),
            "host": host_meta.get("hostname", "unknown-host"),
            "source": "vmsvc/getallvms",
            "vmid": vmid,
            "vmx_path": vmx_path.strip(),
            "datastore": dsm.group(1) if dsm else None,
            "guest_os": guest_os,
            "uuid": None,
            "vcpu": None,
            "cpu_cores_per_socket": None,
            "memory_mb": None,
            "disk_count": None,
            "disk_summary": None,
            "disk_list": [],
            "network_count": None,
            "network_summary": None,
            "network_list": [],
            "world_id": None,
            "process_id": None,
            "cartel_id": None,
            "vm_status": None,
        "power_state": None
        })

    return results



def _parse_vm_process_list_file(path: Path, host_meta: Dict) -> List[Dict]:
    """Parse commands/localcli_vm-process-list.txt for VM runtime identity fields."""
    results = []
    try:
        text = path.read_text(errors="ignore")
    except Exception:
        return results
    blocks = re.split(r"\n\s*\n", text)
    for block in blocks:
        if not block.strip():
            continue
        def grab(label):
            m = re.search(rf"^\s*{re.escape(label)}\s*:\s*(.*?)\s*$", block, re.IGNORECASE | re.MULTILINE)
            return m.group(1).strip() if m else None
        world_id = grab("World ID")
        process_id = grab("Process ID")
        cartel_id = grab("VMX Cartel ID")
        uuid = grab("UUID")
        display_name = grab("Display Name")
        config_file = grab("Config File")
        if not any([world_id, process_id, cartel_id, uuid, display_name, config_file]):
            continue
        datastore = None
        if config_file:
            m = re.search(r"\[([^\]]+)\]", config_file)
            datastore = m.group(1) if m else None
        results.append({
            "name": display_name or "unknown-vm", "host": host_meta.get("hostname", "unknown-host"),
            "source": "localcli/vm-process-list", "vmx_path": config_file, "datastore": datastore,
            "guest_os": None, "uuid": uuid, "vcpu": None, "cpu_cores_per_socket": None, "memory_mb": None,
            "disk_count": None, "disk_summary": None, "disk_list": [], "network_count": None,
            "network_summary": None, "network_list": [], "world_id": world_id, "process_id": process_id,
            "cartel_id": cartel_id, "vm_status": None,
        "power_state": None
        })
    return results


def parse_vm_inventory(extracted_dir: Path, host_meta: Dict) -> List[Dict]:
    vms = []
    for pattern in ["commands/localcli_vm-process-list.txt", "commands/esxcli_vm_process_list.txt", "*vm-process-list*", "*vm_process_list*"]:
        for path in extracted_dir.rglob(pattern):
            if path.is_file():
                vms.extend(_parse_vm_process_list_file(path, host_meta))
    for pattern in ["commands/vmsvc/getallvms", "commands/vim-cmd_vmsvc_getallvms.txt", "*getallvms*"]:
        for path in extracted_dir.rglob(pattern):
            if path.is_file():
                vms.extend(_parse_getallvms_file(path, host_meta))
    for vmx in extracted_dir.rglob("*.vmx"):
        if vmx.is_file():
            vms.append(_parse_vmx_file(vmx, host_meta))
    return merge_vm_inventory([], vms)


def _normalize_path_key(value):
    if not value:
        return ""
    value = str(value).strip()
    value = re.sub(r"^/vmfs/volumes/[^/]+/", "", value)
    return value.lower()


def _parse_power_state_files(extracted_dir: Path, vms: List[Dict]):
    status_by_name = {}
    for pattern in ["*power.getstate*", "*getstate*", "*get.summary*", "*vm_power*"]:
        for path in extracted_dir.rglob(pattern):
            if not path.is_file():
                continue
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            status = None
            if re.search(r"Powered\s+on", text, re.IGNORECASE):
                status = "running"
            elif re.search(r"Powered\s+off", text, re.IGNORECASE):
                status = "stopped"
            elif re.search(r"suspended", text, re.IGNORECASE):
                status = "suspended"
            if not status:
                continue
            lower_text = text.lower()
            for row in vms:
                name = (row.get("name") or "").lower()
                if name and name in lower_text:
                    status_by_name[name] = status
    for row in vms:
        name = (row.get("name") or "").lower()
        if name in status_by_name:
            row["vm_status"] = status_by_name[name]
            row["power_state"] = status_by_name[name]
    return vms


def _vm_key(vm: Dict):
    host = vm.get("host") or ""
    uuid = vm.get("uuid") or ""
    if uuid:
        return (host, "uuid", uuid.lower())
    path_key = _normalize_path_key(vm.get("vmx_path"))
    if path_key:
        return (host, "path", path_key)
    return (host, "name", (vm.get("name") or "").lower())


def _canonical_aliases(vm: Dict):
    host = vm.get("host") or ""
    aliases = []

    uuid = vm.get("uuid")
    if uuid:
        aliases.append((host, "uuid", str(uuid).lower()))

    path_key = _normalize_path_key(vm.get("vmx_path"))
    if path_key:
        aliases.append((host, "path", path_key))

    name = vm.get("name")
    if name:
        aliases.append((host, "name", str(name).lower()))

    if not aliases:
        aliases.append((host, "unknown", ""))

    return aliases


def _is_empty(value):
    return value in [None, "", "unknown", "unknown-host", "unknown-version"] or value == []


def _merge_one(current: Dict, incoming: Dict):
    for k, v in incoming.items():
        if _is_empty(current.get(k)) and not _is_empty(v):
            current[k] = v

    # Prefer VMX source for detailed hardware data.
    for key in ["disk_count", "disk_summary", "disk_list", "network_count", "network_summary", "network_list", "vcpu", "memory_mb", "cpu_cores_per_socket"]:
        v = incoming.get(key)
        if not _is_empty(v):
            if _is_empty(current.get(key)) or incoming.get("source") == "vmx":
                current[key] = v

    # Preserve all sources that contributed to a VM record.
    sources = set()
    for item in [current.get("source"), incoming.get("source")]:
        if item:
            for part in str(item).split(","):
                sources.add(part.strip())
    if sources:
        current["source"] = ", ".join(sorted(sources))

    return current


def merge_vm_inventory(existing: List[Dict], incoming: List[Dict]) -> List[Dict]:
    records = []
    alias_to_index = {}

    for vm in existing + incoming:
        aliases = _canonical_aliases(vm)
        matched_idx = None

        for alias in aliases:
            if alias in alias_to_index:
                matched_idx = alias_to_index[alias]
                break

        if matched_idx is None:
            matched_idx = len(records)
            records.append(dict(vm))
        else:
            records[matched_idx] = _merge_one(records[matched_idx], vm)

        for alias in _canonical_aliases(records[matched_idx]) + aliases:
            alias_to_index[alias] = matched_idx

    return records
