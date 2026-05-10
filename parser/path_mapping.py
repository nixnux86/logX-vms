
from pathlib import Path
import re


def read_first(root, patterns):
    for pattern in patterns:
        for path in root.rglob(pattern):
            if path.is_file():
                try:
                    return path.read_text(errors="ignore"), str(path)
                except Exception:
                    pass
    return "", ""


def norm_id(value):
    value = (value or "").strip()
    value = re.sub(r"\s+", "_", value)
    return re.sub(r"[^A-Za-z0-9_.:-]", "_", value)


def normalize_wwn(value):
    value = (value or "").strip()
    if not value or value == "-":
        return "-"
    value = value.replace(" ", "")
    if value.lower().startswith("0x"):
        value = value[2:]
    if re.fullmatch(r"(?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}", value):
        return value.lower()
    if re.fullmatch(r"[0-9a-fA-F]{16}", value):
        return ":".join(value[i:i+2] for i in range(0, 16, 2)).lower()
    return value


def extract_wwpn(text):
    text = text or ""
    m = re.search(r"\bWWPN\s*:\s*((?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}|(?:0x)?[0-9a-fA-F]{16})", text, re.I)
    if m:
        return normalize_wwn(m.group(1))
    m = re.search(r"\bPort\s+Name\s*:\s*((?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}|(?:0x)?[0-9a-fA-F]{16})", text, re.I)
    if m:
        return normalize_wwn(m.group(1))
    tokens = re.findall(r"(?:0x)?[0-9a-fA-F]{16}|(?:[0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}", text)
    if tokens:
        return normalize_wwn(tokens[-1])
    return "-"


def split_records(text, header_regex=None):
    """
    Generic key:value record splitter.
    Also supports record header lines if header_regex matches.
    """
    rows = []
    current = {}
    last_key = None

    def flush():
        nonlocal current, last_key
        if current:
            rows.append(current)
            current = {}
            last_key = None

    for raw in (text or "").splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            flush()
            continue

        if header_regex and re.search(header_regex, stripped, re.I):
            flush()
            current["UID"] = stripped[:-1] if stripped.endswith(":") else stripped
            last_key = "UID"
            continue

        m = re.match(r"^\s*([^:]+?)\s*:\s*(.*?)\s*$", line)
        if m:
            key = m.group(1).strip()
            value = m.group(2).strip()
            current[key] = value
            last_key = key
        elif last_key:
            current[last_key] = (current.get(last_key, "") + "\n" + stripped).strip()

    flush()
    return rows


def compact_table_rows(text):
    """
    Fallback table splitter for space-separated tabular command output.
    """
    rows = []
    for line in (text or "").splitlines():
        if not re.search(r"\bvmhba\d+\b|\bnaa\.", line, re.I):
            continue
        cols = [c.strip() for c in re.split(r"\s{2,}", line.strip()) if c.strip()]
        if cols:
            rows.append((line.strip(), cols))
    return rows


def parse_fc_hba_adapters(fc_text):
    """
    Table 1 source:
      commands/localcli_storage-san-fc-list.txt

    Output columns:
      No | HBA Name | Description | Port State | Source WWPN | Firmware Version | Driver Name
    """
    adapters = {}
    records = split_records(fc_text)

    for rec in records:
        joined = "\n".join(f"{k}: {v}" for k, v in rec.items())
        hba = rec.get("Adapter") or rec.get("HBA Name") or rec.get("Name") or rec.get("HBA")
        if not hba:
            m = re.search(r"\b(vmhba\d+)\b", joined)
            hba = m.group(1) if m else None
        if not hba:
            continue

        source_wwpn = rec.get("Port Name") or rec.get("Port World Wide Name") or rec.get("Port WWN") or rec.get("WWPN") or extract_wwpn(joined)

        fw = rec.get("Firmware Version") or rec.get("FW Version") or rec.get("Firmware") or rec.get("OptionROM Version") or rec.get("Driver Version") or "-"
        driver_name = rec.get("Driver Name") or rec.get("Driver") or rec.get("Module Name") or rec.get("Module") or "-"

        adapters[hba] = {
            "hba": hba,
            "description": rec.get("Description") or rec.get("Model Description") or rec.get("Model") or rec.get("Node Name") or hba,
            "port_state": rec.get("Port State") or rec.get("Link State") or rec.get("State") or rec.get("Status") or "-",
            "source_wwn": normalize_wwn(source_wwpn),
            "firmware_version": fw,
            "driver_name": driver_name,
            # compatibility with older frontend/graph
            "driver_version": fw,
            "uid": driver_name
        }

    current = None
    for line in (fc_text or "").splitlines():
        h = re.search(r"\b(vmhba\d+)\b", line)
        if h:
            current = h.group(1)
            adapters.setdefault(current, {
                "hba": current,
                "description": current,
                "port_state": "-",
                "source_wwn": "-",
                "firmware_version": "-",
                "driver_name": "-",
                "driver_version": "-",
                "uid": "-"
            })

        if not current:
            continue

        m_port = re.search(r"^\s*Port\s+Name\s*:\s*(.+?)\s*$", line, re.I)
        if m_port:
            adapters[current]["source_wwn"] = normalize_wwn(m_port.group(1))

        m_state = re.search(r"^\s*(?:Port\s+State|Link\s+State|State)\s*:\s*(.+?)\s*$", line, re.I)
        if m_state:
            adapters[current]["port_state"] = m_state.group(1).strip()

        m_desc = re.search(r"^\s*(?:Description|Model Description|Model)\s*:\s*(.+?)\s*$", line, re.I)
        if m_desc:
            adapters[current]["description"] = m_desc.group(1).strip()

        m_fw = re.search(r"^\s*(?:Firmware Version|FW Version|Firmware|OptionROM Version|Driver Version)\s*:\s*(.+?)\s*$", line, re.I)
        if m_fw:
            adapters[current]["firmware_version"] = m_fw.group(1).strip()
            adapters[current]["driver_version"] = m_fw.group(1).strip()

        m_driver = re.search(r"^\s*(?:Driver Name|Driver|Module Name|Module)\s*:\s*(.+?)\s*$", line, re.I)
        if m_driver:
            adapters[current]["driver_name"] = m_driver.group(1).strip()
            adapters[current]["uid"] = m_driver.group(1).strip()

    rows = []
    for idx, hba in enumerate(sorted(adapters), 1):
        row = dict(adapters[hba])
        row["no"] = idx
        rows.append(row)
    return rows, {row["hba"]: row for row in rows}



def parse_core_devices(device_text):
    """
    Table 2 base source:
      commands/localcli_storage-core-device-list.txt
    """
    devices = {}
    records = split_records(device_text, header_regex=r"^naa\.[A-Za-z0-9_.:-]+:?$")

    for rec in records:
        joined = "\n".join(f"{k}: {v}" for k, v in rec.items())
        naa = (
            rec.get("Device")
            or rec.get("Device Name")
            or rec.get("Name")
            or rec.get("NAA")
        )
        if not naa:
            uid = rec.get("UID", "")
            m = re.search(r"\bnaa\.[A-Za-z0-9_.:-]+", uid or joined, re.I)
            naa = m.group(0) if m else None
        if not naa:
            continue

        devices[naa] = {
            "naa": naa,
            "display_name": (
                rec.get("Display Name")
                or rec.get("Device Display Name")
                or rec.get("Devfs Path")
                or naa
            ),
            "target_wwn": "-",
            "policy": (
                rec.get("Path Selection Policy")
                or rec.get("PSP")
                or rec.get("Multipath Plugin")
                or "-"
            ),
            "vendor": rec.get("Vendor") or "-",
            "model": rec.get("Model") or "-"
        }

    # Fallback for plain line with naa.*
    for line, cols in compact_table_rows(device_text):
        m = re.search(r"\bnaa\.[A-Za-z0-9_.:-]+", line, re.I)
        if not m:
            continue
        naa = m.group(0)
        devices.setdefault(naa, {
            "naa": naa,
            "display_name": line,
            "target_wwn": "-",
            "policy": "-",
            "vendor": "-",
            "model": "-"
        })

    return devices


def parse_path_connections(path_text):
    """
    Table 3 source:
      commands/localcli_storage-core-path-list.txt

    Output columns:
      Source (HBA) | Source WWPN | Status | Target WWPN | Destination (LUN)
    """
    connections = []
    target_by_naa = {}
    display_by_naa = {}

    records = split_records(
        path_text,
        header_regex=r"^fc\.[0-9a-fA-F:]+-fc\.[0-9a-fA-F:]+-naa\.[A-Za-z0-9_.:-]+:?$"
    )

    for rec in records:
        joined = "\n".join(f"{k}: {v}" for k, v in rec.items())

        hba = rec.get("Adapter")
        if not hba:
            m = re.search(r"\b(vmhba\d+)\b", rec.get("Runtime Name", "") or joined)
            hba = m.group(1) if m else None

        naa = rec.get("Device") or rec.get("Device Name")
        if not naa:
            m = re.search(r"\bnaa\.[A-Za-z0-9_.:-]+", joined, re.I)
            naa = m.group(0) if m else None

        if not hba or not naa:
            continue

        source_wwpn = extract_wwpn(rec.get("Adapter Transport Details", ""))
        if source_wwpn == "-":
            m = re.search(r"Adapter\s+Identifier\s*:\s*fc\.([0-9a-fA-F]{16}):([0-9a-fA-F]{16})", joined, re.I)
            if m:
                source_wwpn = normalize_wwn(m.group(2))

        target_wwpn = extract_wwpn(rec.get("Target Transport Details", ""))
        if target_wwpn == "-":
            m = re.search(r"Target\s+Identifier\s*:\s*fc\.([0-9a-fA-F]{16}):([0-9a-fA-F]{16})", joined, re.I)
            if m:
                target_wwpn = normalize_wwn(m.group(2))

        destination = rec.get("Device Display Name") or rec.get("Display Name") or naa
        status = rec.get("State") or rec.get("Path State") or rec.get("Status") or "unknown"

        row = {
            "hba": hba,
            "source_wwn": source_wwpn,
            "state": status,
            "target_wwn": target_wwpn,
            "naa": naa,
            "display_name": destination,
            "policy": "-",
            "runtime_name": rec.get("Runtime Name") or rec.get("UID") or "-"
        }
        connections.append(row)

        if target_wwpn != "-":
            target_by_naa[naa] = target_wwpn
        if destination and destination != naa:
            display_by_naa[naa] = destination

    connections.sort(key=lambda r: (r["hba"], r["naa"], r["runtime_name"]))
    return connections, target_by_naa, display_by_naa


def edge_color(state):
    state = (state or "").lower()
    if "active" in state:
        return "green"
    if any(x in state for x in ["standby", "alternate"]):
        return "blue"
    if any(x in state for x in ["dead", "failed", "broken", "off", "disabled", "inactive", "unavailable", "down"]):
        return "red"
    return "gray"


def short_label(value):
    value = (value or "").strip()
    return value if len(value) <= 34 else value[:30] + "..."



def parse_nmp_device_info(nmp_text):
    """
    Parse commands/localcli_storage-nmp-device-list.txt by NAA.
    Uses:
      Path Selection Policy:
      Working Paths:
    """
    info = {}
    records = split_records(nmp_text, header_regex=r"^naa\.[A-Za-z0-9_.:-]+:?$")

    for rec in records:
        joined = "\n".join(f"{k}: {v}" for k, v in rec.items())
        naa = rec.get("Device") or rec.get("Device Name") or rec.get("Name") or rec.get("NAA")
        if not naa:
            uid = rec.get("UID", "")
            m = re.search(r"\bnaa\.[A-Za-z0-9_.:-]+", uid or joined, re.I)
            naa = m.group(0) if m else None
        if not naa:
            continue

        info[naa] = {
            "policy": rec.get("Path Selection Policy") or rec.get("PSP") or rec.get("Path Selection Policy Device Config") or "-",
            "working_paths": rec.get("Working Paths") or rec.get("Working Path") or rec.get("Active Paths") or rec.get("Active Path") or "-"
        }

    current = None
    for line in (nmp_text or "").splitlines():
        m_naa = re.search(r"\bnaa\.[A-Za-z0-9_.:-]+", line, re.I)
        if m_naa:
            current = m_naa.group(0)
            info.setdefault(current, {"policy": "-", "working_paths": "-"})
        if not current:
            continue

        m_policy = re.search(r"^\s*Path\s+Selection\s+Policy\s*:\s*(.+?)\s*$", line, re.I)
        if m_policy:
            info[current]["policy"] = m_policy.group(1).strip()

        m_working = re.search(r"^\s*Working\s+Paths?\s*:\s*(.+?)\s*$", line, re.I)
        if m_working:
            info[current]["working_paths"] = m_working.group(1).strip()

    return info


def parse_path_mapping(root: Path):
    fc_text, fc_file = read_first(root, [
        "localcli_storage-san-fc-list.txt",
        "esxcli_storage-san-fc-list.txt",
        "*storage-san-fc-list*"
    ])
    device_text, device_file = read_first(root, [
        "localcli_storage-core-device-list.txt",
        "esxcli_storage-core-device-list.txt",
        "*storage-core-device-list*"
    ])
    path_text, path_file = read_first(root, [
        "localcli_storage-core-path-list.txt",
        "esxcli_storage-core-path-list.txt",
        "*storage-core-path-list*"
    ])
    nmp_text, nmp_file = read_first(root, [
        "localcli_storage-nmp-device-list.txt",
        "esxcli_storage-nmp-device-list.txt",
        "*storage-nmp-device-list*"
    ])

    adapter_rows, adapter_map = parse_fc_hba_adapters(fc_text)
    devices = parse_core_devices(device_text)
    nmp_info = parse_nmp_device_info(nmp_text)
    connection_rows, target_by_naa, display_by_naa = parse_path_connections(path_text)
    runtime_by_naa = {}
    for row in connection_rows:
        if row.get("runtime_name") and row.get("runtime_name") != "-":
            runtime_by_naa.setdefault(row["naa"], row["runtime_name"])

    # Enrich devices from path-list target WWPN + display name.
    for row in connection_rows:
        naa = row["naa"]
        devices.setdefault(naa, {
            "naa": naa,
            "display_name": display_by_naa.get(naa, row.get("display_name") or naa),
            "runtime": "-",
            "target_wwn": "-",
            "working_paths": "-",
            "policy": "-",
            "vendor": "-",
            "model": "-"
        })
        if target_by_naa.get(naa):
            devices[naa]["target_wwn"] = target_by_naa[naa]
        if display_by_naa.get(naa):
            devices[naa]["display_name"] = display_by_naa[naa]
        if runtime_by_naa.get(naa):
            devices[naa]["runtime"] = runtime_by_naa[naa]
        if nmp_info.get(naa):
            devices[naa]["policy"] = nmp_info[naa].get("policy") or "-"
            devices[naa]["working_paths"] = nmp_info[naa].get("working_paths") or "-"

        # Ensure HBA exists even if FC list is absent.
        if row["hba"] not in adapter_map:
            adapter_map[row["hba"]] = {
                "no": 0,
                "hba": row["hba"],
                "description": row["hba"],
                "port_state": "-",
                "source_wwn": row.get("source_wwn") or "-",
                "driver_version": "-",
                "uid": "-"
            }

    adapter_rows = []
    for idx, hba in enumerate(sorted(adapter_map), 1):
        row = dict(adapter_map[hba])
        row["no"] = idx
        if (not row.get("source_wwn") or row.get("source_wwn") == "-"):
            for c in connection_rows:
                if c["hba"] == hba and c.get("source_wwn") and c["source_wwn"] != "-":
                    row["source_wwn"] = c["source_wwn"]
                    break
        adapter_rows.append(row)

    for naa, info in nmp_info.items():
        devices.setdefault(naa, {
            "naa": naa,
            "display_name": naa,
            "runtime": runtime_by_naa.get(naa, "-"),
            "target_wwn": target_by_naa.get(naa, "-"),
            "working_paths": "-",
            "policy": "-",
            "vendor": "-",
            "model": "-"
        })
        devices[naa]["policy"] = info.get("policy") or "-"
        devices[naa]["working_paths"] = info.get("working_paths") or "-"
        if runtime_by_naa.get(naa):
            devices[naa]["runtime"] = runtime_by_naa[naa]
        if target_by_naa.get(naa):
            devices[naa]["target_wwn"] = target_by_naa[naa]

    for naa in list(devices):
        devices[naa].setdefault("runtime", runtime_by_naa.get(naa, "-"))
        devices[naa].setdefault("working_paths", nmp_info.get(naa, {}).get("working_paths", "-"))
        devices[naa].setdefault("policy", nmp_info.get(naa, {}).get("policy", devices[naa].get("policy", "-")))

    for row in connection_rows:
        row["policy"] = nmp_info.get(row["naa"], {}).get("policy", "-")

    device_rows = [devices[k] for k in sorted(devices)]

    nodes = []
    for row in adapter_rows:
        hba = row["hba"]
        nodes.append({
            "id": "hba:" + norm_id(hba),
            "label": hba,
            "type": "hba",
            "metadata": {
                "description": row.get("description"),
                "uid": row.get("uid"),
                "wwn": row.get("source_wwn"),
                "driver_version": row.get("driver_version")
            }
        })

    for row in device_rows:
        naa = row["naa"]
        nodes.append({
            "id": "storage:" + norm_id(naa),
            "label": short_label(row.get("display_name") or naa),
            "type": "storage",
            "metadata": {
                "device": naa,
                "display_name": row.get("display_name"),
                "policy": row.get("policy"),
                "vendor": row.get("vendor"),
                "model": row.get("model"),
                "target_wwn": row.get("target_wwn")
            }
        })

    edges = []
    for idx, row in enumerate(connection_rows):
        edges.append({
            "id": "path:" + str(idx),
            "source": "hba:" + norm_id(row["hba"]),
            "target": "storage:" + norm_id(row["naa"]),
            "status": edge_color(row.get("state")),
            "state": row.get("state") or "unknown",
            "metadata": {
                "runtime_name": row.get("runtime_name"),
                "source_wwn": row.get("source_wwn"),
                "target_wwn": row.get("target_wwn"),
                "policy": row.get("policy")
            }
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "tables": {
            "adapters": adapter_rows,
            "devices": device_rows,
            "connections": connection_rows
        },
        "summary": {
            "hba_count": len(adapter_rows),
            "storage_count": len(device_rows),
            "path_count": len(edges),
            "active_paths": sum(1 for e in edges if e["status"] == "green"),
            "standby_paths": sum(1 for e in edges if e["status"] == "blue"),
            "dead_paths": sum(1 for e in edges if e["status"] == "red")
        },
        "debug": {
            "files": {
                "fc": fc_file,
                "device": device_file,
                "path": path_file,
                "nmp": nmp_file
            },
            "input_sizes": {
                "fc": len(fc_text),
                "device": len(device_text),
                "path": len(path_text),
                "nmp": len(nmp_text)
            },
            "parsed_counts": {
                "adapters": len(adapter_rows),
                "devices": len(device_rows),
                "connections": len(connection_rows)
            }
        }
    }
