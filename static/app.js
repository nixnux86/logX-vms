let vmInventory = [];
let latestAnalysis = null;
let latestPathMapping = null;
let pathCy = null;
let currentLogType = "vmkernel";
let recentUploadItems = [];

const appShell = document.getElementById("appShell");
const sidebar = document.getElementById("sidebar");
const brandToggle = document.getElementById("brandToggle");

const pages = {
  dashboard: document.getElementById("dashboardPage"),
  inventory: document.getElementById("inventoryPage"),
  insights: document.getElementById("insightsPage"),
  pathmapping: document.getElementById("pathmappingPage"),
  logs: document.getElementById("logsPage"),
  console: document.getElementById("consolePage"),
  recent: document.getElementById("recentPage"),
  upload: document.getElementById("uploadPage")
};

const landingPage = document.getElementById("landingPage");
const uploadTemplate = document.getElementById("uploadTemplate");
const uploadMount = document.getElementById("uploadMount");
const landingUploadMount = document.getElementById("landingUploadMount");

const inventoryBadge = document.getElementById("inventoryBadge");
const hostName = document.getElementById("hostName");
const hostVersion = document.getElementById("hostVersion");
const bundleType = document.getElementById("bundleType");
const sourceFile = document.getElementById("sourceFile");

const dashboardVmBody = document.getElementById("dashboardVmBody");
const vmStatsChart = document.getElementById("vmStatsChart");
const vmStatsBadge = document.getElementById("vmStatsBadge");
const dashboardNoVmNote = document.getElementById("dashboardNoVmNote");
const summaryTotalVms = document.getElementById("summaryTotalVms");
const summaryTotalVcpu = document.getElementById("summaryTotalVcpu");
const summaryTotalMemory = document.getElementById("summaryTotalMemory");
const summaryTotalDisks = document.getElementById("summaryTotalDisks");
const summaryTotalNics = document.getElementById("summaryTotalNics");
const vcpuAllocationChart = document.getElementById("vcpuAllocationChart");
const memoryAllocationChart = document.getElementById("memoryAllocationChart");
const vcpuAllocBadge = document.getElementById("vcpuAllocBadge");
const memoryAllocBadge = document.getElementById("memoryAllocBadge");
const topMemoryChart = document.getElementById("topMemoryChart");
const topMemoryBadge = document.getElementById("topMemoryBadge");
const datastoreChart = document.getElementById("datastoreChart");
const datastoreBadge = document.getElementById("datastoreBadge");
const diskNicChart = document.getElementById("diskNicChart");
const diskNicBadge = document.getElementById("diskNicBadge");
const vmTableBody = document.getElementById("vmTableBody");
const searchBox = document.getElementById("searchBox");
const vmSearchTotal = document.getElementById("vmSearchTotal");

const findingsContainer = document.getElementById("findingsContainer");
const findingBadge = document.getElementById("findingBadge");
const insightsContainer = document.getElementById("insightsContainer");
const insightsFindingBadge = document.getElementById("insightsFindingBadge");
const recentUploads = document.getElementById("recentUploads");
const recentUploadsPage = document.getElementById("recentUploadsPage");

const logSearch = document.getElementById("logSearch");
const loadLogBtn = document.getElementById("loadLogBtn");
const logMeta = document.getElementById("logMeta");
const logViewer = document.getElementById("logViewer");
const logDescription = document.getElementById("logDescription");
const pathGraph = document.getElementById("pathGraph");
const pathTooltip = document.getElementById("pathTooltip");
const fitPathGraphBtn = document.getElementById("fitPathGraphBtn");
const topButton = document.getElementById("topButton");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmFile = document.getElementById("deleteConfirmFile");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const pathGraphModal = document.getElementById("pathGraphModal");
const pathGraphModalCanvas = document.getElementById("pathGraphModalCanvas");
const pathGraphModalClose = document.getElementById("pathGraphModalClose");
const pathGraphModalFit = document.getElementById("pathGraphModalFit");
const pathGraphModalTitle = document.getElementById("pathGraphModalTitle");
let pathModalCy = null;
const themeToggle = null;
const globalThemeToggle = null;
const terminalForm = document.getElementById("terminalForm");
const terminalCommand = document.getElementById("terminalCommand");
const terminalOutput = document.getElementById("terminalOutput");
const terminalCwd = { textContent: "bundle" };

function init() {
  appShell.classList.add("collapsed");
  mountUploadForm(uploadMount);
  mountUploadForm(landingUploadMount);
  setupNavigation();
  setupTheme();
  setupLogs();
  setupPathMappingControls();
  setupPathTableSearch();
  setupPathDetailsSearchVisibility();
  setupTopButton();
  setupPathGraphModal();
  setupConsole();
  loadState();
}


function activateRecentUploadsMenu() {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".recent-title-menu").forEach(b => b.classList.remove("active"));
  const recentTitle = document.querySelector(".recent-title-menu");
  if (recentTitle) recentTitle.classList.add("active");
}

function currentSourceName() {
  return latestAnalysis?.summary?.host?.source_file || "";
}

function installPageHeadControls() {
  updateSourceSwitchers();

  document.querySelectorAll(".source-switcher").forEach(select => {
    if (select.dataset.bound === "1") return;
    select.dataset.bound = "1";
    select.addEventListener("change", () => {
      const filename = select.value;
      refreshSourceSwitcherTitles();
      if (filename && filename !== currentSourceName()) openRecentUpload(filename);
    });
  });

  const currentTheme = localStorage.getItem("logx-theme") || document.body.dataset.theme || "light";
  document.querySelectorAll(".theme-page-toggle").forEach(btn => {
    btn.classList.toggle("is-dark", currentTheme === "dark");

    if (btn.dataset.themeBound === "1") return;
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.classList.add("theme-switching");
    document.querySelectorAll(".theme-page-toggle").forEach(btn => btn.classList.add("theme-bounce"));
      document.body.dataset.theme = next;
      localStorage.setItem("logx-theme", next);
      document.querySelectorAll(".theme-page-toggle").forEach(toggle => {
        toggle.classList.toggle("is-dark", next === "dark");
      });
      window.setTimeout(() => {
      document.body.classList.remove("theme-switching");
      document.querySelectorAll(".theme-page-toggle").forEach(btn => btn.classList.remove("theme-bounce"));
    }, 430);
    });
  });

}


function refreshSourceSwitcherTitles() {
  document.querySelectorAll(".source-switcher").forEach(select => {
    select.title = select.value ? `Selected Source: ${select.value}` : (select.options[select.selectedIndex]?.textContent || "Switch uploaded bundle");
  });
}

function updateSourceSwitchers() {
  const current = currentSourceName();
  const items = recentUploadItems || [];

  document.querySelectorAll(".source-switcher").forEach(select => {
    const previous = select.value || current;
    const optionItems = [];

    if (current) optionItems.push({ filename: current, current: true });
    items.forEach(item => {
      if (item.filename && item.filename !== current) optionItems.push(item);
    });

    select.innerHTML = optionItems.length
      ? optionItems.map(item => `<option value="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</option>`).join("")
      : `<option value="">No uploaded bundle</option>`;

    const valid = optionItems.some(item => item.filename === previous);
    select.value = valid ? previous : (current || "");
  });
  refreshSourceSwitcherTitles();
}

function setupNavigation() {
  brandToggle.addEventListener("click", () => {
    appShell.classList.toggle("collapsed");
  });

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  document.querySelectorAll(".recent-title-btn").forEach(btn => {
    btn.addEventListener("click", () => { activateRecentUploadsMenu(); showPage("recent"); });
  });

  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.goto));
  });
}

function showPage(name) {
  document.body.classList.remove("is-landing");
  landingPage.classList.add("hidden");
  Object.values(pages).forEach(p => p.classList.add("hidden"));
  pages[name]?.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === name);
  });

  installPageHeadControls();
  if (name === "upload") window.dispatchEvent(new CustomEvent("logx-reset-upload-zone"));
  if (name === "logs") loadLog();
  if (name === "pathmapping") setTimeout(loadPathMapping, 80);
  if (name === "console" && terminalCommand) {
    setTimeout(() => terminalCommand.focus(), 80);
  }
}

function showLanding() {
  document.body.classList.add("is-landing");
  Object.values(pages).forEach(p => p.classList.add("hidden"));
  landingPage.classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
}

function mountUploadForm(target) {
  const fragment = uploadTemplate.content.cloneNode(true);
  const form = fragment.querySelector("form");
  const dropZone = fragment.querySelector(".drop-zone");
  const input = fragment.querySelector(".bundle-input");
  const title = fragment.querySelector(".drop-title");
  const dropIcon = fragment.querySelector(".drop-icon");
  const statusBox = fragment.querySelector(".status");
  const progressWrap = fragment.querySelector(".progress-wrap");
  const progressStage = fragment.querySelector(".progress-stage");
  const progressPercent = fragment.querySelector(".progress-percent");
  const progressFill = fragment.querySelector(".progress-fill");
  const addNewBtn = fragment.querySelector(".add-new-btn");
  const cancelBtn = fragment.querySelector(".cancel-upload-btn");
  const uploadBtn = fragment.querySelector(".primary-upload-btn");
  const queueBox = fragment.querySelector(".upload-queue");

  let selectedFiles = [];
  let activeXhr = null;
  let cancelRequested = false;
  let isUploading = false;

  function setProgress(percent, stage) {
    progressWrap.classList.remove("hidden");
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressStage.textContent = stage;
  }

  function showStatus(message, isError = false) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.classList.remove("hidden");
    statusBox.classList.toggle("error", isError);
  }

  function fileSizeLabel(bytes) {
    const mb = Number(bytes || 0) / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  }

  function uploadDateTimeLabel(date = new Date()) {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function fileIconForName(name) {
    const lower = String(name || "").toLowerCase();
    if (lower.endsWith(".tar.gz")) return { src: "/static/icons/tgz.svg", kind: "tgz", label: "TAR.GZ" };
    if (lower.endsWith(".tgz")) return { src: "/static/icons/tgz.svg", kind: "tgz", label: "TGZ" };
    if (lower.endsWith(".tar")) return { src: "/static/icons/tar.svg", kind: "tar", label: "TAR" };
    if (lower.endsWith(".zip")) return { src: "/static/icons/zip.svg", kind: "zip", label: "ZIP" };
    if (lower.endsWith(".gz")) return { src: "/static/icons/gz.svg", kind: "gz", label: "GZ" };
    return { src: "/static/icons/upload.png", kind: "file", label: "FILE" };
  }

  function setDropFileIcon(files) {
    renderDropFileGrid(files);
  }

  function renderDropFileGrid(files) {
    if (!dropIcon) return;

    const list = Array.from(files || []);
    if (!list.length) {
      dropIcon.dataset.kind = "upload";
      dropIcon.classList.remove("file-grid-mode");
      resetDropZoneIcon();
      return;
    }

    dropIcon.dataset.kind = "grid";
    dropIcon.classList.add("file-grid-mode");
    dropIcon.innerHTML = `
      <div class="drop-file-grid">
        ${list.slice(0, 8).map(file => {
          const icon = fileIconForName(file.name);
          return `
            <span class="drop-file-grid-item" title="${escapeHtml(file.name)}">
              <img src="${escapeHtml(icon.src)}" alt="${escapeHtml(icon.label)}">
            </span>
          `;
        }).join("")}
      </div>
    `;
  }

  function resetDropZoneIcon() {
    if (!dropIcon) return;
    dropIcon.dataset.kind = "upload";
    dropIcon.classList.remove("file-grid-mode");
    dropIcon.innerHTML = `<img src="/static/icons/upload.png" alt="Upload">`;
  }

  function bounceDropZone() {
    dropZone.classList.remove("drop-bounce");
    void dropZone.offsetWidth;
    dropZone.classList.add("drop-bounce");
    window.setTimeout(() => dropZone.classList.remove("drop-bounce"), 520);
  }

  function renderQueue(activeIndex = -1, states = {}) {
    if (!selectedFiles.length) {
      queueBox.classList.add("hidden");
      queueBox.innerHTML = "";
      return;
    }

    queueBox.classList.remove("hidden");
    queueBox.innerHTML = selectedFiles.map((file, idx) => {
      const stateValue = states[idx] || (idx === activeIndex ? "Uploading..." : "Queued");
      const state = typeof stateValue === "object" ? stateValue.label : stateValue;
      const completedAt = typeof stateValue === "object" ? stateValue.completedAt : "";
      const progressText = typeof stateValue === "object" && stateValue.progress ? ` ${stateValue.progress}%` : "";
      const cls = state.toLowerCase().includes("failed") ? "failed" : (state.toLowerCase().includes("complete") ? "complete" : "");
      const iconMeta = fileIconForName(file.name);
      return `
        <div class="upload-queue-item ${cls}">
          <span class="queue-file-icon" data-kind="${escapeHtml(iconMeta.kind)}"><img src="${escapeHtml(iconMeta.src)}" alt="${escapeHtml(iconMeta.label)}"></span>
          <div class="upload-queue-meta">
            <strong>${escapeHtml(file.name)}</strong>
            <span>Size: ${escapeHtml(fileSizeLabel(file.size))}</span>
            <div class="upload-queue-status-line">
              <em>${escapeHtml(state)}${completedAt ? ` · ${escapeHtml(completedAt)}` : ""}</em>
              ${progressText ? `
                <span class="upload-queue-item-progress" aria-label="File upload progress">
                  <span class="upload-queue-item-progress-fill" style="width:${escapeHtml(progressText.trim())}"></span>
                </span>
                <span class="upload-queue-percent">${escapeHtml(progressText.trim())}</span>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function setChosenFiles(files) {
    selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    title.textContent = selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length} support bundles selected`;

    dropZone.classList.add("has-file");
    renderDropFileGrid(selectedFiles);
    bounceDropZone();
    addNewBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    uploadBtn.classList.remove("hidden");
    setProgress(0, "Ready to upload");
    showStatus("Ready to upload");
    renderQueue();
  }

  function resetForm() {
    selectedFiles = [];
    input.value = "";
    title.textContent = "Drag & drop ESXi/vCenter support bundle here";
    resetDropZoneIcon();
    dropZone.classList.remove("has-file");
    progressWrap.classList.add("hidden");
    if (statusBox) statusBox.classList.add("hidden");
    addNewBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    uploadBtn.classList.remove("hidden");
    renderQueue();
    cancelRequested = false;
    isUploading = false;
    activeXhr = null;
  }

  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", event => setChosenFiles(event.dataTransfer.files));
  input.addEventListener("change", () => setChosenFiles(input.files));

  cancelBtn.addEventListener("click", event => {
    event.preventDefault();
    cancelRequested = true;
    if (activeXhr) activeXhr.abort();
    setProgress(100, "Cancelled");
    showStatus("Upload cancelled.", true);
    resetDropZoneIcon();
    dropZone.classList.remove("has-file");
    cancelBtn.classList.add("hidden");
    addNewBtn.classList.remove("hidden");
    uploadBtn.classList.remove("hidden");
    isUploading = false;
  });

  addNewBtn.addEventListener("click", event => {
    event.preventDefault();
    resetForm();
  });

  function analyzeOneFile(file, index, total, states) {
    return new Promise(resolve => {
      const fd = new FormData();
      fd.append("bundle", file);
      fd.append("append", "false");

      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      states[index] = { label: "Uploading...", progress: 0 };
      renderQueue(index, states);

      xhr.upload.addEventListener("progress", event => {
        if (event.lengthComputable) {
          const withinFile = Math.round((event.loaded / event.total) * 35);
          const overall = Math.min(95, Math.round(((index / total) * 100) + (withinFile / total)));
          setProgress(overall, `Uploading ${index + 1}/${total}: ${file.name}`);
          showStatus("Uploading bundle...");
        }
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          setProgress(Math.round(((index + 0.45) / total) * 100), `Extracting ${index + 1}/${total}: ${file.name}`);
          showStatus("Extracting archive...");
          states[index] = "Extracting archive...";
          renderQueue(index, states);
        }
        if (xhr.readyState === XMLHttpRequest.LOADING) {
          setProgress(Math.round(((index + 0.72) / total) * 100), `Parsing ${index + 1}/${total}: ${file.name}`);
          showStatus("Analyzing bundle...");
          states[index] = "Analyzing bundle...";
          renderQueue(index, states);
        }
      };

      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch (e) {}

        if (xhr.status >= 400 || !data.ok) {
          states[index] = "Upload Failed";
          renderQueue(index, states);
          showStatus(data.error || `Failed to analyze ${file.name}.`, true);
          resolve({ok:false, data});
          return;
        }

        states[index] = { label: "Completed", completedAt: uploadDateTimeLabel() };
        renderQueue(index, states);
        resolve({ok:true, data});
      };

      xhr.onerror = () => {
        states[index] = "Upload Failed";
        renderQueue(index, states);
        showStatus("Request failed. Please check server connection.", true);
        resolve({ok:false, data:{}});
      };

      xhr.onabort = () => {
        states[index] = "Cancelled";
        renderQueue(index, states);
        resolve({ok:false, cancelled:true, data:{}});
      };

      xhr.open("POST", "/api/analyze");
      xhr.send(fd);
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedFiles.length) {
      showStatus("Please choose or drag one or more support bundles first.", true);
      return;
    }

    isUploading = true;
    cancelRequested = false;
    uploadBtn.classList.add("hidden");
    cancelBtn.classList.remove("hidden");
    addNewBtn.classList.add("hidden");

    const states = {};
    let lastData = null;

    for (let i = 0; i < selectedFiles.length; i++) {
      if (cancelRequested) break;

      const result = await analyzeOneFile(selectedFiles[i], i, selectedFiles.length, states);
      if (result.cancelled || cancelRequested) break;
      if (result.ok) lastData = result.data;
    }

    activeXhr = null;
    isUploading = false;
    cancelBtn.classList.add("hidden");
    uploadBtn.classList.remove("hidden");
    addNewBtn.classList.remove("hidden");

    if (lastData && !cancelRequested) {
      const processedCount = selectedFiles.length;
      setProgress(100, "Analysis complete");
      showStatus(`Analysis complete. Processed ${processedCount} file(s).`);
      vmInventory = lastData.vms || [];
      latestAnalysis = lastData.analysis || {};
      latestPathMapping = lastData.path_mapping || {nodes: [], edges: [], summary: {}};
      renderAll(lastData);
      renderRecent(lastData.recent_uploads || []);

      // Reset drop zone after upload, then keep Add New visible as the next action.
      selectedFiles = [];
      input.value = "";
      title.textContent = "Drag & drop ESXi/vCenter support bundle here";
      resetDropZoneIcon();
      dropZone.classList.remove("has-file");
      progressWrap.classList.add("hidden");
      renderQueue();
      uploadBtn.classList.add("hidden");
      addNewBtn.classList.remove("hidden");
      cancelBtn.classList.add("hidden");

      showPage("dashboard");
    }
  });

  window.addEventListener("logx-reset-upload-zone", () => {
    if (target && target.isConnected) resetDropZoneArea(true);
  });

  target.innerHTML = "";
  target.appendChild(fragment);
}


function setupTheme() {
  const apply = mode => {
    document.body.classList.add("theme-switching");
    document.querySelectorAll(".theme-page-toggle").forEach(btn => btn.classList.add("theme-bounce"));
    document.body.dataset.theme = mode;
    localStorage.setItem("logx-theme", mode);
    document.querySelectorAll(".theme-page-toggle").forEach(btn => {
      btn.classList.toggle("is-dark", mode === "dark");
      btn.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
    window.setTimeout(() => {
      document.body.classList.remove("theme-switching");
      document.querySelectorAll(".theme-page-toggle").forEach(btn => btn.classList.remove("theme-bounce"));
    }, 430);
  };

  const current = localStorage.getItem("logx-theme") || "light";
  apply(current);

  document.querySelectorAll(".theme-page-toggle").forEach(btn => {
    if (btn.dataset.themeBound === "1") return;
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", () => {
      apply(document.body.dataset.theme === "dark" ? "light" : "dark");
    });
  });

  installPageHeadControls();
}

let terminalHistory = [];
let terminalHistoryIndex = -1;

function appendTerminalLine(html) {
  const div = document.createElement("div");
  div.className = "terminal-line";
  div.innerHTML = html;
  terminalOutput.appendChild(div);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function setTerminalCwd(cwd) {
  const raw = String(cwd || "bundle");
  const parts = raw.split("/").filter(Boolean);
  const current = raw === "unavailable" ? "bundle" : (parts.slice(-1)[0] || "bundle");
  const display = current === "latest_extracted" ? "bundle" : current;
  document.querySelectorAll(".terminal-prompt, .terminal-prompt-inline").forEach(el => {
    el.textContent = `logX-vms:${display}$`;
  });
}

async function handleTerminalAutocomplete() {
  const text = terminalCommand.value;

  if (!text.trim()) {
    terminalCommand.value = "ls -la ";
    return;
  }

  try {
    const res = await fetch("/api/console/complete", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    const suggestions = data.suggestions || [];

    if (suggestions.length === 1) {
      const parts = text.split(/\s+/);
      parts[parts.length - 1] = suggestions[0];
      terminalCommand.value = parts.join(" ");
      return;
    }

    if (suggestions.length > 1) {
      appendTerminalLine(`<span class="terminal-muted">${suggestions.map(escapeHtml).join("    ")}</span>`);
    }
  } catch (err) {
    appendTerminalLine(`<span class="terminal-error">Autocomplete failed: ${escapeHtml(err.message)}</span>`);
  }
}


async function loadPathMapping() {
  try {
    const res = await fetch("/api/path_mapping");
    const data = await res.json();
    if (data.ok) {
      latestPathMapping = data.path_mapping || {nodes: [], edges: [], tables: {}, summary: {}};
      renderPathMapping(latestPathMapping);
    }
  } catch (err) {
    console.error("Unable to load path mapping", err);
  }
}

function setupPathMappingControls() {
  if (fitPathGraphBtn) fitPathGraphBtn.addEventListener("click", () => { if (pathCy) pathCy.fit(undefined, 40); });
}
function reapplyPathTableFilters() {
  document.querySelectorAll(".path-table-search").forEach(input => input.dispatchEvent(new Event("input")));
}



function normalizePortStateDisplay(value) {
  const raw = String(value || "-").trim();
  const key = raw.toLowerCase();

  if (key === "link-up" || key === "link up" || key === "up") return "ONLINE";
  if (key === "link-down" || key === "link down" || key === "down") return "Link Down";
  if (key === "link-n/a" || key === "link n/a" || key === "n/a" || key === "na") return "N/A";

  return raw;
}

function renderPortState(value) {
  const state = normalizePortStateDisplay(value);
  const cls = state.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
  return `<span class="port-state-pill ${escapeHtml(cls || "unknown")}">${escapeHtml(state)}</span>`;
}

function renderPathMappingTables(data) {
  const tables = data?.tables || {};
  const adapters = tables.adapters || [];
  const devices = tables.devices || [];
  const connections = (tables.connections || []).slice().sort((a, b) => {
    return String(a.hba || "").localeCompare(String(b.hba || ""))
      || String(a.naa || "").localeCompare(String(b.naa || ""))
      || String(a.runtime_name || "").localeCompare(String(b.runtime_name || ""));
  });

  const setBody = (id, html, emptyCols, emptyText) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html || `<tr><td colspan="${emptyCols}" class="empty">${emptyText}</td></tr>`;
  };

  setBody("pmAdaptersBody", adapters.map((row, idx) => `
    <tr>
      <td>${escapeHtml(row.no || idx + 1)}</td>
      <td>${escapeHtml(row.hba || "-")}</td>
      <td>${escapeHtml(row.description || "-")}</td>
      <td>${renderPortState(row.port_state || "-")}</td>
      <td><code>${escapeHtml(row.source_wwn || row.wwn || "-")}</code></td>
      <td>${escapeHtml(row.firmware_version || row.driver_version || "-")}</td>
      <td>${escapeHtml(row.driver_name || row.uid || "-")}</td>
    </tr>
  `).join(""), 7, "No adapter data.");

  setBody("pmDevicesBody", devices.map(row => `
    <tr>
      <td><code>${escapeHtml(row.naa || "-")}</code></td>
      <td>${escapeHtml(row.display_name || "-")}</td>
      <td>${escapeHtml(row.runtime || "-")}</td>
      <td><code>${escapeHtml(row.target_wwn || "-")}</code></td>
      <td>${escapeHtml(row.working_paths || "-")}</td>
      <td>${escapeHtml(row.policy || "-")}</td>
      <td>${escapeHtml(row.vendor || "-")}</td>
      <td>${escapeHtml(row.model || "-")}</td>
    </tr>
  `).join(""), 8, "No storage data.");

  setBody("pmConnectionsBody", connections.map(row => `
    <tr>
      <td>${escapeHtml(row.hba || "-")}</td>
      <td><code>${escapeHtml(row.naa || "-")}</code></td>
      <td><code>${escapeHtml(row.source_wwn || "-")}</code></td>
      <td><span class="path-state-pill ${escapeHtml(row.state || "unknown")}">${escapeHtml(row.state || "unknown")}</span></td>
      <td><code>${escapeHtml(row.target_wwn || "-")}</code></td>
      <td>${escapeHtml(row.display_name || "-")}</td>
      <td>${escapeHtml(row.policy || "-")}</td>
      <td>${escapeHtml(row.runtime_name || "-")}</td>
    </tr>
  `).join(""), 8, "No connection data.");
  setupPathTableSearch();
  setupPathDetailsSearchVisibility();
  reapplyPathTableFilters();
}


function buildPathElementsForNeighborhood(nodeId, sourceData) {
  const data = sourceData || latestPathMapping || { nodes: [], edges: [] };
  const relatedEdgeIds = new Set();
  const relatedNodeIds = new Set([nodeId]);

  (data.edges || []).forEach(edge => {
    if (edge.source === nodeId || edge.target === nodeId) {
      relatedEdgeIds.add(edge.id);
      relatedNodeIds.add(edge.source);
      relatedNodeIds.add(edge.target);
    }
  });

  return [
    ...(data.nodes || [])
      .filter(node => relatedNodeIds.has(node.id))
      .map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          metadata: node.metadata || {}
        },
        classes: node.type
      })),
    ...(data.edges || [])
      .filter(edge => relatedEdgeIds.has(edge.id))
      .map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          status: edge.status,
          state: edge.state,
          metadata: edge.metadata || {}
        },
        classes: edge.status || "gray"
      }))
  ];
}

function openPathGraphModal(nodeData) {
  if (!pathGraphModal || !pathGraphModalCanvas || typeof cytoscape === "undefined") return;

  const title = nodeData?.label || "Selected Node";
  if (pathGraphModalTitle) pathGraphModalTitle.textContent = title;

  pathGraphModal.classList.remove("hidden");
  pathGraphModal.setAttribute("aria-hidden", "false");
  pathGraphModalCanvas.innerHTML = "";

  if (pathModalCy) {
    pathModalCy.destroy();
    pathModalCy = null;
  }

  const elements = buildPathElementsForNeighborhood(nodeData.id, latestPathMapping);

  pathModalCy = cytoscape({
    container: pathGraphModalCanvas,
    elements,
    layout: {
      name: "breadthfirst",
      directed: true,
      padding: 48,
      spacingFactor: 1.55,
      circle: false
    },
    wheelSensitivity: 0.18,
    style: [
      {
        selector: "node",
        style: {
          "label": "data(label)",
          "font-family": "Roboto, Lato, Inter, Arial",
          "font-size": 12,
          "text-wrap": "wrap",
          "text-max-width": 180,
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 10,
          "background-color": "#e2e8f0",
          "border-color": "#94a3b8",
          "border-width": 1,
          "width": 48,
          "height": 48,
          "color": "#1e293b"
        }
      },
      {
        selector: "node.hba",
        style: {
          "background-color": "#dbeafe",
          "border-color": "#2563eb",
          "shape": "round-rectangle"
        }
      },
      {
        selector: "node.storage",
        style: {
          "background-color": "#dcfce7",
          "border-color": "#16a34a",
          "shape": "ellipse"
        }
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "width": 2,
          "line-color": "#94a3b8",
          "target-arrow-color": "#94a3b8",
          "label": "data(state)",
          "font-size": 10,
          "color": "#475569",
          "text-background-color": "#ffffff",
          "text-background-opacity": .85,
          "text-background-padding": 2
        }
      },
      { selector: "edge.green", style: { "line-color": "#16a34a", "target-arrow-color": "#16a34a" } },
      { selector: "edge.blue", style: { "line-color": "#2563eb", "target-arrow-color": "#2563eb" } },
      { selector: "edge.red", style: { "line-color": "#dc2626", "target-arrow-color": "#dc2626", "width": 2.4 } }
    ]
  });

  setTimeout(() => pathModalCy.fit(undefined, 50), 120);
}

function closePathGraphModal() {
  if (!pathGraphModal) return;
  pathGraphModal.classList.add("hidden");
  pathGraphModal.setAttribute("aria-hidden", "true");
  if (pathModalCy) {
    pathModalCy.destroy();
    pathModalCy = null;
  }
}

function setupPathGraphModal() {
  if (pathGraphModalClose) pathGraphModalClose.addEventListener("click", closePathGraphModal);
  if (pathGraphModalFit) pathGraphModalFit.addEventListener("click", () => {
    if (pathModalCy) pathModalCy.fit(undefined, 50);
  });
  if (pathGraphModal) {
    pathGraphModal.addEventListener("click", event => {
      if (event.target === pathGraphModal) closePathGraphModal();
    });
  }
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePathGraphModal();
  });
}


function renderPathMapping(data) {
  if (!pathGraph) return;
  data = data || {nodes:[], edges:[], tables:{}, summary:{}}; renderPathMappingTables(data);
  const s=data.summary||{}, set=(id,v)=>{const e=document.getElementById(id); if(e)e.textContent=v||0;};
  set("pmHbaCount",s.hba_count); set("pmStorageCount",s.storage_count); set("pmPathCount",s.path_count); set("pmActiveCount",s.active_paths); set("pmStandbyCount",s.standby_paths); set("pmDeadCount",s.dead_paths);
  if (!data.nodes || !data.nodes.length) { pathGraph.innerHTML='<div class="path-empty">No graph edges found yet. Check the tables above first: adapters, storage devices, and HBA-to-LUN connections.</div>'; return; }
  const connectedIds = new Set();
  (data.edges || []).forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
  const connectedNodes = (data.nodes || []).filter(n => connectedIds.has(n.id));
  const elements=[
    ...connectedNodes.map(n=>({data:{id:n.id,label:n.label,type:n.type,metadata:n.metadata||{}},classes:n.type})),
    ...(data.edges || []).map(e=>({data:{id:e.id,source:e.source,target:e.target,status:e.status,state:e.state,metadata:e.metadata||{}},classes:e.status||"gray"}))
  ];
  pathGraph.innerHTML="";
  pathCy=cytoscape({container:pathGraph,elements,layout:{name:"breadthfirst",directed:true,padding:40,spacingFactor:1.25,circle:false},style:[
    {selector:"node",style:{"label":"data(label)","font-family":"Roboto, Lato, Inter, Arial","font-size":11,"text-wrap":"wrap","text-max-width":150,"text-valign":"bottom","text-halign":"center","text-margin-y":8,"background-color":"#e2e8f0","border-color":"#94a3b8","border-width":1,"width":42,"height":42,"color":"#1e293b"}},
    {selector:"node.hba",style:{"background-color":"#dbeafe","border-color":"#2563eb","shape":"round-rectangle","label":"data(label)"}},
    {selector:"node.storage",style:{"background-color":"#dcfce7","border-color":"#16a34a","shape":"ellipse","label":"data(label)"}},
    {selector:"edge",style:{"curve-style":"bezier","target-arrow-shape":"triangle","width":1.8,"line-color":"#94a3b8","target-arrow-color":"#94a3b8","label":"data(state)","font-size":9,"color":"#475569","text-background-color":"#fff","text-background-opacity":.85,"text-background-padding":2}},
    {selector:"edge.green",style:{"line-color":"#16a34a","target-arrow-color":"#16a34a"}},{selector:"edge.blue",style:{"line-color":"#2563eb","target-arrow-color":"#2563eb"}},{selector:"edge.red",style:{"line-color":"#dc2626","target-arrow-color":"#dc2626","width":2.3}},{selector:".faded",style:{"opacity":.18}},{selector:"node.highlighted",style:{"opacity":1,"border-width":2,"width":46,"height":46}},{selector:"edge.highlighted",style:{"opacity":1,"width":2.6}}
  ]});

  // v26-modal-node-tap: open focused modal when clicking a graph node
  pathCy.off("tap", "node");
  pathCy.on("tap", "node", evt => {
    const node = evt.target;
    const connected = node.closedNeighborhood();

    pathCy.elements().addClass("faded").removeClass("highlighted");
    connected.removeClass("faded").addClass("highlighted");

    openPathGraphModal(node.data());
  });

  
  // v26-modal-node-tap: open focused modal when clicking a graph node
  pathCy.off("tap", "node");
  pathCy.on("tap", "node", evt => {
    const node = evt.target;
    const connected = node.closedNeighborhood();

    pathCy.elements().addClass("faded").removeClass("highlighted");
    connected.removeClass("faded").addClass("highlighted");

    openPathGraphModal(node.data());
  });

  pathCy.on("mouseover","node, edge",evt=>{const d=evt.target.data(),m=d.metadata||{}; pathTooltip.innerHTML=evt.target.isNode()?`<strong>${escapeHtml(d.label||d.id)}</strong><div>Type: ${escapeHtml(d.type||"-")}</div><div>UID: ${escapeHtml(m.uid||"-")}</div><div>WWN: ${escapeHtml(m.wwn||"-")}</div><div>Driver: ${escapeHtml(m.driver||"-")}</div><div>Driver Version: ${escapeHtml(m.driver_version||"-")}</div><div>Policy: ${escapeHtml(m.policy||"-")}</div><div>Device: ${escapeHtml(m.device||"-")}</div>`:`<strong>Path</strong><div>State: ${escapeHtml(d.state||"-")}</div><div>Runtime: ${escapeHtml(m.runtime_name||"-")}</div>`; pathTooltip.classList.remove("hidden");});
  pathCy.on("mousemove","node, edge",evt=>{pathTooltip.style.left=`${evt.renderedPosition.x+14}px`; pathTooltip.style.top=`${evt.renderedPosition.y+14}px`;});
  pathCy.on("mouseout","node, edge",()=>pathTooltip.classList.add("hidden"));
  pathCy.on("tap","node",evt=>{
    const node = evt.target;
    const c = node.closedNeighborhood();
    pathCy.elements().addClass("faded").removeClass("highlighted");
    c.removeClass("faded").addClass("highlighted");
    openPathGraphModal(node.data());
  });
  pathCy.on("tap",evt=>{if(evt.target===pathCy) pathCy.elements().removeClass("faded highlighted");});
}



function setupPathDetailsSearchVisibility() {
  document.querySelectorAll(".path-tables details").forEach(details => {
    if (details.dataset.searchVisibilityBound === "true") return;
    details.dataset.searchVisibilityBound = "true";
    details.addEventListener("toggle", () => {
      const input = details.querySelector(".path-table-search");
      if (input) input.classList.toggle("hidden-search", !details.open);
    });
    const input = details.querySelector(".path-table-search");
    if (input) input.classList.toggle("hidden-search", !details.open);
  });
}


function setupPathTableSearch() {
  document.querySelectorAll(".path-table-search").forEach(input => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("click", event => event.stopPropagation());
    input.addEventListener("keydown", event => event.stopPropagation());
    input.addEventListener("input", () => {
      const tbody = document.getElementById(input.dataset.targetTable);
      if (!tbody) return;
      const query = input.value.trim().toLowerCase();
      tbody.querySelectorAll("tr").forEach(row => {
        const isEmpty = row.querySelector(".empty");
        if (isEmpty) return;
        const match = !query || row.textContent.toLowerCase().includes(query);
        row.classList.toggle("path-row-hidden", !match);
      });
    });
  });
}

function setupTopButton() {
  if (!topButton) return;
  const scrollRoot = document.querySelector(".content") || window;
  const getScrollTop = () => scrollRoot === window ? window.scrollY : scrollRoot.scrollTop;
  const update = () => topButton.classList.toggle("show", getScrollTop() > 360);
  if (scrollRoot === window) window.addEventListener("scroll", update);
  else scrollRoot.addEventListener("scroll", update);
  topButton.addEventListener("click", () => {
    if (scrollRoot === window) window.scrollTo({ top: 0, behavior: "smooth" });
    else scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
  });
  update();
}


function setupConsole() {
  if (!terminalForm) return;
  terminalCommand.addEventListener("keydown", event => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!terminalHistory.length) return;
      terminalHistoryIndex = Math.max(0, terminalHistoryIndex - 1);
      terminalCommand.value = terminalHistory[terminalHistoryIndex] || "";
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!terminalHistory.length) return;
      terminalHistoryIndex = Math.min(terminalHistory.length, terminalHistoryIndex + 1);
      terminalCommand.value = terminalHistory[terminalHistoryIndex] || "";
    }
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      terminalOutput.innerHTML = `<div class="terminal-muted">logX console ready. Commands run from the extracted vm-support root.</div>`;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (!terminalCommand.value.trim()) terminalCommand.value = "ls -la";
    }
  });
  terminalForm.addEventListener("submit", async event => {
    event.preventDefault();
    const command = terminalCommand.value.trim();
    if (!command) return;
    terminalHistory.push(command);
    terminalHistoryIndex = terminalHistory.length;
    appendTerminalLine(`<span class="terminal-prompt-inline">logX-vms:bundle$</span> <span>${escapeHtml(command)}</span>`);
    terminalCommand.value = "";
    if (command === "clear") {
      terminalOutput.innerHTML = `<div class="terminal-muted">logX console ready. Commands run from the extracted vm-support root.</div>`;
      return;
    }
    try {
      const res = await fetch("/api/console", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ command })});
      const data = await res.json();
      setTerminalCwd(data.cwd || "unavailable");
      if (!data.ok) {
        appendTerminalLine(`<span class="terminal-error">${escapeHtml(data.error || "Command failed.")}</span>`);
        appendTerminalLine(`<pre class="terminal-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`);
        return;
      }
      if (data.clear) {
        terminalOutput.innerHTML = `<div class="terminal-muted">logX console ready. Commands run from the extracted vm-support root.</div>`;
        return;
      }
      appendTerminalLine(`<pre>${escapeHtml(data.output || "(no output)")}</pre>`);
    } catch (err) {
      appendTerminalLine(`<span class="terminal-error">Request failed: ${escapeHtml(err.message)}</span>`);
    }
  });
}

async function loadState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();

    if (!data.ok) return;

    vmInventory = data.vms || [];
    latestAnalysis = data.analysis || {};
        renderAll(data);
    renderRecent(data.recent_uploads || []);

    if (!data.has_data) {
      showLanding();
    } else {
      showPage("dashboard");
    }
  } catch (err) {
    showLanding();
  }
}

function renderAll(data = {}) {
  renderSystemInfo(latestAnalysis);
  renderInventory(vmInventory);
  renderDashboardSummary(vmInventory);
  renderDashboardVmPreview(vmInventory);
  renderVmStats(vmInventory);
  renderAllocationCharts(vmInventory);
  renderTopMemoryChart(vmInventory);
  renderDatastoreChart(vmInventory);
  renderDiskNicChart(vmInventory);
  renderAnalysis(latestAnalysis);
  renderPathMapping(latestPathMapping);
}

function renderSystemInfo(analysis) {
  const host = analysis?.summary?.host || {};
  inventoryBadge.textContent = `Total: ${vmInventory.length} VMs`;
  hostName.textContent = host.hostname || "unknown-host";
  hostVersion.textContent = host.version || "unknown-version";
  bundleType.textContent = host.bundle_type || "Unknown";
  sourceFile.textContent = host.source_file || "-";
  document.querySelectorAll(".currentSourceFile").forEach(el => {
    el.textContent = host.source_file || "-";
  });
  updateSourceSwitchers();
}

function renderDashboardVmPreview(vms) {
  const rows = vms.slice(0, 8);
  if (!rows.length) {
    dashboardVmBody.innerHTML = `<tr><td colspan="5" class="empty">No inventory loaded.</td></tr>`;
    return;
  }

  dashboardVmBody.innerHTML = rows.map((vm, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(vm.host || "-")}</td>
      <td>${escapeHtml(vm.name || "-")}</td>
      <td>${escapeHtml(vm.guest_os || "-")}</td>
      <td>${escapeHtml(vm.datastore || "-")}</td>
    </tr>
  `).join("");
}




function parseNumberValue(value) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).replace(/,/g, "").trim();
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseCountValue(value) {
  return parseNumberValue(value);
}

function formatMemoryGb(memoryMb) {
  const gb = Number(memoryMb || 0) / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  if (gb >= 100) return `${Math.round(gb)} GB`;
  if (gb >= 10) return `${gb.toFixed(1)} GB`;
  return `${gb.toFixed(2)} GB`;
}

function getVmVcpu(vm) {
  return parseNumberValue(vm.vcpu ?? vm.cpu ?? vm.vcpus ?? 0);
}

function getVmMemoryMb(vm) {
  return parseNumberValue(vm.memory_mb ?? vm.memory ?? vm.mem_mb ?? vm.mem ?? 0);
}

function getVmDiskCount(vm) {
  return parseCountValue(vm.disk_count ?? vm.disks_count ?? vm.disk ?? vm.disks ?? 0);
}

function getVmNicCount(vm) {
  return parseCountValue(vm.nic_count ?? vm.network_count ?? vm.network ?? vm.nics ?? 0);
}

function emptyChart(message = "No Data Available") {
  return `<div class="no-data-card"><i class="bi bi-bar-chart"></i><span>${escapeHtml(message)}</span></div>`;
}

function renderDashboardSummary(vms) {
  const rows = vms || [];
  const totalVms = rows.length;
  const totalVcpu = rows.reduce((sum, vm) => sum + getVmVcpu(vm), 0);
  const totalMemMb = rows.reduce((sum, vm) => sum + getVmMemoryMb(vm), 0);
  const totalDisks = rows.reduce((sum, vm) => sum + getVmDiskCount(vm), 0);
  const totalNics = rows.reduce((sum, vm) => sum + getVmNicCount(vm), 0);

  if (summaryTotalVms) summaryTotalVms.textContent = totalVms.toLocaleString();
  if (summaryTotalVcpu) summaryTotalVcpu.textContent = totalVcpu.toLocaleString();
  if (summaryTotalMemory) summaryTotalMemory.textContent = formatMemoryGb(totalMemMb);
  if (summaryTotalDisks) summaryTotalDisks.textContent = totalDisks.toLocaleString();
  if (summaryTotalNics) summaryTotalNics.textContent = totalNics.toLocaleString();

  if (dashboardNoVmNote) dashboardNoVmNote.classList.toggle("hidden", totalVms > 0);
  const dashboardPage = document.getElementById("dashboardPage");
  if (dashboardPage) dashboardPage.classList.toggle("no-vm-data", totalVms === 0);
}


function guestOsFamily(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return "Unknown";

  const lower = raw.toLowerCase();

  if (lower.includes("windows")) return "Windows";
  if (
    lower.includes("red hat") ||
    lower.includes("rhel") ||
    lower.includes("rhel-") ||
    lower.includes("rhel_") ||
    lower.includes("rhel ")
  ) return "Red Hat / RHEL";
  if (lower.includes("ubuntu")) return "Ubuntu";
  if (lower.includes("centos")) return "CentOS";
  if (lower.includes("debian")) return "Debian";
  if (lower.includes("suse") || lower.includes("sles")) return "SUSE";
  if (lower.includes("photon")) return "Photon OS";
  if (lower.includes("linux")) return "Linux";
  if (lower.includes("freebsd")) return "FreeBSD";
  if (lower.includes("other")) return "Other";

  return raw.length > 22 ? raw.slice(0, 19) + "..." : raw;
}

function guestOsVersion(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return "Unknown version";

  const lower = raw.toLowerCase();

  const win = lower.match(/windows(?:\s+server)?\s*([0-9]{4}|[0-9]{2}|xp|vista|7|8|10|11)?/i);
  if (win && win[1]) return `Windows ${win[1].toUpperCase()}`;

  const rhel = lower.match(/(?:rhel|red hat).*?([0-9]+(?:\.[0-9]+)?)/i);
  if (rhel && rhel[1]) return `RHEL ${rhel[1]}`;

  const ubuntu = lower.match(/ubuntu.*?([0-9]{2}\.[0-9]{2}|[0-9]+(?:\.[0-9]+)?)/i);
  if (ubuntu && ubuntu[1]) return `Ubuntu ${ubuntu[1]}`;

  const centos = lower.match(/centos.*?([0-9]+(?:\.[0-9]+)?)/i);
  if (centos && centos[1]) return `CentOS ${centos[1]}`;

  const debian = lower.match(/debian.*?([0-9]+(?:\.[0-9]+)?)/i);
  if (debian && debian[1]) return `Debian ${debian[1]}`;

  return raw.length > 28 ? raw.slice(0, 25) + "..." : raw;
}

function guestOsColorClass(family) {
  const lower = String(family || "").toLowerCase();
  if (lower.includes("red hat") || lower.includes("rhel")) return "rhel";
  if (lower.includes("windows")) return "windows";
  if (lower.includes("ubuntu")) return "ubuntu";
  if (lower.includes("centos")) return "centos";
  if (lower.includes("debian")) return "debian";
  if (lower.includes("suse")) return "suse";
  if (lower.includes("linux")) return "linux";
  return "other";
}




function vmVersionTooltipHtml(family, versions, total) {
  const rows = versions.map(([ver, val], idx) => {
    const pct = Math.round((val / total) * 100);
    return `
      <div class="vm-tooltip-row">
        <span class="vm-tooltip-dot" style="--dot-alpha:${Math.max(.40, 1 - (idx * .10))}"></span>
        <span>${escapeHtml(ver)}</span>
        <strong>${val} · ${pct}%</strong>
      </div>
    `;
  }).join("");

  return `
    <div class="vm-chart-tooltip">
      <div class="vm-tooltip-title">${escapeHtml(family)}</div>
      <div class="vm-tooltip-subtitle">${total} VM${total === 1 ? "" : "s"} in this guest OS family</div>
      <div class="vm-tooltip-list">${rows}</div>
    </div>
  `;
}

function renderVmStats(vms) {
  if (!vmStatsChart) return;

  const familyCounts = {};
  const versionCounts = {};

  (vms || []).forEach(vm => {
    const guest = vm.guest_os || vm.guest || vm.os || "";
    const family = guestOsFamily(guest);
    const version = guestOsVersion(guest);
    familyCounts[family] = (familyCounts[family] || 0) + 1;
    versionCounts[family] = versionCounts[family] || {};
    versionCounts[family][version] = (versionCounts[family][version] || 0) + 1;
  });

  const entries = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, item) => sum + item[1], 0);

  if (vmStatsBadge) vmStatsBadge.textContent = total ? `Total: ${total}` : "No data";

  if (!entries.length) {
    vmStatsChart.innerHTML = `<div class="no-data-card">No Data Available</div>`;
    return;
  }

  const max = Math.max(...entries.map(item => item[1]));

  vmStatsChart.innerHTML = `
    <div class="vm-stack-dashboard" role="img" aria-label="Stacked VM Guest OS chart">
      <div class="vm-stack-summary">
        <div>
          <span class="vm-stack-kicker">Guest OS Distribution</span>
          <strong>${total}</strong>
          <em>Total VMs</em>
        </div>
        <div class="vm-stack-mini-legend">
          <span><i class="legend-dot rhel"></i>RHEL</span>
          <span><i class="legend-dot windows"></i>Windows</span>
          <span><i class="legend-dot linux"></i>Linux</span>
          <span><i class="legend-dot other"></i>Other</span>
        </div>
      </div>

      <div class="vm-stack-list">
        ${entries.map(([family, count], index) => {
          const pctOfTotal = Math.round((count / total) * 100);
          const widthPct = Math.max(8, Math.round((count / max) * 100));
          const cls = guestOsColorClass(family);
          const versions = Object.entries(versionCounts[family] || {}).sort((a, b) => b[1] - a[1]);
          const tooltip = vmVersionTooltipHtml(family, versions, count);

          return `
            <div class="vm-stack-row" style="--w:${widthPct}%; --delay:${index * 70}ms">
              <div class="vm-stack-meta">
                <div class="vm-stack-name">
                  <i class="vm-stack-dot ${escapeHtml(cls)}"></i>
                  <span title="${escapeHtml(family)}">${escapeHtml(family)}</span>
                </div>
                <div class="vm-stack-count">${count} VM${count === 1 ? "" : "s"} <small>${pctOfTotal}%</small></div>
              </div>

              <div class="vm-stack-track">
                <div class="vm-stack-fill ${escapeHtml(cls)}" tabindex="0" aria-label="${escapeHtml(family)} ${count} VMs">
                  ${versions.map(([ver, val], segIndex) => {
                    const segPct = Math.max(4, Math.round((val / count) * 100));
                    return `
                      <span
                        class="vm-stack-segment"
                        style="width:${segPct}%; --seg:${segIndex};"
                        title="${escapeHtml(ver)}: ${val}">
                      </span>
                    `;
                  }).join("")}
                  ${tooltip}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}



function familyColorClass(family) {
  return guestOsColorClass(family);
}

function groupResourceByFamily(vms, getValue) {
  const grouped = {};
  (vms || []).forEach(vm => {
    const family = guestOsFamily(vm.guest_os || vm.guest || vm.os || "");
    const value = getValue(vm);
    if (!value) return;
    grouped[family] = (grouped[family] || 0) + value;
  });
  return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(angleRad)),
    y: cy + (r * Math.sin(angleRad))
  };
}

function pieSlicePath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", cx, cy,
    "L", start.x.toFixed(3), start.y.toFixed(3),
    "A", r, r, 0, largeArcFlag, 0, end.x.toFixed(3), end.y.toFixed(3),
    "Z"
  ].join(" ");
}

function renderRingChart(container, badge, entries, unitLabel, centerFormatter) {
  if (!container) return;
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  if (badge) badge.textContent = total ? centerFormatter(total) : "No data";

  if (!entries.length || !total) {
    container.innerHTML = emptyChart("No VMs data are available");
    return;
  }

  const palette = {
    rhel: "#ee0000",
    windows: "#0078d4",
    ubuntu: "#e95420",
    centos: "#4b5563",
    linux: "#4b5563",
    debian: "#a80030",
    suse: "#30ba78",
    other: "#94a3b8",
    unknown: "#94a3b8",
    freebsd: "#94a3b8"
  };

  let cursor = 0;
  const segments = entries
    .map(([family, value], idx) => {
      const cls = familyColorClass(family);
      const color = palette[cls] || palette.other;
      const pct = total ? Math.round((value / total) * 100) : 0;
      const span = (value / total) * 360;
      const start = cursor;
      const end = cursor + span;
      cursor = end;
      return {
        family,
        value,
        cls,
        color,
        pct,
        idx,
        start,
        end,
        path: pieSlicePath(90, 90, 72, start, end)
      };
    })
    .sort((a, b) => b.value - a.value);

  const largest = segments[0];

  container.innerHTML = `
    <div class="jq-pie-modern">
      <div class="jq-pie-total">
        <span>${escapeHtml(unitLabel)}</span>
        <strong>${escapeHtml(centerFormatter(total))}</strong>
      </div>

      <div class="jq-pie-stage">
        <svg class="jq-pie-svg" viewBox="0 0 180 180" aria-label="${escapeHtml(unitLabel)} allocation pie chart">
          <defs>
            <filter id="pieSoftShadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.08"></feDropShadow>
            </filter>
          </defs>
          <circle class="jq-pie-bg" cx="90" cy="90" r="73"></circle>
          ${segments.map(seg => `
            <path
              class="jq-pie-slice ${escapeHtml(seg.cls)}"
              d="${seg.path}"
              fill="${seg.color}"
              data-family="${escapeHtml(seg.family)}"
              data-value="${escapeHtml(centerFormatter(seg.value))}"
              data-pct="${seg.pct}"
              style="--delay:${seg.idx * 70}ms; --slice-color:${seg.color};">
            </path>
          `).join("")}
          <circle class="jq-pie-inner-ring" cx="90" cy="90" r="33"></circle>
        </svg>

        <div class="jq-pie-center">
          <strong>${largest ? largest.pct : 0}%</strong>
          <span>${largest ? escapeHtml(largest.family) : escapeHtml(unitLabel)}</span>
        </div>

        <div class="jq-pie-tooltip hidden"></div>
      </div>

      <div class="jq-pie-legend">
        ${segments.map(seg => `
          <div class="jq-pie-legend-item" style="--color:${seg.color}" data-family="${escapeHtml(seg.family)}" data-value="${escapeHtml(centerFormatter(seg.value))}" data-pct="${seg.pct}">
            <i></i>
            <span title="${escapeHtml(seg.family)}">${escapeHtml(seg.family)}</span>
            <strong>${escapeHtml(centerFormatter(seg.value))}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const tooltip = container.querySelector(".jq-pie-tooltip");
  const centerPct = container.querySelector(".jq-pie-center strong");
  const centerLabel = container.querySelector(".jq-pie-center span");
  const slices = container.querySelectorAll(".jq-pie-slice");
  const legendItems = container.querySelectorAll(".jq-pie-legend-item");

  function showPieTooltip(target, event) {
    if (!tooltip) return;
    const family = target.dataset.family || "";
    const value = target.dataset.value || "";
    const pct = target.dataset.pct || "0";
    tooltip.innerHTML = `<b>${pct}%</b><span>${escapeHtml(family)}</span><em>${escapeHtml(value)}</em>`;
    tooltip.classList.remove("hidden");

    const stage = container.querySelector(".jq-pie-stage");
    const rect = stage.getBoundingClientRect();

    // Tooltip now follows the cursor position on the chart slice itself.
    // No separate dot / hotspot button is used.
    const x = event ? event.clientX - rect.left : rect.width / 2;
    const y = event ? event.clientY - rect.top : rect.height / 2;
    tooltip.style.left = `${Math.min(Math.max(x, 78), rect.width - 78)}px`;
    tooltip.style.top = `${Math.min(Math.max(y - 30, 24), rect.height - 28)}px`;

    if (centerPct) centerPct.textContent = `${pct}%`;
    if (centerLabel) centerLabel.textContent = family;
  }

  function hidePieTooltip() {
    if (tooltip) tooltip.classList.add("hidden");
    if (centerPct && largest) centerPct.textContent = `${largest.pct}%`;
    if (centerLabel && largest) centerLabel.textContent = largest.family;
  }

  slices.forEach(slice => {
    slice.addEventListener("mousemove", event => showPieTooltip(slice, event));
    slice.addEventListener("mouseenter", event => showPieTooltip(slice, event));
    slice.addEventListener("mouseleave", hidePieTooltip);
    slice.addEventListener("focus", event => showPieTooltip(slice, event));
    slice.addEventListener("blur", hidePieTooltip);
  });

  legendItems.forEach(item => {
    item.addEventListener("mouseenter", () => showPieTooltip(item, null));
    item.addEventListener("mousemove", () => showPieTooltip(item, null));
    item.addEventListener("mouseleave", hidePieTooltip);
  });
}

function renderAllocationCharts(vms) {
  const vcpuEntries = groupResourceByFamily(vms, getVmVcpu);
  const memEntries = groupResourceByFamily(vms, getVmMemoryMb);

  renderRingChart(vcpuAllocationChart, vcpuAllocBadge, vcpuEntries, "Total vCPU", value => `${Math.round(value).toLocaleString()}`);
  renderRingChart(memoryAllocationChart, memoryAllocBadge, memEntries, "Total Memory", value => formatMemoryGb(value));
}

function renderTopMemoryChart(vms) {
  if (!topMemoryChart) return;
  const rows = (vms || [])
    .map(vm => ({ name: vm.name || vm.vm_name || "-", memMb: getVmMemoryMb(vm), guest: vm.guest_os || "-" }))
    .filter(vm => vm.memMb > 0)
    .sort((a, b) => b.memMb - a.memMb)
    .slice(0, 5);

  if (topMemoryBadge) topMemoryBadge.textContent = rows.length ? `Top ${rows.length}` : "No data";

  if (!rows.length) {
    topMemoryChart.innerHTML = emptyChart("No memory data available");
    return;
  }

  const max = Math.max(...rows.map(row => row.memMb));

  topMemoryChart.innerHTML = `
    <div class="top-memory-list">
      ${rows.map((row, index) => {
        const pct = Math.max(8, Math.round((row.memMb / max) * 100));
        return `
          <div class="top-memory-row" style="--w:${pct}%; --delay:${index * 55}ms" title="${escapeHtml(row.name)} · ${escapeHtml(row.guest)}">
            <div class="top-memory-meta">
              <span>${escapeHtml(row.name)}</span>
              <strong>${escapeHtml(formatMemoryGb(row.memMb))}</strong>
            </div>
            <div class="top-memory-track">
              <div class="top-memory-fill" tabindex="0" aria-label="${escapeHtml(row.name)} ${escapeHtml(formatMemoryGb(row.memMb))}">
                <div class="modern-tooltip top-memory-tooltip">
                  <b>${escapeHtml(row.name)}</b>
                  <span>${escapeHtml(formatMemoryGb(row.memMb))} · ${escapeHtml(row.guest || "-")}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}



function shortLabel(value, maxLen = 22) {
  const raw = String(value || "-");
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, Math.max(8, Math.floor(maxLen / 2))) + "..." + raw.slice(-Math.max(6, Math.floor(maxLen / 3)));
}

function renderCompactBarChart(container, badge, entries, options = {}) {
  if (!container) return;
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  if (badge) badge.textContent = total ? `Total: ${total}` : "No data";

  if (!entries.length || !total) {
    container.innerHTML = emptyChart(options.emptyText || "No data available");
    return;
  }

  const max = Math.max(...entries.map(item => item[1]));
  container.innerHTML = `
    <div class="compact-chart-list">
      ${entries.map(([label, value], index) => {
        const pct = Math.max(7, Math.round((value / max) * 100));
        const share = Math.round((value / total) * 100);
        return `
          <div class="compact-chart-row" style="--w:${pct}%; --delay:${index * 55}ms" title="${escapeHtml(label)} · ${value} (${share}%)">
            <div class="compact-chart-meta">
              <span>${escapeHtml(shortLabel(label, options.labelLength || 24))}</span>
              <strong>${value}<em>${share}%</em></strong>
            </div>
            <div class="compact-chart-track">
              <div class="compact-chart-fill ${escapeHtml(options.colorClass || "blue")}">
                <div class="modern-tooltip">
                  <b>${escapeHtml(label)}</b>
                  <span>${value} ${escapeHtml(options.unit || "VMs")} · ${share}%</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDatastoreChart(vms) {
  const counts = {};
  (vms || []).forEach(vm => {
    const ds = String(vm.datastore || vm.datastore_name || "Unknown").trim() || "Unknown";
    counts[ds] = (counts[ds] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  renderCompactBarChart(datastoreChart, datastoreBadge, entries, {
    unit: "VMs",
    colorClass: "green",
    labelLength: 26,
    emptyText: "No datastore data available"
  });
}

function renderMiniDistribution(container, title, entries, colorClass) {
  const total = entries.reduce((sum, item) => sum + item[1], 0);
  if (!entries.length || !total) {
    return `<div class="mini-dist-empty">No ${escapeHtml(title)} data</div>`;
  }

  const max = Math.max(...entries.map(item => item[1]));
  return `
    <div class="mini-dist-block">
      <h4>${escapeHtml(title)}</h4>
      ${entries.map(([label, value], index) => {
        const pct = Math.max(8, Math.round((value / max) * 100));
        const share = Math.round((value / total) * 100);
        return `
          <div class="mini-dist-row" style="--w:${pct}%; --delay:${index * 50}ms" title="${escapeHtml(label)} · ${value} (${share}%)">
            <span>${escapeHtml(label)}</span>
            <div class="mini-dist-track">
              <div class="mini-dist-fill ${escapeHtml(colorClass)}">
                <div class="modern-tooltip small">
                  <b>${escapeHtml(label)}</b>
                  <span>${value} VMs · ${share}%</span>
                </div>
              </div>
            </div>
            <strong>${value}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDiskNicChart(vms) {
  if (!diskNicChart) return;

  const diskCounts = {};
  const nicCounts = {};
  (vms || []).forEach(vm => {
    const disk = getVmDiskCount(vm);
    const nic = getVmNicCount(vm);
    const diskLabel = disk >= 5 ? "5+ disks" : `${disk || 0} disk${disk === 1 ? "" : "s"}`;
    const nicLabel = nic >= 3 ? "3+ NICs" : `${nic || 0} NIC${nic === 1 ? "" : "s"}`;
    diskCounts[diskLabel] = (diskCounts[diskLabel] || 0) + 1;
    nicCounts[nicLabel] = (nicCounts[nicLabel] || 0) + 1;
  });

  const diskEntries = Object.entries(diskCounts).sort((a, b) => parseNumberValue(a[0]) - parseNumberValue(b[0]));
  const nicEntries = Object.entries(nicCounts).sort((a, b) => parseNumberValue(a[0]) - parseNumberValue(b[0]));
  const total = (vms || []).length;
  if (diskNicBadge) diskNicBadge.textContent = total ? `Total: ${total}` : "No data";

  if (!total) {
    diskNicChart.innerHTML = emptyChart("No disk/NIC data available");
    return;
  }

  diskNicChart.innerHTML = `
    <div class="disk-nic-grid">
      ${renderMiniDistribution(diskNicChart, "By Disk Count", diskEntries, "purple")}
      ${renderMiniDistribution(diskNicChart, "By NIC Count", nicEntries, "cyan")}
    </div>
  `;
}

function renderInventory(rows) {
  if (vmSearchTotal) vmSearchTotal.textContent = `Total: ${rows.length} entries`;
  if (!rows.length) {
    vmTableBody.innerHTML = `<tr><td colspan="11" class="empty">No matching VM inventory.</td></tr>`;
    return;
  }

  if (vmSearchTotal) vmSearchTotal.textContent = `Total: ${rows.length} entries`;

  vmTableBody.innerHTML = rows.map((vm, index) => `
    <tr class="vm-main-row" data-row-index="${index}">
      <td class="expand-cell"><span class="expand-arrow"><i class="bi bi-chevron-down"></i></span></td>
      <td>${index + 1}</td>
      <td>${escapeHtml(vm.name || "-")}</td>
      <td>${escapeHtml(vm.host || "-")}</td>
      <td>${escapeHtml(vm.datastore || "-")}</td>
      <td>${escapeHtml(vm.guest_os || "-")}</td>
      <td>${escapeHtml(vm.vcpu ?? "-")}</td>
      <td>${escapeHtml(vm.memory_mb ?? "-")}</td>
      <td title="${escapeHtml(vm.disk_summary || "-")}">${escapeHtml(formatDisk(vm))}</td>
      <td title="${escapeHtml(vm.network_summary || "-")}">${escapeHtml(formatNetwork(vm))}</td>
      <td>${escapeHtml(vm.source || "-")}</td>
    </tr>
    <tr class="vm-detail-row hidden" data-detail-index="${index}">
      <td colspan="11">${renderVmDetails(vm)}</td>
    </tr>
  `).join("");

  document.querySelectorAll(".vm-main-row").forEach(row => {
    row.addEventListener("click", () => {
      const idx = row.dataset.rowIndex;
      const detail = document.querySelector(`[data-detail-index="${idx}"]`);
      const arrow = row.querySelector(".expand-arrow i");
      detail.classList.toggle("hidden");
      row.classList.toggle("expanded", !detail.classList.contains("hidden"));
      arrow.className = detail.classList.contains("hidden") ? "bi bi-chevron-down" : "bi bi-chevron-up";
    });
  });
}

function renderVmStatus(vm) {
  const status = (vm.vm_status || vm.power_state || "").toLowerCase();
  if (!status) return "-";
  let label = status, cls = "status-unknown";
  if (["running", "powered on", "on"].includes(status)) { label = "Running"; cls = "status-running"; }
  else if (["stopped", "powered off", "off"].includes(status)) { label = "Stopped"; cls = "status-stopped"; }
  else if (status.includes("suspend")) { label = "Suspended"; cls = "status-suspended"; }
  return `<span class="vm-status-pill ${cls}">${escapeHtml(label)}</span>`;
}

function renderVmDetails(vm) {
  const diskItems = Array.isArray(vm.disk_list) && vm.disk_list.length
    ? vm.disk_list
    : (vm.disk_summary ? String(vm.disk_summary).split(",").map(x => x.trim()).filter(Boolean) : []);
  const disks = diskItems.length
    ? diskItems.map(d => `<li>${escapeHtml(d)}</li>`).join("")
    : `<li>-</li>`;
  const nicItems = Array.isArray(vm.network_list) && vm.network_list.length
    ? vm.network_list
    : (vm.network_summary ? String(vm.network_summary).split(",").map(x => x.trim()).filter(Boolean) : []);
  const nics = nicItems.length
    ? nicItems.map(n => `<li>${escapeHtml(n)}</li>`).join("")
    : `<li>-</li>`;

  return `
    <div class="vm-detail-grid">
      <div>
        <h4>Identity</h4>
        <div class="detail-kv"><span>Display Name</span><code>${escapeHtml(vm.name || "-")}</code></div>\n        <div class="detail-kv"><span>UUID</span><code>${escapeHtml(vm.uuid || "-")}</code></div>
        <div class="detail-kv"><span>World ID</span><code>${escapeHtml(vm.world_id || "-")}</code></div>
        <div class="detail-kv"><span>Process ID</span><code>${escapeHtml(vm.process_id || "-")}</code></div>
        <div class="detail-kv"><span>VMX Cartel ID</span><code>${escapeHtml(vm.cartel_id || "-")}</code></div>
        <div class="detail-kv"><span>Config File</span><code>${escapeHtml(vm.vmx_path || "-")}</code></div>
      </div>
      <div><h4>Disks (${escapeHtml(vm.disk_count ?? "-")})</h4><ul class="detail-list">${disks}</ul></div>
      <div><h4>NICs (${escapeHtml(vm.network_count ?? "-")})</h4><ul class="detail-list">${nics}</ul></div>
    </div>`;
}

function formatDisk(vm) {
  if (vm.disk_count === null || vm.disk_count === undefined) return "-";
  const count = Number(vm.disk_count || 0);
  if (!count) return "0";
  return `${count} disk${count > 1 ? "s" : ""}`;
}

function formatNetwork(vm) {
  if (vm.network_count === null || vm.network_count === undefined) return "-";
  const count = Number(vm.network_count || 0);
  if (!count) return "0";
  return `${count} NIC${count > 1 ? "s" : ""}`;
}

function renderAnalysis(analysis) {
  const findings = analysis?.findings || [];

  if (!findings.length) {
    findingBadge.textContent = "No analysis";
    if (insightsFindingBadge) insightsFindingBadge.textContent = "No analysis";
    findingsContainer.innerHTML = `<div class="empty-card">Upload a bundle to generate troubleshooting insights.</div>`;
    if (insightsContainer) insightsContainer.innerHTML = `<div class="empty-card">Upload a bundle to generate troubleshooting insights.</div>`;
    return;
  }

  const high = findings.filter(f => f.severity === "high").length;
  const medium = findings.filter(f => f.severity === "medium").length;
  const low = findings.filter(f => f.severity === "low").length;
  const totalMatches = findings.reduce((sum, f) => sum + Number(f.matches || 0), 0);

  const badgeText = totalMatches > 0
    ? `${totalMatches} matches · ${high} high / ${medium} medium / ${low} low`
    : "0 matches";

  findingBadge.textContent = badgeText;
  if (insightsFindingBadge) insightsFindingBadge.textContent = badgeText;

  const tableHtml = totalMatches > 0
    ? renderFindingsTable(findings)
    : `
      <div class="empty-card insight-note">
        No issue indicators matched the current rule set in this bundle.
        This usually means the bundle does not contain the searched error patterns, not that parsing failed.
      </div>
      ${renderFindingsTable(findings)}
    `;

  findingsContainer.innerHTML = tableHtml;
  if (insightsContainer) insightsContainer.innerHTML = tableHtml;

  bindFindingRows(findingsContainer);
  if (insightsContainer) bindFindingRows(insightsContainer);
}

function renderFindingsTable(findings) {
  return `
    <div class="findings-table-wrap">
      <table class="findings-table">
        <thead>
          <tr>
            <th></th>
            <th>Finding</th>
            <th>Severity</th>
            <th>Matches</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          ${findings.map((f, idx) => `
            <tr class="finding-main-row" data-finding-index="${idx}">
              <td class="finding-expand-cell"><span class="finding-arrow"><i class="bi bi-chevron-down"></i></span></td>
              <td>${escapeHtml(f.title || "Finding")}</td>
              <td><span class="severity-pill severity-${escapeHtml(f.severity || "none")}">${escapeHtml(f.severity || "none")}</span></td>
              <td>${escapeHtml(f.matches ?? 0)}</td>
              <td>${escapeHtml(f.description || "")}</td>
            </tr>
            <tr class="finding-detail-row hidden" data-finding-detail-index="${idx}">
              <td colspan="5">${renderFindingDetails(f)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFindingDetails(f) {
  const topFiles = (f.top_files || []).slice(0, 6).map(t => `
    <li><code>${escapeHtml(shortPath(t.file || ""))}</code><span>${escapeHtml(t.matches || 0)} matches</span></li>
  `).join("");

  const samples = (f.samples || []).slice(0, 6).map(s => `
    <li><code>${escapeHtml(shortPath(s.file || ""))}:${escapeHtml(s.line || "")}</code><span>${escapeHtml(s.text || "")}</span></li>
  `).join("");

  return `
    <div class="finding-detail-grid">
      <div>
        <h4>Top Files</h4>
        <ul>${topFiles || "<li><span>No file samples.</span></li>"}</ul>
      </div>
      <div>
        <h4>Sample Lines</h4>
        <ul>${samples || "<li><span>No matching sample found.</span></li>"}</ul>
      </div>
    </div>
  `;
}

function bindFindingRows(container) {
  container.querySelectorAll(".finding-main-row").forEach(row => {
    row.addEventListener("click", () => {
      const idx = row.dataset.findingIndex;
      const detail = container.querySelector(`[data-finding-detail-index="${idx}"]`);
      const arrow = row.querySelector(".finding-arrow i");
      detail.classList.toggle("hidden");
      row.classList.toggle("expanded", !detail.classList.contains("hidden"));
      arrow.className = detail.classList.contains("hidden") ? "bi bi-chevron-down" : "bi bi-chevron-up";
    });
  });
}


let switchLoadingTimer = null;
let switchLoadingProgress = 0;

function setSwitchLoading(active, text = "Switching bundle...", progress = 0) {
  let overlay = document.getElementById("switchLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "switchLoadingOverlay";
    overlay.className = "switch-loading-overlay hidden";
    overlay.innerHTML = `
      <div class="switch-loading-card">
        <div class="switch-loading-head">
          <div class="switch-spinner"></div>
          <div>
            <span class="switch-loading-text">Switching bundle...</span>
            <small class="switch-loading-subtext">Preparing parser...</small>
          </div>
          <strong class="switch-loading-percent">0%</strong>
        </div>
        <div class="switch-progress-track">
          <div class="switch-progress-fill"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const label = overlay.querySelector(".switch-loading-text");
  const subtext = overlay.querySelector(".switch-loading-subtext");
  const percentLabel = overlay.querySelector(".switch-loading-percent");
  const fill = overlay.querySelector(".switch-progress-fill");

  if (label) label.textContent = text;

  if (active) {
    switchLoadingProgress = Math.max(progress || 0, switchLoadingProgress || 0);
    if (percentLabel) percentLabel.textContent = `${Math.round(switchLoadingProgress)}%`;
    if (fill) fill.style.width = `${Math.min(100, Math.round(switchLoadingProgress))}%`;
    if (subtext) subtext.textContent = "Opening archive and parsing bundle data...";
  }

  overlay.classList.toggle("hidden", !active);
  document.body.classList.toggle("is-switching-bundle", !!active);

  if (!active) {
    if (switchLoadingTimer) clearInterval(switchLoadingTimer);
    switchLoadingTimer = null;
    switchLoadingProgress = 0;
    if (fill) fill.style.width = "0%";
    if (percentLabel) percentLabel.textContent = "0%";
  }
}

function startSwitchProgress(text = "Opening selected bundle...") {
  setSwitchLoading(true, text, 4);

  if (switchLoadingTimer) clearInterval(switchLoadingTimer);
  switchLoadingTimer = setInterval(() => {
    // Simulated progress while the backend processes a synchronous open request.
    // It slows near 92% and completes when the request returns.
    const step = switchLoadingProgress < 45 ? 6 : (switchLoadingProgress < 75 ? 3 : 1);
    switchLoadingProgress = Math.min(92, switchLoadingProgress + step);
    setSwitchLoading(true, text, switchLoadingProgress);
  }, 450);
}

function finishSwitchProgress(text = "Bundle loaded") {
  if (switchLoadingTimer) clearInterval(switchLoadingTimer);
  switchLoadingTimer = null;
  switchLoadingProgress = 100;
  setSwitchLoading(true, text, 100);
}


async function openRecentUpload(filename) {
  try {
    startSwitchProgress("Opening selected bundle...");
    document.body.classList.add("is-loading-upload");

    const res = await fetch("/api/open_upload", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ filename })
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(`Server returned non-JSON response. Check /api/open_upload route. Response starts with: ${text.slice(0, 80)}`);
    }

    const data = await res.json();

    if (!data.ok) {
      alert(data.error || "Unable to open upload.");
      return;
    }

    vmInventory = data.vms || [];
    latestAnalysis = data.analysis || {};
    finishSwitchProgress("Bundle loaded");
    renderAll(data);
    renderRecent(data.recent_uploads || []);
    showPage("dashboard");
  } catch (err) {
    alert(`Unable to open upload: ${err.message}`);
  } finally {
    document.body.classList.remove("is-loading-upload");
    window.setTimeout(() => setSwitchLoading(false), 280);
  }
}


function confirmDeleteUpload(filename) {
  return new Promise(resolve => {
    if (!deleteConfirmModal || !deleteConfirmBtn || !deleteCancelBtn) {
      resolve(window.confirm(`Delete uploaded file?\n\n${filename}\n\nThis will remove the file from the system.`));
      return;
    }

    deleteConfirmFile.textContent = filename || "-";
    deleteConfirmModal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    const cleanup = result => {
      deleteConfirmModal.classList.add("hidden");
      document.body.classList.remove("modal-open");
      deleteConfirmBtn.removeEventListener("click", onConfirm);
      deleteCancelBtn.removeEventListener("click", onCancel);
      deleteConfirmModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = event => {
      if (event.target === deleteConfirmModal || event.target.classList.contains("confirm-modal-backdrop")) cleanup(false);
    };
    const onKey = event => {
      if (event.key === "Escape") cleanup(false);
    };

    deleteConfirmBtn.addEventListener("click", onConfirm);
    deleteCancelBtn.addEventListener("click", onCancel);
    deleteConfirmModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);

    setTimeout(() => deleteCancelBtn.focus(), 30);
  });
}

function renderRecent(items) {
  recentUploadItems = items || [];
  updateSourceSwitchers();
  if (!items.length) {
    if (recentUploads) recentUploads.innerHTML = `<div class="muted-mini">No recent uploads.</div>`;
    if (recentUploadsPage) recentUploadsPage.innerHTML = `<tr><td colspan="3" class="empty">No recent uploads.</td></tr>`;
    return;
  }

  const currentSource = latestAnalysis?.summary?.host?.source_file || "";

  if (recentUploads) {
  if (recentUploads) {
    recentUploads.innerHTML = items.slice(0, 5).map(item => `
      <div class="recent-item ${item.filename === currentSource ? "selected" : ""}">
        <button class="recent-name open-recent-sidebar" data-filename="${escapeHtml(item.filename)}" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</button>
        <button class="delete-upload" data-filename="${escapeHtml(item.filename)}" title="Delete">×</button>
      </div>
    `).join("");
  }
  }

  if (recentUploadsPage) {
    recentUploadsPage.innerHTML = items.slice(0, 5).map(item => `
      <tr class="recent-page-row ${item.filename === currentSource ? "selected" : ""}" data-filename="${escapeHtml(item.filename)}">
        <td>
          <div class="recent-file-main">
            <i class="bi bi-file-earmark-zip"></i>
            <span>${escapeHtml(item.filename)}</span>
          </div>
        </td>
        <td>${formatBytes(item.size_bytes || 0)}</td>
        <td class="recent-delete-col">
          <button class="delete-upload delete-page-btn" data-filename="${escapeHtml(item.filename)}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join("");
  }

  document.querySelectorAll(".delete-upload").forEach(btn => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const filename = btn.dataset.filename;
      const confirmed = await confirmDeleteUpload(filename);
      if (!confirmed) return;
      const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        renderRecent(data.recent_uploads || []);
        if (data.active_cleared || !(data.recent_uploads || []).length) {
          vmInventory = [];
          latestAnalysis = {};
          latestPathMapping = {nodes: [], edges: [], summary: {}, tables: {}};
          renderInventory([]);
          showLanding();
        }
      }
    });
  });

  document.querySelectorAll(".open-recent-sidebar").forEach(btn => {
    btn.addEventListener("click", async () => {
      await openRecentUpload(btn.dataset.filename);
    });
  });

  document.querySelectorAll(".recent-page-row").forEach(row => {
    row.addEventListener("click", async () => {
      await openRecentUpload(row.dataset.filename);
    });
  });
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

searchBox.addEventListener("input", () => {
  const q = searchBox.value.trim().toLowerCase();

  if (!q) {
    renderInventory(vmInventory);
    return;
  }

  const filtered = vmInventory.filter(vm => {
    const blob = [vm.name, vm.host, vm.datastore, vm.guest_os, vm.vmx_path, vm.uuid, vm.disk_summary, vm.network_summary, vm.source].join(" ").toLowerCase();
    return blob.includes(q);
  });

  renderInventory(filtered);
});

function setupLogs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      currentLogType = btn.dataset.logType;
      if (logDescription) logDescription.textContent = btn.dataset.logDesc || "";
      loadLog();
    });
  });

  loadLogBtn.addEventListener("click", loadLog);
  logSearch.addEventListener("keydown", event => {
    if (event.key === "Enter") loadLog();
  });
}

async function loadLog() {
  const q = logSearch.value.trim();

  logMeta.classList.remove("hidden");
  logMeta.classList.remove("error");
  logMeta.textContent = "Loading log...";

  try {
    const url = `/api/logs?type=${encodeURIComponent(currentLogType)}&q=${encodeURIComponent(q)}&limit=3000`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      logMeta.classList.add("error");
      logMeta.textContent = data.error || "Failed to load log.";
      return;
    }

    if (!data.exists) {
      logMeta.textContent = `${currentLogType}.log was not found in the latest analyzed bundle.`;
      logViewer.textContent = "No log available.";
      return;
    }

    logMeta.textContent = `Showing ${data.lines.length} of ${data.total} matching line(s).`;
    logViewer.innerHTML = data.lines.map(highlightLogLine).join("");
  } catch (err) {
    logMeta.classList.add("error");
    logMeta.textContent = `Request failed: ${err.message}`;
  }
}

function highlightLogLine(line) {
  const lower = line.toLowerCase();
  let cls = "log-line";

  if (lower.includes("error") || lower.includes("failed") || lower.includes("panic") || lower.includes("psod") || lower.includes("apd") || lower.includes("pdl")) {
    cls += " log-error";
  } else if (lower.includes("warning") || lower.includes("timeout") || lower.includes("latency") || lower.includes("down")) {
    cls += " log-warn";
  }

  return `<div class="${cls}">${escapeHtml(line)}</div>`;
}

function shortPath(path) {
  return String(path).split("/").slice(-4).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
