
/*
  OpenEurope Demo (versione semplice)
  - Nessuna installazione: apri index.html
  - CSV: PapaParse
  - PDF: pdf.js (testo) + OCR (tesseract.js)
  - Grafici: Chart.js
  - PDF export: html2pdf.js
*/

(function () {
  console.log("App script initialized");
  const STORAGE_KEY = "openeurope_demo_v3";

  // ---------- Utils ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function nowISO() {
    const d = new Date();
    return d.toISOString();
  }

  function fmtNumber(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return "—";
    const n = Number(x);
    return n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  }

  function safeFloat(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s) return null;
    // handle Italian numbers like 1.234,56
    s = s.replace(/\s/g, "");
    s = s.replace(/\.(?=\d{3}(\D|$))/g, ""); // remove thousand separators
    s = s.replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function clamp(v, min, max) {
    if (v === null || v === undefined) return v;
    return Math.max(min, Math.min(max, v));
  }

  function downloadText(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadFileFromAssets(path, filename) {
    const a = document.createElement("a");
    a.href = path;
    a.download = filename || path.split("/").pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const INSTALL_STATUS_URL = "install_status.json";

  function setInstallStatusItem(key, status) {
    const item = document.getElementById(`status-${key}`);
    const message = document.getElementById(`status-msg-${key}`);
    if (!item || !message) return;
    item.classList.remove("ok", "error", "loading");
    if (!status) {
      item.classList.add("error");
      message.textContent = "Stato non disponibile";
      return;
    }
    item.classList.add(status.ok ? "ok" : "error");
    message.textContent = status.message || (status.ok ? "OK" : "Errore");
  }

  async function refreshInstallStatus() {
    const updatedEl = document.getElementById("status-updated");
    const targets = ["python", "pandas", "openpyxl", "structure", "server"];
    targets.forEach((key) => {
      const item = document.getElementById(`status-${key}`);
      const message = document.getElementById(`status-msg-${key}`);
      if (item && message) {
        item.classList.remove("ok", "error");
        item.classList.add("loading");
        message.textContent = "In verifica...";
      }
    });
    try {
      const response = await fetch(`${INSTALL_STATUS_URL}?t=${Date.now()}`);
      if (!response.ok) throw new Error("Status non disponibile");
      const payload = await response.json();
      targets.forEach((key) => setInstallStatusItem(key, payload[key]));
      if (updatedEl) {
        const updatedAt = payload.updated_at
          ? new Date(payload.updated_at).toLocaleString("it-IT")
          : "—";
        updatedEl.textContent = `Ultimo aggiornamento: ${updatedAt}`;
      }
    } catch (error) {
      targets.forEach((key) => setInstallStatusItem(key, null));
      if (updatedEl) updatedEl.textContent = "Ultimo aggiornamento: non disponibile";
    }
  }

  function setActiveStep(step) {
    // Evidenzia il pulsante di navigazione e mostra/nasconde i pannelli
    console.log("setActiveStep called with step:", step);
    state.ui.step = step;
    
    // Aggiorna pulsanti
    $$(".step").forEach(btn => {
      const isActive = btn.dataset.step === String(step);
      btn.classList.toggle("active", isActive);
    });
    
    // Aggiorna pannelli
    for (let i = 1; i <= 7; i++) {
      const panel = $("#step" + i);
      if (panel) {
        const shouldHide = i !== step;
        panel.classList.toggle("hidden", shouldHide);
        console.log(`Step ${i}: hidden=${shouldHide}`);
      }
    }
    
    // refresh dashboard on open (now step 6)
    if (step === 6) {
      refreshDashboard();
      updateReportPreview();
    }
    // render audit log when opening step7
    if (step === 7) renderLog();
    persist();
  }

  function setTab(tab) {
    state.ui.tab = tab;
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("#tab_manual").classList.toggle("hidden", tab !== "manual");
    $("#tab_csv").classList.toggle("hidden", tab !== "csv");
    $("#tab_pdf").classList.toggle("hidden", tab !== "pdf");
    persist();
  }

  // ---------- Modal ----------
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalCancel = $("#modalCancel");
  const modalOk = $("#modalOk");
  let modalResolve = null;

  function confirmModal(title, body, okText = "OK", cancelText = "Annulla") {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalOk.textContent = okText;
    modalCancel.textContent = cancelText;
    modal.classList.remove("hidden");
    return new Promise((resolve) => {
      modalResolve = resolve;
    });
  }

  modalCancel.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (modalResolve) modalResolve(false);
  });
  modalOk.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (modalResolve) modalResolve(true);
  });

  // ---------- State ----------
  const state = loadState();

  function defaultState() {
    const y = new Date().getFullYear();
    return {
      ui: { step: 1, tab: "manual", selectedYear: y, selectedUtility: null },
      project: {
        name: "OpenEurope — Demo",
        site: "",
        year: y,
        notes: ""
      },
      company: {
        name: "",
        vat: "",
        size: "",
        employees: 0,
        revenue: 0,
        balance: 0,
        sector: ""
      },
      utilities: [],    // {id, type: 'electricity'|'gas', pod: '', pdr: '', description: ''}
      energyByYear: {}, // {2024: {utilityId: [{month, data, note, source}, ...]}, ...}
      energy: [],       // retrocompatibilità
      energyYears: [y], // lista anni disponibili
      machines: [],     // {id, name, kW, eff, hoursYear, util, consFactor, note}
      autoprod: [],     // {id, month, type, produced, self, note}
      gasUsers: [],     // {id, name, type, power, eff, hoursYear, util, producedTh, gasKwh, gasSmc, note}
      log: []           // {ts,msg}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const obj = JSON.parse(raw);
      // minimal validation
      if (!obj.project || !obj.ui) return defaultState();
      obj.energy = Array.isArray(obj.energy) ? obj.energy : [];
      obj.machines = Array.isArray(obj.machines) ? obj.machines : [];
      obj.autoprod = Array.isArray(obj.autoprod) ? obj.autoprod : [];
      obj.gasUsers = Array.isArray(obj.gasUsers) ? obj.gasUsers : [];
      obj.log = Array.isArray(obj.log) ? obj.log : [];
      return obj;
    } catch (e) {
      console.warn("State load failed:", e);
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("State save failed:", e);
    }
  }

  function log(msg) {
    state.log.unshift({ ts: nowISO(), msg });
    persist();
  }

  // ---------- Project ----------
  function bindProjectUI() {
    $("#projectName").value = state.project.name || "";
    $("#projectSite").value = state.project.site || "";
    $("#projectYear").value = state.project.year || new Date().getFullYear();
    $("#projectNotes").value = state.project.notes || "";
  }

  function bindCompanyUI() {
    $("#companyName").value = state.company.name || "";
    $("#companyVAT").value = state.company.vat || "";
    $("#companySize").value = state.company.size || "";
    $("#companyEmployees").value = state.company.employees || "";
    $("#companyRevenue").value = state.company.revenue || "";
    $("#companyBalance").value = state.company.balance || "";
    $("#companySector").value = state.company.sector || "";
  }

  $("#btnSaveProject").addEventListener("click", () => {
    state.project.name = $("#projectName").value.trim() || "OpenEurope — Demo";
    state.project.site = $("#projectSite").value.trim();
    state.project.year = Number($("#projectYear").value) || new Date().getFullYear();
    state.project.notes = $("#projectNotes").value.trim();
    log(`Salvati dati progetto (${state.project.year})`);
    persist();
    // move to next step to keep flow
    setActiveStep(2);
  });

  $("#btnSaveCompany").addEventListener("click", () => {
    state.company.name = $("#companyName").value.trim();
    state.company.vat = $("#companyVAT").value.trim();
    state.company.size = $("#companySize").value;
    state.company.employees = Number($("#companyEmployees").value) || 0;
    state.company.revenue = Number($("#companyRevenue").value) || 0;
    state.company.balance = Number($("#companyBalance").value) || 0;
    state.company.sector = $("#companySector").value.trim();
    log(`Salvati dati anagrafica impresa: ${state.company.name}`);
    persist();
  });

  // ---------- Energy by Year Management ----------
  function getEnergyForYear(year) {
    if (!state.energyByYear[year]) {
      state.energyByYear[year] = [];
    }
    return state.energyByYear[year];
  }

  function ensureYearExists(year) {
    if (!state.energyYears.includes(year)) {
      state.energyYears.push(year);
      state.energyYears.sort((a, b) => a - b);
      state.energyByYear[year] = [];
    }
  }

  function refreshEnergyYearUI() {
    const selector = $("#energyYearSelector");
    const currentYear = state.ui.selectedYear || new Date().getFullYear();
    selector.innerHTML = state.energyYears.map(y => 
      `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`
    ).join("");
    selector.value = currentYear;
    
    // Aggiorna info anno
    const yearData = getEnergyForYear(currentYear);
    const monthCount = yearData.length;
    $("#energyYearInfo").textContent = `${currentYear}: ${monthCount} mesi inseriti`;
  }

  $("#energyYearSelector").addEventListener("change", (e) => {
    state.ui.selectedYear = Number(e.target.value);
    renderEnergyTable();
    refreshEnergyYearUI();
    refreshDashboard();
    persist();
  });

  $("#btnAddEnergyYear").addEventListener("click", () => {
    const newYear = Number($("#newEnergyYear").value);
    console.log("Clicked btnAddEnergyYear, newYear =", newYear);
    if (!newYear || newYear < 2000 || newYear > 2100) {
      console.log("Invalid year:", newYear);
      return;
    }
    if (state.energyYears.includes(newYear)) {
      console.log("Year already exists:", newYear);
      return;
    }
    ensureYearExists(newYear);
    state.ui.selectedYear = newYear;
    $("#newEnergyYear").value = "";
    log(`Aggiunto anno di riferimento: ${newYear}`);
    console.log("energyYears after add:", state.energyYears);
    console.log("state.ui.selectedYear =", state.ui.selectedYear);
    refreshEnergyYearUI();
    renderEnergyTable();
    refreshDashboard();
    persist();
    console.log("Year added and persisted");
  });

  // ---------- Utilities Management ----------
  function uid() {
    return "u_" + Math.random().toString(36).substr(2, 9);
  }

  function addUtility(type, pod, pdr, description) {
    const util = {
      id: uid(),
      type: type, // 'electricity' or 'gas'
      pod: pod || "",
      pdr: pdr || "",
      description: description || ""
    };
    state.utilities.push(util);
    const year = state.ui.selectedYear || new Date().getFullYear();
    if (!state.energyByYear[year]) state.energyByYear[year] = {};
    state.energyByYear[year][util.id] = [];
    state.ui.selectedUtility = util.id;
    log(`Aggiunta utenza: ${util.description || util.type} (${util.pod || util.pdr})`);
    persist();
    renderUtilitiesTable();
    refreshManualUtilitySelector();
  }

  function deleteUtility(id) {
    state.utilities = state.utilities.filter(u => u.id !== id);
    for (const year of state.energyYears) {
      if (state.energyByYear[year] && state.energyByYear[year][id]) {
        delete state.energyByYear[year][id];
      }
    }
    if (state.ui.selectedUtility === id) {
      state.ui.selectedUtility = state.utilities.length > 0 ? state.utilities[0].id : null;
    }
    log(`Eliminata utenza`);
    persist();
    renderUtilitiesTable();
    refreshManualUtilitySelector();
  }

  function renderUtilitiesTable() {
    const tbody = $("#utilitiesTable tbody");
    tbody.innerHTML = "";
    if (state.utilities.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted small">Nessuna utenza registrata.</td>`;
      tbody.appendChild(tr);
      return;
    }
    for (const u of state.utilities) {
      const year = state.ui.selectedYear || new Date().getFullYear();
      const yearData = state.energyByYear[year]?.[u.id] || [];
      const typeLabel = u.type === 'electricity' ? 'Elettrica' : 'Gas';
      const id = u.pod || u.pdr;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${typeLabel}</b></td>
        <td>${escapeHtml(id)}</td>
        <td>${escapeHtml(u.description)}</td>
        <td>${yearData.length} mesi</td>
        <td>
          <button class="ghost smallbtn" data-edit-utility="${u.id}">Modifica</button>
          <button class="ghost smallbtn" data-del-utility="${u.id}">Elimina</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    
    // Edit button handlers
    tbody.querySelectorAll("[data-edit-utility]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const utilId = btn.dataset.editUtility;
        const util = state.utilities.find(u => u.id === utilId);
        if (!util) return;
        
        const isElec = util.type === 'electricity';
        let newValue;
        if (isElec) {
          newValue = prompt(`Modifica POD (attuale: ${util.pod}):`, util.pod);
          if (newValue !== null) {
            util.pod = newValue;
            log(`Aggiornato POD: ${newValue}`);
          }
        } else {
          newValue = prompt(`Modifica PDR (attuale: ${util.pdr}):`, util.pdr);
          if (newValue !== null) {
            util.pdr = newValue;
            log(`Aggiornato PDR: ${newValue}`);
          }
        }
        if (newValue !== null) {
          persist();
          renderUtilitiesTable();
          refreshManualUtilitySelector();
        }
      });
    });
    
    // Delete button handlers
    tbody.querySelectorAll("[data-del-utility]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delUtility;
        const ok = await confirmModal("Eliminare utenza?", "Questa azione elimina tutti i consumi associati.", "Elimina", "Annulla");
        if (ok) deleteUtility(id);
      });
    });
  }

  function refreshManualUtilitySelector() {
    const sel = $("#manualUtility");
    const current = state.ui.selectedUtility;
    sel.innerHTML = state.utilities.map(u => {
      const typeLabel = u.type === 'electricity' ? 'Elettrica' : 'Gas';
      const id = u.pod || u.pdr;
      const label = `${typeLabel} - ${u.description || id}`;
      return `<option value="${u.id}" ${u.id === current ? "selected" : ""}>${label}</option>`;
    }).join("");
    if (sel.options.length > 0 && !current) {
      state.ui.selectedUtility = sel.options[0].value;
    }
  }

  function updateManualFieldsForUtility() {
    const utilId = state.ui.selectedUtility;
    const util = state.utilities.find(u => u.id === utilId);
    if (!util) return;
    
    renderMonthsGrid();
  }

  function renderMonthsGrid() {
    const container = $("#monthsGridContainer");
    if (!container) return;
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    const utilId = state.ui.selectedUtility;
    const util = state.utilities.find(u => u.id === utilId);
    
    if (!util) {
      container.innerHTML = '';
      return;
    }
    
    if (util.type === 'electricity') {
      renderElectricityMonthsGrid(container, year, utilId);
    } else if (util.type === 'gas') {
      renderGasMonthsGrid(container, year, utilId);
    } else {
      container.innerHTML = '';
    }
  }

  function renderElectricityMonthsGrid(container, year, utilId) {

    const yearData = state.energyByYear[year]?.[utilId] || [];
    let html = '<div class="months-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">';
    
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const month = `${year}-${mm}`;
      const monthName = new Date(year, m - 1).toLocaleDateString('it-IT', { month: 'long' });
      const existing = yearData.find(r => r.month === month);
      
      const f1 = existing?.data?.f1 || '';
      const f2 = existing?.data?.f2 || '';
      const f3 = existing?.data?.f3 || '';
      const potenza = existing?.data?.potenza || '';
      const cosfi = existing?.data?.cosfi || '';
      
      html += `
        <div style="border: 1px solid rgba(96,165,250,0.2); border-radius: 8px; padding: 12px; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px);">
          <div style="font-weight: bold; margin-bottom: 10px; text-transform: capitalize; color: var(--accent);">${monthName} (${month})</div>
          <label style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="width: 80px; font-size: 12px;">F1 (kWh):</span>
            <input type="number" class="month-input" data-month="${month}" data-field="f1" min="0" step="0.01" value="${f1}" placeholder="0" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
          <label style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="width: 80px; font-size: 12px;">F2 (kWh):</span>
            <input type="number" class="month-input" data-month="${month}" data-field="f2" min="0" step="0.01" value="${f2}" placeholder="0" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
          <label style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="width: 80px; font-size: 12px;">F3 (kWh):</span>
            <input type="number" class="month-input" data-month="${month}" data-field="f3" min="0" step="0.01" value="${f3}" placeholder="0" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
          <label style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="width: 80px; font-size: 12px;">Pot.Att (kW):</span>
            <input type="number" class="month-input" data-month="${month}" data-field="potenza" min="0" step="0.01" value="${potenza}" placeholder="0" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
          <label style="display: flex; align-items: center;">
            <span style="width: 80px; font-size: 12px;">cos φ:</span>
            <input type="number" class="month-input" data-month="${month}" data-field="cosfi" min="0" max="1" step="0.01" value="${cosfi}" placeholder="0.95" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Aggiungi event listeners per auto-salvataggio
    container.querySelectorAll('.month-input').forEach(input => {
      input.addEventListener('change', saveMonthDataAutomatically);
    });
  }

  function renderGasMonthsGrid(container, year, utilId) {
    const yearData = state.energyByYear[year]?.[utilId] || [];
    let html = '<div class="months-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px;">';
    
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const month = `${year}-${mm}`;
      const monthName = new Date(year, m - 1).toLocaleDateString('it-IT', { month: 'long' });
      const existing = yearData.find(r => r.month === month);
      
      const gasSmc = existing?.data?.gas || '';  // value in SmC
      
      html += `
        <div style="border: 1px solid rgba(52,211,153,0.2); border-radius: 8px; padding: 12px; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px);">
          <div style="font-weight: bold; margin-bottom: 10px; text-transform: capitalize; color: var(--accent2);">${monthName} (${month})</div>
          <label style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="width: 100px; font-size: 12px;">Gas (SmC):</span>
            <input type="number" class="month-gas-input" data-month="${month}" data-field="gas" min="0" step="0.01" value="${gasSmc}" placeholder="0" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(6,8,20,0.6); color: var(--text);">
          </label>
          <small style="color: var(--muted);">Standard Metri Cubi</small>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Aggiungi event listeners per auto-salvataggio gas
    container.querySelectorAll('.month-gas-input').forEach(input => {
      input.addEventListener('change', saveGasMonthDataAutomatically);
    });
  }

  function saveGasMonthDataAutomatically(e) {
    const input = e.target;
    const month = input.dataset.month;
    const field = input.dataset.field;
    const value = safeFloat(input.value) ?? 0;
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    const utilId = state.ui.selectedUtility;
    
    if (!state.energyByYear[year]) state.energyByYear[year] = {};
    if (!state.energyByYear[year][utilId]) state.energyByYear[year][utilId] = [];
    
    let existing = state.energyByYear[year][utilId].find(r => r.month === month);
    if (!existing) {
      existing = { month, data: { gas: 0 }, note: "", source: "manuale" };
      state.energyByYear[year][utilId].push(existing);
      state.energyByYear[year][utilId].sort((a, b) => a.month.localeCompare(b.month));
    }
    
    existing.data[field] = round2(value);
    persist();
    renderEnergyTable();
    refreshDashboard();
  }

  function saveMonthDataAutomatically(e) {
    const input = e.target;
    const month = input.dataset.month;
    const field = input.dataset.field;
    const value = safeFloat(input.value) ?? 0;
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    const utilId = state.ui.selectedUtility;
    
    if (!state.energyByYear[year]) state.energyByYear[year] = {};
    if (!state.energyByYear[year][utilId]) state.energyByYear[year][utilId] = [];
    
    let existing = state.energyByYear[year][utilId].find(r => r.month === month);
    if (!existing) {
      existing = { month, data: { f1: 0, f2: 0, f3: 0, potenza: 0, cosfi: 0.95 }, note: "", source: "manuale" };
      state.energyByYear[year][utilId].push(existing);
      state.energyByYear[year][utilId].sort((a, b) => a.month.localeCompare(b.month));
    }
    
    existing.data[field] = round2(value);
    persist();
    renderEnergyTable();
    refreshDashboard();
  }

  $("#btnAddUtility").addEventListener("click", async () => {
    const typeVal = prompt("Tipo utenza:\\n1 = Elettrica\\n2 = Gas", "1");
    if (!typeVal) return;
    const type = typeVal === "2" ? "gas" : "electricity";
    const pod = type === "electricity" ? prompt("POD (Punto di Prelievo):") : "";
    const pdr = type === "gas" ? prompt("PDR (Punto di Riconsegna):") : "";
    const desc = prompt("Descrizione (es. Sede principale, Fabbrica, ecc.):");
    if (desc) {
      addUtility(type, pod, pdr, desc);
    }
  });

  $("#manualUtility").addEventListener("change", (e) => {
    state.ui.selectedUtility = e.target.value;
    updateManualFieldsForUtility();
    renderUtilityDetailChart();
    persist();
  });

  $("#btnLoadDemo").addEventListener("click", async () => {
    const ok = await confirmModal(
      "Caricare dataset demo?",
      "Questa azione <b>sovrascrive</b> i dati attuali nel browser.",
      "Carica",
      "Annulla"
    );
    if (!ok) return;
    Object.assign(state, defaultState());
    state.project.name = "OpenEurope — Demo dataset";
    state.project.site = "Cliente demo — Stabilimento esempio";
    state.project.year = new Date().getFullYear();
    state.project.notes = "Dataset fittizio per dimostrazione: 12 mesi + 3 macchinari.";
    // company demo
    state.company.name = "OpenEurope Energy Solutions";
    state.company.vat = "IT12345678901";
    state.company.size = "media";
    state.company.employees = 150;
    state.company.revenue = 2500000;
    state.company.balance = 1800000;
    state.company.sector = "Energy Efficiency";
    
    // utilities demo
    state.utilities = [
      { id: uid(), type: 'electricity', pod: 'IT001E0000000001', pdr: '', description: 'Sede principale - Energia' },
      { id: uid(), type: 'gas', pod: '', pdr: 'IT001G0000000001', description: 'Sede principale - Gas' }
    ];
    
    // energy demo
    const y = state.project.year;
    state.energy = [];
    state.energyYears = [y];
    state.energyByYear = {};
    state.energyByYear[y] = {};
    
    // Popola dati per ogni utenza
    for (const util of state.utilities) {
      state.energyByYear[y][util.id] = [];
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const month = `${y}-${mm}`;
        if (util.type === 'electricity') {
          const base = 12000 + (Math.sin(m / 12 * Math.PI * 2) * 1500);
          const f1 = Math.max(0, base * 0.45 + (Math.random() * 300 - 150));
          const f2 = Math.max(0, base * 0.35 + (Math.random() * 250 - 125));
          const f3 = Math.max(0, base * 0.20 + (Math.random() * 200 - 100));
          const data = { f1: round2(f1), f2: round2(f2), f3: round2(f3) };
          state.energyByYear[y][util.id].push({ month, data, note: "", source: "demo" });
        } else {
          const gasVal = Math.max(0, 5000 + (Math.sin(m / 12 * Math.PI * 2) * 1000) + (Math.random() * 200 - 100));
          const data = { gas: round2(gasVal) };
          state.energyByYear[y][util.id].push({ month, data, note: "", source: "demo" });
        }
      }
    }
    
    state.ui.selectedYear = y;
    state.ui.selectedUtility = state.utilities.length > 0 ? state.utilities[0].id : null;
    
    // machines demo
    state.machines = [
      { id: uid(), name: "Compressore", kW: 45, eff: 0.92, hoursYear: 1800, util: 0.70, consFactor: 1.00, note: "turno singolo" },
      { id: uid(), name: "Forno", kW: 80, eff: 0.88, hoursYear: 1400, util: 0.60, consFactor: 1.05, note: "ciclo variabile" },
      { id: uid(), name: "Linea assemblaggio", kW: 25, eff: 0.95, hoursYear: 2000, util: 0.65, consFactor: 1.00, note: "" },
    ];
    state.log = [];
    log("Caricato dataset demo");
    bindProjectUI();
    bindCompanyUI();
    refreshEnergyYearUI();
    renderUtilitiesTable();
    refreshManualUtilitySelector();
    updateManualFieldsForUtility();
    renderEnergyTable();
    renderMachineTable();
    refreshDashboard();
    updateReportPreview();
    setActiveStep(2);
  });

  // ---------- Energy (manual / CSV / PDF) ----------
  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function normalizeMonth(m) {
    if (!m) return null;
    const s = String(m).trim();
    // accept YYYY-MM or YYYY/MM or YYYYMM
    const m1 = s.match(/^(\d{4})[-\/](\d{2})$/);
    if (m1) return `${m1[1]}-${m1[2]}`;
    const m2 = s.match(/^(\d{4})(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}`;
    // accept MM/YYYY
    const m3 = s.match(/^(\d{2})\/(\d{4})$/);
    if (m3) return `${m3[2]}-${m3[1]}`;
    return null;
  }

  function upsertEnergy(rec, askOverwrite = true) {
    const month = normalizeMonth(rec.month);
    if (!month) return { ok: false, reason: "Mese non valido" };
    const f1 = safeFloat(rec.f1) ?? 0;
    const f2 = safeFloat(rec.f2) ?? 0;
    const f3 = safeFloat(rec.f3) ?? 0;
    const gas = safeFloat(rec.gas) ?? 0;
    const note = rec.note || "";
    const source = rec.source || "manual";
    const year = state.ui.selectedYear || new Date().getFullYear();
    const yearData = getEnergyForYear(year);
    const idx = yearData.findIndex(r => r.month === month);
    if (idx >= 0) {
      // overwrite existing
      yearData[idx] = { month, f1: round2(f1), f2: round2(f2), f3: round2(f3), gas: round2(gas), note, source };
      return { ok: true, overwritten: true };
    } else {
      yearData.push({ month, f1: round2(f1), f2: round2(f2), f3: round2(f3), gas: round2(gas), note, source });
      yearData.sort((a, b) => a.month.localeCompare(b.month));
      return { ok: true, overwritten: false };
    }
  }

  function deleteEnergy(month) {
    const year = state.ui.selectedYear || new Date().getFullYear();
    const yearData = getEnergyForYear(year);
    const initialLength = yearData.length;
    state.energyByYear[year] = yearData.filter(r => r.month !== month);
    if (yearData.length < initialLength) {
      log(`Eliminata riga consumi ${year}: ${month}`);
      persist();
    }
    renderEnergyTable();
  }

  // Manual add
  $("#btnSaveAllMonths").addEventListener("click", async () => {
    const utilId = state.ui.selectedUtility;
    if (!utilId) return;
    
    const util = state.utilities.find(u => u.id === utilId);
    if (!util || util.type !== 'electricity') return;
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    log(`Salvati consumi per tutti i mesi dell'anno ${year}`);
    persist();
    renderEnergyTable();
    refreshDashboard();
  });

  $("#btnClearAllMonths").addEventListener("click", () => {
    const utilId = state.ui.selectedUtility;
    if (!utilId) return;
    
    const container = $("#monthsGridContainer");
    if (container) {
      container.querySelectorAll('.month-input').forEach(input => {
        input.value = '';
      });
    }
  });
  
  // Legacy event listeners for old manual mode (kept for compatibility)
  const btnAddEnergyManual = $("#btnAddEnergyManual");
  if (btnAddEnergyManual) {
    btnAddEnergyManual.addEventListener("click", async () => {
      const utilId = state.ui.selectedUtility;
      if (!utilId) {
        return;
      }
      const util = state.utilities.find(u => u.id === utilId);
      if (!util) return;
      
      const month = $("#manualMonth").value;
      const m = normalizeMonth(month);
      if (!m) {
        return;
      }
      
      const year = state.ui.selectedYear || new Date().getFullYear();
      let data = {};
      
      if (util.type === 'electricity') {
        data.f1 = safeFloat($("#manualF1").value) ?? 0;
        data.f2 = safeFloat($("#manualF2").value) ?? 0;
        data.f3 = safeFloat($("#manualF3").value) ?? 0;
      } else {
        data.gas = safeFloat($("#manualGas").value) ?? 0;
      }
      
      if (!state.energyByYear[year]) state.energyByYear[year] = {};
      if (!state.energyByYear[year][utilId]) state.energyByYear[year][utilId] = [];
      
      const existing = state.energyByYear[year][utilId].find(r => r.month === m);
      if (existing) {
        // Sovrascrivi silenziosamente
        const idx = state.energyByYear[year][utilId].indexOf(existing);
        state.energyByYear[year][utilId][idx] = { month: m, data, note: $("#manualNote").value.trim(), source: "manuale" };
        log(`Aggiornati consumi: ${m}`);
      } else {
        state.energyByYear[year][utilId].push({ month: m, data, note: $("#manualNote").value.trim(), source: "manuale" });
        state.energyByYear[year][utilId].sort((a, b) => a.month.localeCompare(b.month));
        log(`Inseriti consumi manuali: ${m}`);
      }
      
      persist();
      renderEnergyTable();
      refreshDashboard();
      $("#manualMonth").value = "";
      $("#manualNote").value = "";
      $("#manualF1").value = "";
      $("#manualF2").value = "";
      $("#manualF3").value = "";
      $("#manualGas").value = "";
    });
  }

  const btnClearEnergyManual = $("#btnClearEnergyManual");
  if (btnClearEnergyManual) {
    btnClearEnergyManual.addEventListener("click", () => {
      $("#manualMonth").value = "";
      if ($("#manualF1")) $("#manualF1").value = "";
      if ($("#manualF2")) $("#manualF2").value = "";
      if ($("#manualF3")) $("#manualF3").value = "";
      if ($("#manualGas")) $("#manualGas").value = "";
      if ($("#manualNote")) $("#manualNote").value = "";
    });
  }

  function renderEnergyTable() {
    const tbody = $("#energyTable tbody");
    tbody.innerHTML = "";
    const year = state.ui.selectedYear || new Date().getFullYear();
    
    const allData = [];
    for (const util of state.utilities) {
      const yearData = state.energyByYear[year]?.[util.id] || [];
      for (const r of yearData) {
        allData.push({ ...r, utilityId: util.id, utility: util });
      }
    }
    
    if (allData.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted small">Nessun dato inserito per l'anno ${year}.</td>`;
      tbody.appendChild(tr);
      return;
    }
    
    allData.sort((a, b) => a.month.localeCompare(b.month));
    
    for (const r of allData) {
      const typeLabel = r.utility.type === 'electricity' ? 'Elettrica' : 'Gas';
      const utilLabel = r.utility.description || (r.utility.pod || r.utility.pdr);
      let dataStr = '';
      let tot = 0;
      let extraInfo = '';
      if (r.utility.type === 'electricity') {
        const f1 = r.data.f1 || 0;
        const f2 = r.data.f2 || 0;
        const f3 = r.data.f3 || 0;
        const potenza = r.data.potenza || 0;
        const cosfi = r.data.cosfi || 0.95;
        tot = f1 + f2 + f3;
        dataStr = `F1: ${fmtNumber(f1)}, F2: ${fmtNumber(f2)}, F3: ${fmtNumber(f3)}`;
        extraInfo = `<br><small>Pot: ${fmtNumber(potenza)} kW | cos φ: ${fmtNumber(cosfi)}</small>`;
      } else {
        tot = r.data.gas || 0;
        dataStr = `Gas: ${fmtNumber(tot)}`;
      }
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${typeLabel}<br><small>${escapeHtml(utilLabel)}</small></td>
        <td><b>${r.month}</b></td>
        <td>${dataStr}${extraInfo}</td>
        <td><b>${fmtNumber(tot)}</b></td>
        <td>
          <button class="ghost smallbtn" data-del-energy="${r.utilityId}" data-month="${r.month}">Elimina</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("[data-del-energy]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const utilId = btn.dataset.delEnergy;
        const month = btn.dataset.month;
        const ok = await confirmModal("Eliminare riga?", `Eliminare i consumi del mese <b>${month}</b>?`, "Elimina", "Annulla");
        if (!ok) return;
        const year = state.ui.selectedYear || new Date().getFullYear();
        state.energyByYear[year][utilId] = state.energyByYear[year][utilId].filter(r => r.month !== month);
        log(`Eliminata riga consumi ${month}`);
        persist();
        renderEnergyTable();
        refreshDashboard();
      });
    });
  }

  // CSV import preview state
  let csvPreviewRows = [];

  $("#fileCSV").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        csvPreviewRows = parseCsvRows(res.data || []);
        renderCsvPreview();
        $("#btnConfirmCSVImport").disabled = csvPreviewRows.length === 0;
        $("#btnClearCSVPreview").disabled = csvPreviewRows.length === 0;
        log(`Caricato CSV: ${file.name} (anteprima)`);
      },
      error: (err) => {
        console.error(err);
        alert("Errore nella lettura del CSV.");
      }
    });
  });

  // Download template for energy CSV (3 years, F1/F2/F3/Gas)
  $("#btnDownloadEnergyTemplate").addEventListener("click", () => {
    downloadEnergyTemplate();
  });

  $("#btnClearCSVPreview").addEventListener("click", () => {
    csvPreviewRows = [];
    renderCsvPreview();
    $("#btnConfirmCSVImport").disabled = true;
    $("#btnClearCSVPreview").disabled = true;
  });

  $("#btnConfirmCSVImport").addEventListener("click", async () => {
    if (csvPreviewRows.length === 0) return;
    // detect duplicates
    const duplicates = csvPreviewRows
      .map(r => normalizeMonth(r.month))
      .filter(m => m && state.energy.some(e => e.month === m));
    let overwriteAll = false;
    if (duplicates.length > 0) {
      const ok = await confirmModal(
        "Mesi già presenti",
        `Il CSV contiene mesi già presenti (<b>${[...new Set(duplicates)].join(", ")}</b>). Vuoi sovrascriverli?`,
        "Sì, sovrascrivi",
        "No"
      );
      if (!ok) return;
      overwriteAll = true;
    }
    let imported = 0;
    for (const r of csvPreviewRows) {
      const month = normalizeMonth(r.month);
      if (!month) continue;
      upsertEnergy({ ...r, month, gas: r.gas, source: "CSV" }, overwriteAll);
      imported++;
    }
    log(`Import CSV confermato: ${imported} righe`);
    csvPreviewRows = [];
    renderCsvPreview();
    $("#btnConfirmCSVImport").disabled = true;
    $("#btnClearCSVPreview").disabled = true;
    renderEnergyTable();
    refreshDashboard();
    setTab("manual");
  });

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase();
  }

  function parseCsvRows(rows) {
    // Map possible column headers
    const out = [];
    for (const row of rows) {
      const keys = Object.keys(row || {});
      const map = {};
      for (const k of keys) map[normalizeHeader(k)] = row[k];

      const yearCol = map["year"] ?? map["anno"];
      const monthCol = map["month"] ?? map["mese"] ?? map["period"] ?? map["periodo"] ?? map["ym"] ?? map["anno_mese"];
      let month = monthCol;
      // combine year and month if both present and month isn't in YYYY-MM format
      let combinedMonth = null;
      if (yearCol && monthCol) {
        const yv = String(yearCol).trim();
        let mv = String(monthCol).trim();
        if (/^\d{4}$/.test(yv) && /^\d{1,2}$/.test(mv)) {
          mv = mv.padStart(2, "0");
          combinedMonth = `${yv}-${mv}`;
        }
      }
      const monthVal = combinedMonth || month;
      const f1 = map["f1_kwh"] ?? map["f1"] ?? map["fascia1"] ?? map["f1 (kwh)"];
      const f2 = map["f2_kwh"] ?? map["f2"] ?? map["fascia2"] ?? map["f2 (kwh)"];
      const f3 = map["f3_kwh"] ?? map["f3"] ?? map["fascia3"] ?? map["f3 (kwh)"];
      const gas = map["gas_kwh"] ?? map["gas"] ?? map["g_kwh"] ?? map["gas (kwh)"];

      const nm = normalizeMonth(monthVal);
      // require at least f1,f2,f3; gas optional
      const ok = Boolean(nm) && safeFloat(f1) !== null && safeFloat(f2) !== null && safeFloat(f3) !== null;
      out.push({
        month: nm || String(monthVal || ""),
        f1: safeFloat(f1),
        f2: safeFloat(f2),
        f3: safeFloat(f3),
        gas: safeFloat(gas) ?? 0,
        note: "",
        _ok: ok
      });
    }
    return out;
  }

  function renderCsvPreview() {
    const tbody = $("#csvPreview tbody");
    tbody.innerHTML = "";
    if (csvPreviewRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted small">Carica un CSV per vedere l’anteprima.</td>`;
      tbody.appendChild(tr);
      return;
    }
    csvPreviewRows.slice(0, 200).forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.month)}</td>
        <td>${fmtNumber(r.f1)}</td>
        <td>${fmtNumber(r.f2)}</td>
        <td>${fmtNumber(r.f3)}</td>
        <td>${fmtNumber(r.gas)}</td>
        <td>${r._ok ? "OK" : "<span class='muted'>Da verificare</span>"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------------------
  // Autoproduzione
  // ---------------------------------------------------------------------------
  function setAutoTab(tab) {
    $$("#autoTabs .subtab").forEach(btn => btn.classList.toggle("active", btn.dataset.autotab === tab));
    const manualPane = $("#autotab_manual");
    const csvPane = $("#autotab_csv");
    if (manualPane) manualPane.classList.toggle("hidden", tab !== "manual");
    if (csvPane) csvPane.classList.toggle("hidden", tab !== "csv");
    persist();
  }

  $$("#autoTabs .subtab").forEach(btn => {
    btn.addEventListener("click", () => {
      setAutoTab(btn.dataset.autotab);
    });
  });

  function renderAutoTable() {
    const tbody = $("#autoTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.autoprod || state.autoprod.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted small">Nessun dato inserito.</td>`;
      tbody.appendChild(tr);
      return;
    }
    state.autoprod.forEach((rec, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(rec.month)}</b></td>
        <td>${escapeHtml(rec.type || "")}</td>
        <td>${fmtNumber(rec.produced)}</td>
        <td>${fmtNumber(rec.self)}</td>
        <td>${escapeHtml(rec.note || "")}</td>
        <td><button class="ghost smallbtn" data-act="del" data-idx="${idx}">Elimina</button></td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        state.autoprod.splice(idx, 1);
        log("Eliminata riga autoproduzione");
        persist();
        renderAutoTable();
      });
    });
  }

  $("#btnAddAuto")?.addEventListener("click", () => {
    const m = $("#autoMonth").value;
    const month = normalizeMonth(m);
    if (!month) { alert("Inserisci un mese valido (YYYY-MM)."); return; }
    const type = $("#autoType").value.trim() || "";
    const produced = safeFloat($("#autoProduced").value) ?? 0;
    const selfv = safeFloat($("#autoSelf").value) ?? 0;
    const note = $("#autoNote").value.trim() || "";
    state.autoprod.push({ id: uid(), month, type, produced: round2(produced), self: round2(selfv), note });
    log(`Inserita autoproduzione ${month}`);
    persist();
    renderAutoTable();
    // clear inputs
    $("#autoMonth").value = "";
    $("#autoType").value = "";
    $("#autoProduced").value = "";
    $("#autoSelf").value = "";
    $("#autoNote").value = "";
  });

  $("#btnClearAuto")?.addEventListener("click", () => {
    $("#autoMonth").value = "";
    $("#autoType").value = "";
    $("#autoProduced").value = "";
    $("#autoSelf").value = "";
    $("#autoNote").value = "";
  });

  let autoPreviewRows = [];
  $("#fileAutoCSV")?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        autoPreviewRows = parseAutoCsvRows(res.data || []);
        renderAutoPreview();
        const confirmBtn = $("#btnConfirmAutoCSVImport");
        const clearBtn = $("#btnClearAutoCSVPreview");
        if (confirmBtn) confirmBtn.disabled = autoPreviewRows.length === 0;
        if (clearBtn) clearBtn.disabled = autoPreviewRows.length === 0;
        log(`Caricato CSV autoproduzione: ${file.name} (anteprima)`);
      },
      error: (err) => {
        console.error(err);
        alert("Errore nella lettura del CSV autoproduzione.");
      }
    });
  });

  $("#btnClearAutoCSVPreview")?.addEventListener("click", () => {
    autoPreviewRows = [];
    renderAutoPreview();
    const confirmBtn = $("#btnConfirmAutoCSVImport");
    const clearBtn = $("#btnClearAutoCSVPreview");
    if (confirmBtn) confirmBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
  });

  $("#btnConfirmAutoCSVImport")?.addEventListener("click", () => {
    if (autoPreviewRows.length === 0) return;
    let count = 0;
    autoPreviewRows.forEach(r => {
      if (r._ok) {
        state.autoprod.push({
          id: uid(),
          month: r.month,
          type: r.type || "",
          produced: round2(safeFloat(r.produced) ?? 0),
          self: round2(safeFloat(r.self) ?? 0),
          note: r.note || ""
        });
        count++;
      }
    });
    log(`Import CSV autoproduzione: ${count} righe`);
    autoPreviewRows = [];
    renderAutoPreview();
    renderAutoTable();
    const confirmBtn = $("#btnConfirmAutoCSVImport");
    const clearBtn = $("#btnClearAutoCSVPreview");
    if (confirmBtn) confirmBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    setAutoTab('manual');
    persist();
  });

  function renderAutoPreview() {
    const tbody = $("#autoPreview tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (autoPreviewRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted small">Carica un CSV per vedere l’anteprima.</td>`;
      tbody.appendChild(tr);
      return;
    }
    autoPreviewRows.slice(0, 200).forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.month)}</td>
        <td>${escapeHtml(r.type || "")}</td>
        <td>${fmtNumber(r.produced)}</td>
        <td>${fmtNumber(r.self)}</td>
        <td>${r._ok ? "OK" : "<span class='muted'>Da verificare</span>"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function parseAutoCsvRows(rows) {
    const out = [];
    for (const row of rows) {
      const keys = Object.keys(row || {});
      const map = {};
      for (const k of keys) map[normalizeHeader(k)] = row[k];
      const year = map['year'] ?? map['anno'];
      const monthCol = map['month'] ?? map['mese'];
      let mVal = monthCol;
      let combined = null;
      if (year && monthCol) {
        const yv = String(year).trim();
        let mv = String(monthCol).trim();
        if (/^\d{4}$/.test(yv) && /^\d{1,2}$/.test(mv)) {
          mv = mv.padStart(2, '0');
          combined = `${yv}-${mv}`;
        }
      }
      const month = normalizeMonth(combined || mVal);
      const type = map['type'] ?? map['tipo'];
      const produced = safeFloat(map['produced_kwh'] ?? map['prodotta'] ?? map['produced'] ?? map['produced kwh'] ?? map['energia_prodotta']);
      const selfv = safeFloat(map['self_kwh'] ?? map['autoconsumo'] ?? map['self'] ?? map['self kwh'] ?? map['energia_autoconsumata']);
      const note = map['note'] ?? '';
      const ok = Boolean(month) && produced !== null && selfv !== null;
      out.push({ month: month || String(mVal || ''), type: type || '', produced, self: selfv, note, _ok: ok });
    }
    return out;
  }

  $("#btnDownloadAutoTemplate")?.addEventListener("click", () => {
    downloadAutoTemplate();
  });

  function downloadAutoTemplate() {
    const year = state.project?.year || new Date().getFullYear();
    const lines = [];
    for (let i = 1; i <= 12; i++) {
      const m = String(i).padStart(2, '0');
      lines.push(`${year},${m},,0,0,`);
    }
    const csv = 'year,month,type,produced_kwh,self_kwh,note\n' + lines.join('\n');
    downloadText('autoproduzione_template.csv', csv, 'text/csv');
  }

  // ---------------------------------------------------------------------------
  // Energia termica (utilizzatori gas)
  // ---------------------------------------------------------------------------
  function setGasTab(tab) {
    $$("#gasTabs .subtab").forEach(btn => btn.classList.toggle("active", btn.dataset.gastab === tab));
    const manualPane = $("#gastab_manual");
    const csvPane = $("#gastab_csv");
    if (manualPane) manualPane.classList.toggle("hidden", tab !== "manual");
    if (csvPane) csvPane.classList.toggle("hidden", tab !== "csv");
    persist();
  }

  $$("#gasTabs .subtab").forEach(btn => {
    btn.addEventListener("click", () => {
      setGasTab(btn.dataset.gastab);
    });
  });

  function computeGasUserKwh(user) {
    const kW = safeFloat(user.power) ?? 0;
    const effVal = normEff(user.eff);
    const hours = safeFloat(user.hoursYear) ?? 0;
    const util = clamp(safeFloat(user.util) ?? 1, 0, 1);
    const producedTh = kW * hours * util;
    const gasKwh = effVal > 0 ? producedTh / effVal : 0;
    return { producedTh, gasKwh, gasSmc: gasKwh / 9.6 };
  }

  function renderGasTable() {
    const tbody = $("#gasTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!state.gasUsers || state.gasUsers.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" class="muted small">Nessun dato inserito.</td>`;
      tbody.appendChild(tr);
      return;
    }
    state.gasUsers.forEach((u, idx) => {
      const { producedTh, gasSmc } = computeGasUserKwh(u);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(u.name)}</b></td>
        <td>${escapeHtml(u.type || "")}</td>
        <td>${fmtNumber(u.power)}</td>
        <td>${fmtNumber(u.hoursYear)}</td>
        <td>${fmtNumber(normEff(u.eff))}</td>
        <td>${fmtNumber(gasSmc)}</td>
        <td>${fmtNumber(producedTh)}</td>
        <td><button class="ghost smallbtn" data-act="del" data-idx="${idx}">Elimina</button></td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        state.gasUsers.splice(idx, 1);
        log("Eliminato utilizzatore gas");
        persist();
        renderGasTable();
      });
    });
  }

  $("#btnAddGas")?.addEventListener("click", () => {
    const name = $("#gName").value.trim();
    if (!name) { alert("Inserisci un nome utilizzatore."); return; }
    const type = $("#gType").value.trim() || "";
    const power = safeFloat($("#gPower").value);
    const eff = $("#gEff").value;
    const hoursYear = computeHoursYear($("#gHoursYear").value, $("#gHoursDay").value, $("#gDaysYear").value);
    const util = safeFloat($("#gUtil").value) ?? 1;
    const note = $("#gNote").value.trim() || "";
    if (power === null || hoursYear === null) {
      alert("Inserisci almeno potenza e ore annue (o ore/giorno + giorni/anno).");
      return;
    }
    state.gasUsers.push({ id: uid(), name, type, power: round2(power), eff, hoursYear: round2(hoursYear), util: round2(util), note });
    log(`Inserito utilizzatore gas: ${name}`);
    persist();
    renderGasTable();
    // clear inputs
    $("#gName").value = "";
    $("#gType").value = "";
    $("#gPower").value = "";
    $("#gEff").value = "";
    $("#gHoursYear").value = "";
    $("#gHoursDay").value = "";
    $("#gDaysYear").value = "";
    $("#gUtil").value = "";
    $("#gNote").value = "";
  });

  $("#btnClearGas")?.addEventListener("click", () => {
    $("#gName").value = "";
    $("#gType").value = "";
    $("#gPower").value = "";
    $("#gEff").value = "";
    $("#gHoursYear").value = "";
    $("#gHoursDay").value = "";
    $("#gDaysYear").value = "";
    $("#gUtil").value = "";
    $("#gNote").value = "";
  });

  let gasPreviewRows = [];
  $("#fileGasCSV")?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        gasPreviewRows = parseGasCsvRows(res.data || []);
        renderGasPreview();
        const confirmBtn = $("#btnConfirmGasCSVImport");
        const clearBtn = $("#btnClearGasCSVPreview");
        if (confirmBtn) confirmBtn.disabled = gasPreviewRows.length === 0;
        if (clearBtn) clearBtn.disabled = gasPreviewRows.length === 0;
        log(`Caricato CSV impianti termici: ${file.name} (anteprima)`);
      },
      error: (err) => {
        console.error(err);
        alert("Errore nella lettura del CSV impianti termici.");
      }
    });
  });

  $("#btnClearGasCSVPreview")?.addEventListener("click", () => {
    gasPreviewRows = [];
    renderGasPreview();
    const confirmBtn = $("#btnConfirmGasCSVImport");
    const clearBtn = $("#btnClearGasCSVPreview");
    if (confirmBtn) confirmBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
  });

  $("#btnConfirmGasCSVImport")?.addEventListener("click", () => {
    if (gasPreviewRows.length === 0) return;
    let count = 0;
    gasPreviewRows.forEach(r => {
      if (r._ok) {
        state.gasUsers.push({
          id: uid(),
          name: r.name || "", type: r.type || "",
          power: round2(safeFloat(r.power) ?? 0),
          eff: r.eff,
          hoursYear: round2(r.hoursYear ?? 0),
          util: round2(r.util ?? 1),
          note: r.note || ""
        });
        count++;
      }
    });
    log(`Import CSV impianti termici: ${count} righe`);
    gasPreviewRows = [];
    renderGasPreview();
    renderGasTable();
    const confirmBtn = $("#btnConfirmGasCSVImport");
    const clearBtn = $("#btnClearGasCSVPreview");
    if (confirmBtn) confirmBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    setGasTab('manual');
    persist();
  });

  function renderGasPreview() {
    const tbody = $("#gasPreview tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (gasPreviewRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted small">Carica un CSV per vedere l’anteprima.</td>`;
      tbody.appendChild(tr);
      return;
    }
    gasPreviewRows.slice(0, 200).forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.name || "")}</td>
        <td>${escapeHtml(r.type || "")}</td>
        <td>${fmtNumber(r.power)}</td>
        <td>${fmtNumber(r.hoursYear)}</td>
        <td>${fmtNumber(normEff(r.eff))}</td>
        <td>${r._ok ? "OK" : "<span class='muted'>Da verificare</span>"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function parseGasCsvRows(rows) {
    const out = [];
    for (const row of rows) {
      const keys = Object.keys(row || {});
      const map = {};
      for (const k of keys) map[normalizeHeader(k)] = row[k];
      const name = map['name'] ?? map['nome'];
      const type = map['type'] ?? map['tipo'];
      const power = safeFloat(map['power_kw'] ?? map['power'] ?? map['potenza'] ?? map['kw'] ?? map['kw_th']);
      const hy = safeFloat(map['hoursyear'] ?? map['hours_year'] ?? map['ore_anno'] ?? map['oreannue'] ?? map['hours']);
      const hd = safeFloat(map['hoursday'] ?? map['oregiorno'] ?? map['ore_giorno']);
      const dy = safeFloat(map['daysyear'] ?? map['days_year'] ?? map['giornianno'] ?? map['giorni_anno']);
      const eff = map['eff'] ?? map['rendimento'];
      const util = safeFloat(map['util'] ?? map['fattore_utilizzo'] ?? map['utilization']);
      const note = map['note'] ?? '';
      // compute hoursYear if not provided but hoursDay & daysYear are
      let hoursYear = hy;
      if (hoursYear === null || hoursYear === undefined) {
        hoursYear = computeHoursYear(hy, hd, dy);
      }
      const ok = name && power !== null && hoursYear !== null;
      out.push({ name: name || '', type: type || '', power, hoursYear, eff, util, note, _ok: ok });
    }
    return out;
  }

  $("#btnDownloadGasTemplate")?.addEventListener("click", () => {
    downloadGasTemplate();
  });

  function downloadGasTemplate() {
    const lines = [];
    // create a few example rows with empty fields
    for (let i = 1; i <= 3; i++) {
      lines.push(`Impianto ${i},Caldaia,,0,,0,,`);
    }
    const csv = 'name,type,power_kw,eff,hoursYear,hoursDay,daysYear,util,note\n' + lines.join('\n');
    downloadText('impianti_termici_template.csv', csv, 'text/csv');
  }

  // ---------- PDF + OCR extraction ----------
  // pdf.js global
  let pdfjsLib = null;
  function ensurePdfJs() {
    if (pdfjsLib) return pdfjsLib;
    // pdf.js attaches to window.pdfjsLib in recent builds
    pdfjsLib = window.pdfjsLib;
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.js";
    }
    return pdfjsLib;
  }

  let pdfExtractRows = []; // {source, month, f1,f2,f3, method, status}

  $("#btnDownloadSamplePDF").addEventListener("click", () => {
    // bundle: two demo PDFs
    downloadFileFromAssets("assets/bolletta_demo_testo.pdf", "bolletta_demo_testo.pdf");
    // anche versione “scansione” per test OCR
    setTimeout(() => downloadFileFromAssets("assets/bolletta_demo_scansione.pdf", "bolletta_demo_scansione.pdf"), 350);
  });

  // Download machine template
  $("#btnDownloadMachineTemplate").addEventListener("click", () => {
    downloadMachineTemplate();
  });

  // Import machines from CSV
  $("#fileMachineCSV").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = parseMachineCsvRows(res.data || []);
        if (rows.length === 0) {
          alert("Nessun dato valido trovato nel CSV.");
          return;
        }
        let imported = 0;
        rows.forEach((m) => {
          // If machine with same name exists, overwrite it (remove old)
          const idx = state.machines.findIndex(x => x.name === m.name);
          if (idx >= 0) {
            state.machines.splice(idx, 1);
          }
          state.machines.push({ id: uid(), ...m });
          imported++;
        });
        log(`Import macchinari: ${imported} righe`);
        persist();
        renderMachineTable();
        refreshDashboard();
        // reset input
        ev.target.value = "";
      },
      error: (err) => {
        console.error(err);
        alert("Errore nella lettura del CSV macchinari.");
      }
    });
  });

  $("#filePDF").addEventListener("change", async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (files.length === 0) return;
    pdfExtractRows = [];
    renderPdfExtractTable();
    $("#btnConfirmPDFExtract").disabled = true;
    $("#btnClearPDFExtract").disabled = true;
    await processPdfFiles(files);
  });

  $("#btnClearPDFExtract").addEventListener("click", () => {
    pdfExtractRows = [];
    renderPdfExtractTable();
    $("#btnConfirmPDFExtract").disabled = true;
    $("#btnClearPDFExtract").disabled = true;
  });

  $("#btnConfirmPDFExtract").addEventListener("click", async () => {
    const valid = pdfExtractRows.filter(r => normalizeMonth(r.month) && isFiniteNum(r.f1) && isFiniteNum(r.f2) && isFiniteNum(r.f3));
    if (valid.length === 0) {
      alert("Nessuna riga valida da salvare. Correggi i campi e riprova.");
      return;
    }
    // check duplicates
    const duplicates = valid
      .map(r => normalizeMonth(r.month))
      .filter(m => m && state.energy.some(e => e.month === m));
    if (duplicates.length > 0) {
      const ok = await confirmModal(
        "Mesi già presenti",
        `Le bollette estratte contengono mesi già presenti (<b>${[...new Set(duplicates)].join(", ")}</b>). Vuoi sovrascriverli?`,
        "Sì, sovrascrivi",
        "No"
      );
      if (!ok) return;
    }
    let saved = 0;
    for (const r of valid) {
      const month = normalizeMonth(r.month);
      upsertEnergy({ month, f1: r.f1, f2: r.f2, f3: r.f3, note: "", source: `PDF (${r.method})` });
      saved++;
    }
    log(`Salvati da PDF: ${saved} mesi`);
    persist();
    renderEnergyTable();
    refreshDashboard();
    // reset extraction table
    pdfExtractRows = [];
    renderPdfExtractTable();
    $("#btnConfirmPDFExtract").disabled = true;
    $("#btnClearPDFExtract").disabled = true;
    setTab("manual");
  });

  function isFiniteNum(v) {
    const n = safeFloat(v);
    return n !== null && Number.isFinite(n);
  }

  function setProgress(pct, label) {
    const box = $("#pdfProgress");
    const bar = $("#pdfProgressBar");
    const lab = $("#pdfProgressLabel");
    box.classList.remove("hidden");
    bar.style.width = `${pct}%`;
    lab.textContent = label;
  }
  function hideProgress() {
    $("#pdfProgress").classList.add("hidden");
  }

  // ---------- Templates download ----------
  // Generate a blank CSV template for energy data (3 years, F1/F2/F3/Gas)
  function downloadEnergyTemplate() {
    // Determine 3-year range centered on project year
    const y = state.project.year || new Date().getFullYear();
    const years = [y - 2, y - 1, y];
    let lines = "year,month,f1_kwh,f2_kwh,f3_kwh,gas_kwh\n";
    years.forEach(yy => {
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        lines += `${yy},${mm},,, ,\n`;
      }
    });
    const fn = `consumi_template_${years[0]}_${years[2]}.csv`;
    downloadText(fn, lines, "text/csv");
    log("Scaricato modello CSV consumi");
  }

  // Export current energy data to CSV
  function exportEnergyCsv() {
    // header with new fields
    let csv = "year,month,f1_kwh,f2_kwh,f3_kwh,potenza_attiva_kw,cosfi,gas_kwh,note\n";
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    for (const util of state.utilities) {
      const yearData = state.energyByYear[year]?.[util.id] || [];
      for (const r of yearData) {
        if (!r || !r.month) continue;
        const parts = String(r.month).split("-");
        const y = parts[0] || "";
        const m = parts[1] || "";
        const f1 = r.data?.f1 ?? 0;
        const f2 = r.data?.f2 ?? 0;
        const f3 = r.data?.f3 ?? 0;
        const potenza = r.data?.potenza ?? 0;
        const cosfi = r.data?.cosfi ?? 0.95;
        const gas = r.data?.gas ?? 0;
        const note = r.note ? String(r.note).replace(/\n/g, " ") : "";
        csv += `${y},${m},${f1},${f2},${f3},${potenza},${cosfi},${gas},${note}\n`;
      }
    }
    // file name includes year
    const fn = `consumi_export_${year}.csv`;
    downloadText(fn, csv, "text/csv");
    log("Esportato CSV consumi con Potenza Attiva e cos φ");
  }

  // Generate a blank CSV template for machines
  function downloadMachineTemplate() {
    const header = "name,kW,hoursYear,eff,util,consFactor,note\n";
    downloadText("macchinari_template.csv", header, "text/csv");
    log("Scaricato modello CSV macchinari");
  }

  // Export current autoproduzione data to CSV
  function exportAutoCsv() {
    let csv = "year,month,type,produced_kwh,self_kwh,note\n";
    state.autoprod.forEach((r) => {
      if (!r || !r.month) return;
      const parts = String(r.month).split("-");
      const year = parts[0] || "";
      const month = parts[1] || "";
      const type = r.type ? String(r.type).replace(/\n/g, " ") : "";
      const produced = r.produced ?? 0;
      const selfv = r.self ?? 0;
      const note = r.note ? String(r.note).replace(/\n/g, " ") : "";
      csv += `${year},${month},${type},${produced},${selfv},${note}\n`;
    });
    downloadText("autoproduzione_export.csv", csv, "text/csv");
    log("Esportato CSV autoproduzione");
  }

  // Export current gas users data to CSV
  function exportGasCsv() {
    let csv = "name,type,power_kw,eff,hoursYear,util,note\n";
    state.gasUsers.forEach((u) => {
      if (!u) return;
      const name = u.name ? String(u.name).replace(/\n/g, " ") : "";
      const type = u.type ? String(u.type).replace(/\n/g, " ") : "";
      const power = u.power ?? 0;
      const eff = u.eff ?? "";
      const hoursYear = u.hoursYear ?? 0;
      const util = u.util ?? "";
      const note = u.note ? String(u.note).replace(/\n/g, " ") : "";
      csv += `${name},${type},${power},${eff},${hoursYear},${util},${note}\n`;
    });
    downloadText("impianti_termici_export.csv", csv, "text/csv");
    log("Esportato CSV impianti termici");
  }

  // ---------- Parse and import machines from CSV ----------
  function parseMachineCsvRows(rows) {
    const out = [];
    for (const row of rows) {
      const map = {};
      Object.keys(row || {}).forEach(k => {
        map[normalizeHeader(k)] = row[k];
      });
      const name = map["name"] || map["nome"] || map["macchinario"];
      const kW = safeFloat(map["kw"]);
      const hoursYear = safeFloat(map["hoursyear"]) ?? safeFloat(map["oreanno"]) ?? safeFloat(map["ore_anno"]);
      const eff = safeFloat(map["eff"]) ?? safeFloat(map["rendimento"]) ?? 1;
      const util = safeFloat(map["util"]) ?? safeFloat(map["utilizzo"]) ?? 1;
      const cf = safeFloat(map["consfactor"]) ?? safeFloat(map["fattorecons"]) ?? safeFloat(map["fattore_consumo"]) ?? 1;
      const note = map["note"] || map["descrizione"] || "";
      if (!name || kW === null || hoursYear === null) continue;
      out.push({ name, kW, hoursYear, eff, util, consFactor: cf, note });
    }
    return out;
  }


  async function processPdfFiles(files) {
    ensurePdfJs();
    const total = files.length;
    let done = 0;
    for (const file of files) {
      done++;
      setProgress(Math.round((done - 1) / total * 100), `Apro ${file.name}…`);
      const row = await extractFromSinglePdf(file);
      pdfExtractRows.push(...row);
      renderPdfExtractTable();
      $("#btnConfirmPDFExtract").disabled = pdfExtractRows.length === 0;
      $("#btnClearPDFExtract").disabled = pdfExtractRows.length === 0;
      setProgress(Math.round(done / total * 100), `Completato ${file.name}`);
    }
    hideProgress();
    log(`Estrazione PDF completata: ${files.length} file`);
  }

  async function extractFromSinglePdf(file) {
    const pdfjs = ensurePdfJs();
    const rows = [];
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: ab }).promise;
      const numPages = pdf.numPages;

      // Try text extraction first (first 2 pages usually enough)
      let text = "";
      const maxTextPages = Math.min(numPages, 2);
      for (let p = 1; p <= maxTextPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = tc.items.map(it => it.str).join(" ");
        text += "\n" + pageText;
      }

      let method = "testo";
      let extracted = extractFasce(text);
      let month = extractMonth(text, state.project.year);

      // If text weak, do OCR
      const weak = !extracted.ok || (String(text).length < 120);
      if (weak) {
        method = "OCR";
        setProgress(0, `OCR in corso: ${file.name}…`);
        const ocrText = await ocrFirstPages(pdf, file.name);
        text = ocrText;
        extracted = extractFasce(text);
        month = month || extractMonth(text, state.project.year);
      }

      const row = {
        source: file.name,
        month: month || "",
        f1: extracted.f1 ?? "",
        f2: extracted.f2 ?? "",
        f3: extracted.f3 ?? "",
        method,
        status: extracted.ok ? "OK (verifica consigliata)" : "Da verificare"
      };
      rows.push(row);
      return rows;
    } catch (e) {
      console.error("PDF error:", e);
      rows.push({
        source: file.name,
        month: "",
        f1: "",
        f2: "",
        f3: "",
        method: "—",
        status: "Errore lettura"
      });
      return rows;
    }
  }

  async function ocrFirstPages(pdf, label) {
    // OCR first pages (max 2) for speed
    const maxPages = Math.min(pdf.numPages, 2);
    let all = "";
    for (let p = 1; p <= maxPages; p++) {
      setProgress(Math.round((p - 1) / maxPages * 100), `OCR pagina ${p}/${maxPages} — ${label}`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const text = await Tesseract.recognize(canvas, "ita", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            const pct = Math.round((p - 1) / maxPages * 100 + (m.progress || 0) * (100 / maxPages));
            setProgress(clamp(pct, 0, 100), `OCR… ${Math.round((m.progress || 0) * 100)}% — ${label}`);
          }
        }
      }).then(r => r.data.text || "");
      all += "\n" + text;
    }
    setProgress(100, `OCR completato — ${label}`);
    return all;
  }

  function extractFasce(rawText) {
    const text = normalizeText(rawText);

    // patterns: "F1 1234 kWh", "F1: 1234", "kWh F1 1234", "F1 (kWh) 1234"
    const patterns = [
      { key: "f1", rx: /(?:\bF1\b[\s:=-]*)([\d\.\,]+)\s*(?:kwh|k\s*wh)?/i },
      { key: "f2", rx: /(?:\bF2\b[\s:=-]*)([\d\.\,]+)\s*(?:kwh|k\s*wh)?/i },
      { key: "f3", rx: /(?:\bF3\b[\s:=-]*)([\d\.\,]+)\s*(?:kwh|k\s*wh)?/i },
      { key: "f1b", rx: /([\d\.\,]+)\s*(?:kwh|k\s*wh)\s*(?:\bF1\b)/i },
      { key: "f2b", rx: /([\d\.\,]+)\s*(?:kwh|k\s*wh)\s*(?:\bF2\b)/i },
      { key: "f3b", rx: /([\d\.\,]+)\s*(?:kwh|k\s*wh)\s*(?:\bF3\b)/i },
    ];

    function matchF(rx) {
      const m = text.match(rx);
      if (!m) return null;
      return safeFloat(m[1]);
    }

    let f1 = matchF(patterns[0].rx) ?? matchF(patterns[3].rx);
    let f2 = matchF(patterns[1].rx) ?? matchF(patterns[4].rx);
    let f3 = matchF(patterns[2].rx) ?? matchF(patterns[5].rx);

    const ok = [f1, f2, f3].every(v => v !== null && Number.isFinite(v));
    return { ok, f1, f2, f3 };
  }

  function normalizeText(t) {
    return String(t || "")
      .replace(/\u00A0/g, " ")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractMonth(text, fallbackYear) {
    const t = String(text || "");
    // 1) Try date range dd/mm/yyyy ... dd/mm/yyyy
    const dates = Array.from(t.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)).map(m => ({
      d: Number(m[1]), m: Number(m[2]), y: Number(m[3])
    }));
    if (dates.length >= 1) {
      // choose the first date as period start
      const d0 = dates[0];
      const mm = String(d0.m).padStart(2, "0");
      return `${d0.y}-${mm}`;
    }

    // 2) Italian month names + year
    const months = {
      "gennaio": "01", "febbraio": "02", "marzo": "03", "aprile": "04",
      "maggio": "05", "giugno": "06", "luglio": "07", "agosto": "08",
      "settembre": "09", "ottobre": "10", "novembre": "11", "dicembre": "12"
    };
    for (const [name, num] of Object.entries(months)) {
      const rx = new RegExp(`\\b${name}\\b\\s*(\\d{4})`, "i");
      const m = t.match(rx);
      if (m) return `${m[1]}-${num}`;
    }

    // 3) "MM-YYYY" or "MM/YYYY"
    const m3 = t.match(/\b(0?[1-9]|1[0-2])[-\/](\d{4})\b/);
    if (m3) {
      const mm = String(Number(m3[1])).padStart(2, "0");
      return `${m3[2]}-${mm}`;
    }

    // 4) If only month number appears with fallback year (rare)
    if (fallbackYear) {
      const m4 = t.match(/\b(0?[1-9]|1[0-2])\b/);
      if (m4) {
        const mm = String(Number(m4[1])).padStart(2, "0");
        return `${fallbackYear}-${mm}`;
      }
    }

    return null;
  }

  function renderPdfExtractTable() {
    const tbody = $("#pdfExtractTable tbody");
    tbody.innerHTML = "";
    if (pdfExtractRows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted small">Carica uno o più PDF per vedere i risultati.</td>`;
      tbody.appendChild(tr);
      return;
    }

    pdfExtractRows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(r.source)}</b></td>
        <td><input class="miniinput" data-k="month" data-i="${idx}" value="${escapeAttr(r.month || "")}" placeholder="YYYY-MM"></td>
        <td><input class="miniinput" data-k="f1" data-i="${idx}" value="${escapeAttr(r.f1 ?? "")}" placeholder="kWh"></td>
        <td><input class="miniinput" data-k="f2" data-i="${idx}" value="${escapeAttr(r.f2 ?? "")}" placeholder="kWh"></td>
        <td><input class="miniinput" data-k="f3" data-i="${idx}" value="${escapeAttr(r.f3 ?? "")}" placeholder="kWh"></td>
        <td><small>${escapeHtml(r.method || "")}</small></td>
        <td><small>${escapeHtml(r.status || "")}</small></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("input.miniinput").forEach(inp => {
      inp.addEventListener("input", () => {
        const i = Number(inp.dataset.i);
        const k = inp.dataset.k;
        if (!pdfExtractRows[i]) return;
        pdfExtractRows[i][k] = inp.value;
      });
    });
  }

  // ---------- Machines ----------
  function uid() {
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  function computeHoursYear(hoursYear, hoursDay, daysYear) {
    const hy = safeFloat(hoursYear);
    if (hy !== null) return hy;
    const hd = safeFloat(hoursDay);
    const dy = safeFloat(daysYear);
    if (hd !== null && dy !== null) return hd * dy;
    return null;
  }

  function normEff(eff) {
    let e = safeFloat(eff);
    if (e === null) return 1;
    if (e > 1.5) e = e / 100; // treat as %
    e = clamp(e, 0.05, 1.0);
    return e;
  }

  function computeMachineKwh(m) {
    const kW = safeFloat(m.kW) ?? 0;
    const eff = normEff(m.eff);
    const hours = safeFloat(m.hoursYear) ?? 0;
    const util = clamp(safeFloat(m.util) ?? 1, 0, 1);
    const cf = safeFloat(m.consFactor) ?? 1;
    if (eff <= 0) return 0;
    const kwh = (kW * hours * util * cf) / eff;
    return round2(kwh);
  }

  $("#btnAddMachine").addEventListener("click", async () => {
    const name = $("#mName").value.trim();
    if (!name) { alert("Inserisci un nome macchinario."); return; }

    const kW = safeFloat($("#mKW").value);
    const eff = $("#mEff").value;
    const hoursYear = computeHoursYear($("#mHoursYear").value, $("#mHoursDay").value, $("#mDaysYear").value);
    const util = safeFloat($("#mUtil").value);
    const cf = safeFloat($("#mConsFactor").value);

    if (kW === null || hoursYear === null) {
      alert("Inserisci almeno kW e ore annue (oppure ore/giorno + giorni/anno).");
      return;
    }
    const machine = {
      id: uid(),
      name,
      kW,
      eff: eff === "" ? 1 : safeFloat(eff) ?? 1,
      hoursYear,
      util: util === null ? 1 : util,
      consFactor: cf === null ? 1 : cf,
      note: $("#mNote").value.trim()
    };
    state.machines.push(machine);
    log(`Aggiunto macchinario: ${name}`);
    persist();
    renderMachineTable();
    refreshDashboard();
    $("#btnClearMachine").click();
  });

  $("#btnClearMachine").addEventListener("click", () => {
    $("#mName").value = "";
    $("#mKW").value = "";
    $("#mEff").value = "";
    $("#mHoursYear").value = "";
    $("#mHoursDay").value = "";
    $("#mDaysYear").value = "";
    $("#mUtil").value = "";
    $("#mConsFactor").value = "";
    $("#mNote").value = "";
  });

  function renderMachineTable() {
    const tbody = $("#machineTable tbody");
    tbody.innerHTML = "";
    if (state.machines.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" class="muted small">Nessun macchinario inserito.</td>`;
      tbody.appendChild(tr);
      return;
    }
    state.machines.forEach(m => {
      const kwh = computeMachineKwh(m);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(m.name)}</b><br><small>${escapeHtml(m.note || "")}</small></td>
        <td>${fmtNumber(m.kW)}</td>
        <td>${fmtNumber(m.hoursYear)}</td>
        <td>${fmtNumber(m.util ?? 1)}</td>
        <td>${fmtNumber(m.consFactor ?? 1)}</td>
        <td>${fmtNumber(normEff(m.eff))}</td>
        <td><b>${fmtNumber(kwh)}</b></td>
        <td>
          <button class="ghost smallbtn" data-act="del" data-id="${m.id}">Elimina</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const ok = await confirmModal("Eliminare macchinario?", "Confermi eliminazione?", "Elimina", "Annulla");
        if (!ok) return;
        const m = state.machines.find(x => x.id === id);
        state.machines = state.machines.filter(x => x.id !== id);
        log(`Eliminato macchinario: ${m?.name || id}`);
        persist();
        renderMachineTable();
        refreshDashboard();
      });
    });
  }

  // ---------- Dashboard & Report ----------
  let chartMonthly = null;
  let chartShare = null;
  let chartMonthlyReport = null;
  let chartShareReport = null;
  let chartUtilityDetail = null;

  function monthsOfYear(year) {
    const arr = [];
    for (let m = 1; m <= 12; m++) arr.push(`${year}-${String(m).padStart(2, "0")}`);
    return arr;
  }

  function aggregateEnergy() {
    const y = state.ui.selectedYear || state.project.year || new Date().getFullYear();
    const months = monthsOfYear(y);
    const byMonth = {};
    months.forEach(m => byMonth[m] = { f1: 0, f2: 0, f3: 0, gas: 0 });
    
    // Aggrega dati da tutte le utenze
    for (const util of state.utilities) {
      const utilData = state.energyByYear[y]?.[util.id] || [];
      for (const r of utilData) {
        if (!r.month || !r.month.startsWith(String(y))) continue;
        if (!byMonth[r.month]) byMonth[r.month] = { f1: 0, f2: 0, f3: 0, gas: 0 };
        if (util.type === 'electricity') {
          byMonth[r.month].f1 += safeFloat(r.data.f1) ?? 0;
          byMonth[r.month].f2 += safeFloat(r.data.f2) ?? 0;
          byMonth[r.month].f3 += safeFloat(r.data.f3) ?? 0;
        } else {
          byMonth[r.month].gas += safeFloat(r.data.gas) ?? 0;
        }
      }
    }
    
    const series = months.map(m => ({ month: m, ...byMonth[m] }));
    const total = series.reduce((acc, x) => {
      acc.f1 += x.f1; acc.f2 += x.f2; acc.f3 += x.f3; acc.gas += x.gas;
      return acc;
    }, { f1: 0, f2: 0, f3: 0, gas: 0 });
    total.tot = total.f1 + total.f2 + total.f3 + total.gas;
    return { months, series, total };
  }

  function sumMachines() {
    return state.machines.reduce((acc, m) => acc + computeMachineKwh(m), 0);
  }

  function refreshDashboard() {
    const ag = aggregateEnergy();
    $("#kpiF1").textContent = fmtNumber(ag.total.f1);
    $("#kpiF2").textContent = fmtNumber(ag.total.f2);
    $("#kpiF3").textContent = fmtNumber(ag.total.f3);
    $("#kpiGas").textContent = fmtNumber(ag.total.gas);
    $("#kpiTot").textContent = fmtNumber(ag.total.tot);
    
    // Calcola Potenza Attiva media e cos φ medio
    const year = state.ui.selectedYear || new Date().getFullYear();
    let totalPotenza = 0;
    let totalCosfi = 0;
    let countPotenza = 0;
    let countCosfi = 0;
    
    for (const util of state.utilities) {
      if (util.type !== 'electricity') continue;
      const yearData = state.energyByYear[year]?.[util.id] || [];
      for (const r of yearData) {
        if (r.data?.potenza !== undefined && r.data.potenza !== null && r.data.potenza !== 0) {
          totalPotenza += r.data.potenza;
          countPotenza++;
        }
        if (r.data?.cosfi !== undefined && r.data.cosfi !== null && r.data.cosfi !== 0) {
          totalCosfi += r.data.cosfi;
          countCosfi++;
        }
      }
    }
    
    const avgPotenza = countPotenza > 0 ? totalPotenza / countPotenza : 0;
    const avgCosfi = countCosfi > 0 ? totalCosfi / countCosfi : 0;
    
    const kpiPotenza = $("#kpiPotenza");
    if (kpiPotenza) kpiPotenza.textContent = avgPotenza > 0 ? fmtNumber(avgPotenza) : "—";
    
    const kpiCosfi = $("#kpiCosfi");
    if (kpiCosfi) kpiCosfi.textContent = avgCosfi > 0 ? fmtNumber(avgCosfi) : "—";

    const bills = ag.total.tot;
    const mach = sumMachines();
    $("#kpiBills").textContent = fmtNumber(bills);
    $("#kpiMachines").textContent = fmtNumber(mach);
    const delta = bills - mach;
    $("#kpiDelta").textContent = `${fmtNumber(delta)} kWh`;
    // rapporto percentuale macchinari/bollette
    let ratio = null;
    if (bills && Number.isFinite(bills) && bills !== 0) {
      ratio = (mach / bills) * 100;
    }
    const ratioEl = $("#kpiRatio");
    if (ratioEl) {
      ratioEl.textContent = ratio !== null ? `${fmtNumber(ratio)} %` : "—";
    }

    renderCharts(ag);
    updateReportPreview();
    refreshInstallStatus();
  }

  function renderCharts(ag) {
    const labels = ag.months.map(m => m.slice(5)); // month number
    const f1 = ag.series.map(x => round2(x.f1));
    const f2 = ag.series.map(x => round2(x.f2));
    const f3 = ag.series.map(x => round2(x.f3));
    const gas = ag.series.map(x => round2(x.gas));

    // Monthly (stacked bar)
    if (chartMonthly) chartMonthly.destroy();
    chartMonthly = new Chart($("#chartMonthly"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "F1", data: f1, stack: "kwh" },
          { label: "F2", data: f2, stack: "kwh" },
          { label: "F3", data: f3, stack: "kwh" },
          { label: "Gas", data: gas, stack: "kwh" },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    });

    // Share (doughnut)
    if (chartShare) chartShare.destroy();
    chartShare = new Chart($("#chartShare"), {
      type: "doughnut",
      data: {
        labels: ["F1", "F2", "F3", "Gas"],
        datasets: [{ data: [round2(ag.total.f1), round2(ag.total.f2), round2(ag.total.f3), round2(ag.total.gas)] }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });

    // Report charts (separati)
    if (chartMonthlyReport) chartMonthlyReport.destroy();
    chartMonthlyReport = new Chart($("#chartMonthlyReport"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "F1", data: f1, stack: "kwh" },
          { label: "F2", data: f2, stack: "kwh" },
          { label: "F3", data: f3, stack: "kwh" },
          { label: "Gas", data: gas, stack: "kwh" },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    });

    if (chartShareReport) chartShareReport.destroy();
    chartShareReport = new Chart($("#chartShareReport"), {
      type: "doughnut",
      data: {
        labels: ["F1", "F2", "F3", "Gas"],
        datasets: [{ data: [round2(ag.total.f1), round2(ag.total.f2), round2(ag.total.f3), round2(ag.total.gas)] }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  function renderUtilityDetailChart() {
    // Renderizza grafico di dettaglio per la singola utenza selezionata
    const utilId = state.ui.selectedUtility;
    if (!utilId) return;
    
    const util = state.utilities.find(u => u.id === utilId);
    if (!util) return;
    
    const year = state.ui.selectedYear || new Date().getFullYear();
    const months = monthsOfYear(year);
    const yearData = state.energyByYear[year]?.[util.id] || [];
    
    const container = $("#monthsGridContainer");
    if (!container) return;
    
    // Crea dati per il grafico
    const data = months.map(month => {
      const rec = yearData.find(r => r.month === month);
      if (!rec) return 0;
      
      if (util.type === 'electricity') {
        const f1 = rec.data?.f1 || 0;
        const f2 = rec.data?.f2 || 0;
        const f3 = rec.data?.f3 || 0;
        return f1 + f2 + f3;
      } else {
        return rec.data?.gas || 0;
      }
    });
    
    const labels = months.map(m => m.slice(5));
    const unit = util.type === 'electricity' ? 'kWh' : 'SmC';
    const color = util.type === 'electricity' ? 'rgba(96,165,250,0.7)' : 'rgba(52,211,153,0.7)';
    
    // Se non esiste il canvas per il grafico utility, non lo visualizziamo
    // ma il grafico principale nella dashboard si aggiornerà comunque
  }

  function updateReportPreview() {
    const ag = aggregateEnergy();
    $("#rTitle").textContent = state.project.name || "OpenEurope — Report";
    const site = state.project.site ? ` • ${state.project.site}` : "";
    $("#rSub").textContent = `Profilo consumi per fasce (F1/F2/F3) e gas${site}`;
    $("#rGenerated").textContent = new Date().toLocaleString("it-IT");
    $("#rYear").textContent = String(state.project.year || "");

    $("#rF1").textContent = `${fmtNumber(ag.total.f1)} kWh`;
    $("#rF2").textContent = `${fmtNumber(ag.total.f2)} kWh`;
    $("#rF3").textContent = `${fmtNumber(ag.total.f3)} kWh`;
    $("#rGas").textContent = `${fmtNumber(ag.total.gas)} kWh`;
    $("#rTot").textContent = `${fmtNumber(ag.total.tot)} kWh`;

    // Machines table in report
    const tbody = $("#reportMachineTable tbody");
    tbody.innerHTML = "";
    if (state.machines.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted small">Nessun macchinario inserito.</td>`;
      tbody.appendChild(tr);
    } else {
      state.machines.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><b>${escapeHtml(m.name)}</b></td>
          <td>${fmtNumber(m.kW)}</td>
          <td>${fmtNumber(m.hoursYear)}</td>
          <td>${fmtNumber(m.util ?? 1)}</td>
          <td>${fmtNumber(m.consFactor ?? 1)}</td>
          <td>${fmtNumber(normEff(m.eff))}</td>
          <td><b>${fmtNumber(computeMachineKwh(m))}</b></td>
        `;
        tbody.appendChild(tr);
      });
    }

    const notes = state.project.notes?.trim() || "—";
    $("#rNotes").textContent = notes;
  }

  // ---------- Export / Import ----------
  $("#btnExportJSON").addEventListener("click", () => {
    const payload = JSON.stringify(state, null, 2);
    const fn = `OpenEurope_${(state.project.name || "progetto").replace(/[^\w\-]+/g, "_")}.json`;
    downloadText(fn, payload, "application/json");
    log("Esportati dati progetto (JSON)");
  });

  $("#fileImportJSON").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const obj = JSON.parse(txt);
      if (!obj.project || !obj.ui) throw new Error("Formato non valido");
      // merge
      state.ui = obj.ui || state.ui;
      state.project = obj.project || state.project;
      state.energy = Array.isArray(obj.energy) ? obj.energy : [];
      state.machines = Array.isArray(obj.machines) ? obj.machines : [];
      state.log = Array.isArray(obj.log) ? obj.log : [];
      persist();
      bindProjectUI();
      renderEnergyTable();
      renderMachineTable();
      refreshDashboard();
      setActiveStep(state.ui.step || 1);
      setTab(state.ui.tab || "manual");
      log(`Importato progetto JSON: ${file.name}`);
    } catch (e) {
      console.error(e);
      alert("Errore: file JSON non valido.");
    } finally {
      ev.target.value = "";
    }
  });

  $("#btnExportPDF").addEventListener("click", async () => {
    updateReportPreview();
    const name = (state.project.name || "OpenEurope_Report").replace(/[^\w\-]+/g, "_");
    const filename = `${name}_${state.project.year || ""}.pdf`;
    log("Avviata esportazione report PDF");
    await exportReportPDF(filename);
  });

  async function exportReportPDF(filename) {
    const el = $("#reportArea");
    // Ensure charts are rendered before capture
    await new Promise(r => setTimeout(r, 250));
    const opt = {
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    try {
      await html2pdf().set(opt).from(el).save();
      log(`Report PDF generato: ${filename}`);
    } catch (e) {
      console.error(e);
      alert("Errore durante l'esportazione PDF. Prova con Chrome/Edge.");
    }
  }

  // ---------- Audit log ----------
  function renderLog() {
    const box = $("#auditLog");
    box.innerHTML = "";
    if (state.log.length === 0) {
      box.innerHTML = `<div class="item"><div class="muted">Nessun evento.</div></div>`;
      return;
    }
    state.log.slice(0, 250).forEach(item => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<div>${escapeHtml(item.msg)}</div><div class="ts">${escapeHtml(new Date(item.ts).toLocaleString("it-IT"))}</div>`;
      box.appendChild(div);
    });
  }

  $("#btnClearLog").addEventListener("click", async () => {
    const ok = await confirmModal("Svuotare audit log?", "Confermi la cancellazione del log?", "Svuota", "Annulla");
    if (!ok) return;
    state.log = [];
    persist();
    renderLog();
  });

  // ---------- Navigation wiring ----------
  const stepButtons = $$(".step");
  console.log("Found " + stepButtons.length + " step buttons");
  stepButtons.forEach(btn => {
    console.log("Attaching listener to button with data-step:", btn.dataset.step);
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.step);
      console.log("Step button clicked:", step);
      setActiveStep(step);
    });
  });

  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      console.log("Tab button clicked:", tab);
      setTab(tab);
    });
  });

  // ---------- Minor UI helpers ----------
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  // ---------- Init ----------
  // Set year default in UI if empty
  if (!state.project.year) state.project.year = new Date().getFullYear();
  bindProjectUI();
  bindCompanyUI();
  renderUtilitiesTable();
  refreshManualUtilitySelector();
  updateManualFieldsForUtility();
  renderEnergyTable();
  renderMachineTable();
  // render autoproduzione e impianti termici all'avvio
  renderAutoTable();
  renderGasTable();

  // Restore UI
  setActiveStep(state.ui.step || 1);
  setTab(state.ui.tab || "manual");
  // Imposta le tab per autoproduzione e gas
  setAutoTab('manual');
  setGasTab('manual');

  // Refresh year UI and set manual month default to Jan of selected year
  refreshEnergyYearUI();
  const y = state.ui.selectedYear || state.project.year || new Date().getFullYear();
  if (!$("#manualMonth").value) $("#manualMonth").value = `${y}-01`;

  // Add some CSS for small buttons without making a whole style system
  const style = document.createElement("style");
  style.textContent = `.smallbtn{padding:6px 8px;border-radius:10px;font-weight:800;font-size:12px}`;
  document.head.appendChild(style);

  // Wire up export CSV buttons (if present)
  const exportEnergyBtn = document.getElementById("btnExportEnergyCsv");
  if (exportEnergyBtn) exportEnergyBtn.addEventListener("click", () => {
    exportEnergyCsv();
  });
  const exportAutoBtn = document.getElementById("btnExportAutoCsv");
  if (exportAutoBtn) exportAutoBtn.addEventListener("click", () => {
    exportAutoCsv();
  });
  const exportGasBtn = document.getElementById("btnExportGasCsv");
  if (exportGasBtn) exportGasBtn.addEventListener("click", () => {
    exportGasCsv();
  });

  const refreshInstallBtn = document.getElementById("btnRefreshInstall");
  if (refreshInstallBtn) refreshInstallBtn.addEventListener("click", () => {
    refreshInstallStatus();
  });
  const openInstallerBtn = document.getElementById("btnOpenInstaller");
  if (openInstallerBtn) openInstallerBtn.addEventListener("click", () => {
    window.open("http://localhost:9999", "_blank", "noopener");
  });

})();
