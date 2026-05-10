# logX-vms

**logX-vms** is a lightweight web-based VMware ESXi `vm-support` bundle analyzer. It helps you upload, extract, browse, and analyze ESXi support bundles through a simple modern interface.

This tool is part of the **logX** app family.

---

## Description

logX-vms is built to simplify VMware ESXi support bundle review. It extracts useful information from `vm-support` archives and presents it in a browser-based dashboard.

Typical supported file:

```text
esx-<hostname>.<domain>.<timestamp>.tgz
```

It can also process ESXi `vm-support` bundles found inside `VMware-vCenter-support*.zip` archives.

---

## Main Features

```text
- Upload and analyze ESXi vm-support bundles.
- Drag-and-drop upload interface.
- Multiple-file upload with per-file progress.
- Recent Uploads page for switching between analyzed bundles.
- Dashboard with system overview, VM summary, and troubleshooting overview.
- VM Inventory page with searchable and expandable VM details.
- Logs page with tabbed ESXi log viewer.
- Troubleshooting page with rule-based findings.
- Path Mapping page for Fibre Channel HBA-to-LUN relationships.
- Web console for lightweight inspection inside the extracted bundle directory.
- Light/Dark theme toggle.
- Source switcher for changing the active uploaded bundle from main pages.
```

---

## Pages

### Dashboard

```text
- System overview.
- Active source file selector.
- VM list preview.
- Troubleshooting summary.
```

### VM Inventory

```text
- Searchable VM inventory table.
- Sticky table header.
- Expandable rows.
- VM identity details when available.
- Disk and NIC details when available.
```

### Troubleshooting

```text
- Rule-based log and command-output scanning.
- Findings grouped by troubleshooting category.
- Expandable rows with matching files and sample lines.
```

### Logs

Tabbed viewer for common ESXi logs and command outputs, including:

```text
/var/run/log/vmkernel.log
/var/run/log/hostd.log
/var/run/log/vpxa.log
/var/run/log/messages
/var/run/log/vobd.log
/var/run/log/auth.log
/var/run/log/shell.log
/var/run/log/syslog.log
/var/run/log/vmkwarning.log
/commands/esxcli_storage-core-device-list.txt
/commands/esxcli_network-nic-list.txt
```

### Path Mapping

Path Mapping parses Fibre Channel storage path information and displays it in both table and graph views.

Main source files:

```text
commands/localcli_storage-san-fc-list.txt
commands/localcli_storage-core-device-list.txt
commands/localcli_storage-core-path-list.txt
commands/localcli_storage-nmp-device-list.txt
```

Tables included:

```text
1. HBA Adapters
2. Storage Devices / LUNs
3. HBA to LUN Connections
```

The page also includes:

```text
- Search per table.
- Sticky table headers.
- Monospace table entries.
- HBA-to-LUN graph visualization.
- Focused graph modal.
```

### Console

```text
- Lightweight command runner.
- Runs inside the extracted vm-support directory.
- Supports simple directory navigation.
```

### Recent Uploads

```text
- Lists uploaded bundles.
- Switch active source file.
- Delete uploaded bundle.
```

---

## Requirements

```text
- Linux server or workstation
- Python 3.9+
- pip
- unzip
- Web browser
```

Python packages are listed in:

```text
requirements.txt
```

---

## Installation

```bash
cd /var/www/html
unzip logX-vms.zip
cd logX-vms

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Running the App

```bash
python app.py --host 0.0.0.0 --port 5000
```

Open in your browser:

```text
http://<server-ip>:5000
```

Local example:

```text
http://127.0.0.1:5000
```

---

## Data Directory

The app stores uploaded and extracted data locally.

Common directories:

```text
data/uploads
data/latest_extracted
data/tmp
data/logs
```

Large `vm-support` bundles can expand significantly. Make sure the filesystem has enough free space.

Check disk usage:

```bash
df -h
du -sh data/*
```

---

## Supported Bundle Types

```text
ESXi vm-support bundle:
  esx-*.tgz
  *.tar.gz
  *.tar

VMware vCenter support archive containing ESXi vm-support bundle:
  VMware-vCenter-support*.zip
```

---

## Notes

```text
- logX-vms is intended for troubleshooting assistance and support-bundle review.
- It does not replace VMware/Broadcom official support tools.
- Always validate important production findings with official logs and vendor support.
```

---

## Version

```text
logX-vms v1.10
© 2026 – ideas by nixnux
```

