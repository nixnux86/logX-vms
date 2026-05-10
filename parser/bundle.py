from pathlib import Path
from contextlib import contextmanager
import tarfile
import zipfile
import tempfile
import shutil
import os


def _is_safe_path(base_dir: Path, member_name: str) -> bool:
    target = (base_dir / member_name).resolve()
    return str(target).startswith(str(base_dir.resolve()))


def _looks_like_archive(path: Path) -> bool:
    name = path.name.lower()
    return (
        name.endswith(".zip")
        or name.endswith(".tgz")
        or name.endswith(".tar")
        or name.endswith(".tar.gz")
        or name.endswith(".tar.bz2")
        or name.endswith(".tbz2")
        or name.endswith(".tar.xz")
        or name.endswith(".txz")
    )


def _extract_tar(bundle_path: Path, target_dir: Path):
    if not tarfile.is_tarfile(bundle_path):
        raise ValueError(f"File is not a valid tar/tgz archive: {bundle_path.name}")

    with tarfile.open(bundle_path, "r:*") as tar:
        for member in tar.getmembers():
            if not _is_safe_path(target_dir, member.name):
                raise ValueError(f"Unsafe archive path detected: {member.name}")
        tar.extractall(target_dir)


def _extract_zip(bundle_path: Path, target_dir: Path):
    if not zipfile.is_zipfile(bundle_path):
        raise ValueError(f"File is not a valid zip archive: {bundle_path.name}")

    with zipfile.ZipFile(bundle_path, "r") as zf:
        for member in zf.infolist():
            if not _is_safe_path(target_dir, member.filename):
                raise ValueError(f"Unsafe archive path detected: {member.filename}")
        zf.extractall(target_dir)


def _extract_archive(bundle_path: Path, target_dir: Path):
    name = bundle_path.name.lower()
    if name.endswith(".zip"):
        _extract_zip(bundle_path, target_dir)
    else:
        _extract_tar(bundle_path, target_dir)


def _recursive_extract_nested_archives(root_dir: Path, max_depth: int = 3):
    """
    Handles ESXi/vCenter bundle structure differences from 6.x through newer releases.
    Older bundles usually expose plain text directly, while newer bundles may contain
    nested archives, JSON-heavy payloads, component manifests, or split log archives.
    """
    extracted = []
    seen = set()

    for _depth in range(max_depth):
        candidates = []
        for path in root_dir.rglob("*"):
            if path.is_file() and path not in seen and _looks_like_archive(path):
                candidates.append(path)

        if not candidates:
            break

        for archive in candidates[:200]:
            seen.add(archive)
            target = archive.parent / f"__extracted__{archive.stem.replace('.', '_')}"
            target.mkdir(exist_ok=True)

            try:
                _extract_archive(archive, target)
                extracted.append(str(archive))
            except Exception:
                continue

    return extracted


def _extract_nested_esxi_bundle(extracted_root: Path):
    """
    vCenter support bundles can contain one or more nested ESXi vm-support
    bundles such as esx-<hostname>...tgz. For the ESXi-focused logX-vms
    workflow, extract the most likely nested ESXi bundle into the same
    extracted root, so existing parsers can discover commands/, vmkernel.log,
    hostd.log, path mapping files, VMX files, etc.

    Preference:
      1. filenames starting with esx-
      2. .tgz / .tar.gz / .tar
      3. largest file if multiple candidates exist
    """
    candidates = []

    for path in extracted_root.rglob("*"):
        if not path.is_file():
            continue

        name = path.name.lower()
        is_archive = (
            name.endswith(".tgz")
            or name.endswith(".tar.gz")
            or name.endswith(".tar")
        )
        if not is_archive:
            continue

        score = 0
        if name.startswith("esx-"):
            score += 100
        if "vm-support" in name or "support" in name:
            score += 20

        try:
            size = path.stat().st_size
        except Exception:
            size = 0

        candidates.append((score, size, path))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    nested_path = candidates[0][2]

    target = extracted_root / "_nested_esxi_vm_support"
    target.mkdir(parents=True, exist_ok=True)

    try:
        with tarfile.open(nested_path, "r:*") as tar:
            for member in tar.getmembers():
                if not _is_safe_path(target, member.name):
                    raise ValueError(f"Unsafe archive path detected: {member.name}")
            tar.extractall(target)
        return target
    except Exception:
        return None


@contextmanager
def extract_bundle_safely(bundle_path: Path):
    base_tmp = Path(os.environ.get("LOGX_TMPDIR", tempfile.gettempdir()))
    base_tmp.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="logx_vms_", dir=str(base_tmp)))

    try:
        _extract_archive(bundle_path, temp_dir)
        nested = _recursive_extract_nested_archives(temp_dir, max_depth=3)

        note = temp_dir / "__logx_extraction_summary.txt"
        note.write_text(
            "logX-vms extraction summary\n"
            f"source={bundle_path.name}\n"
            f"nested_archives_extracted={len(nested)}\n"
            + "\n".join(nested[:200]),
            encoding="utf-8",
            errors="ignore"
        )

        _extract_nested_esxi_bundle(temp_dir)

        yield temp_dir

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
