import { useEffect, useState, useMemo } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";
const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1n2Y-ODl1AhIs_dRAUfa-sWTrSJFKttzrQMZl0f6gD3Y/edit?gid=0#gid=0";

function App() {
  const [pcs, setPcs] = useState([]);
  const [selectedPc, setSelectedPc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Connecting and scanning system specifications...");
  const [statusType, setStatusType] = useState("info"); // 'info' | 'success' | 'error'
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState("");

  const [formData, setFormData] = useState({
    pc_name: "",
    username: "",
    windows: "",
    cpu: "",
    ram: "",
    gpu: "",
    disk: "",
    manufacturer: "",
    model: "",
    ip_address: "",
  });

  // Requirement: "As we press link it should show computer details and store that in sheet"
  // So automatically trigger scan and store on initial page load!
  useEffect(() => {
    initApp();
  }, []);

  const showNotification = (msg, type = "info") => {
    setStatusMessage(msg);
    setStatusType(type);
  };

  const initApp = async () => {
    setScanning(true);
    showNotification("Detecting computer hardware details & saving to sheet...", "info");
    try {
      // 1. Trigger scan and save
      const scanRes = await fetch(`${API_BASE}/api/scan-and-save`, { method: "POST" });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        setServerOnline(true);
        if (scanData.specs) {
          setSelectedPc(scanData.specs);
          showNotification(
            `Computer details for '${scanData.specs.pc_name}' loaded and saved to sheet successfully!`,
            "success"
          );
        }
      } else {
        setServerOnline(true);
      }
    } catch (err) {
      setServerOnline(false);
      showNotification(
        `Unable to reach backend at ${API_BASE}. Please ensure FastAPI is running.`,
        "error"
      );
    } finally {
      setScanning(false);
      fetchPcs();
      fetchConfig();
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.webhook_url) setWebhookUrl(cfg.webhook_url);
      }
    } catch {}
  };

  const saveWebhook = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_sheet_url: GOOGLE_SHEET_URL,
          webhook_url: webhookUrl,
        }),
      });
      if (res.ok) {
        setWebhookStatus("Webhook URL saved successfully!");
        setTimeout(() => setWebhookStatus(""), 3000);
      }
    } catch (e) {
      setWebhookStatus("Error saving webhook.");
    }
  };

  const fetchPcs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pcs`);
      if (res.ok) {
        const data = await res.json();
        setServerOnline(true);
        if (data.pcs) {
          setPcs(data.pcs);
          if (!selectedPc && data.pcs.length > 0) {
            setSelectedPc(data.pcs[0]);
          }
        }
      }
    } catch {
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const scanCurrentPc = async () => {
    setScanning(true);
    showNotification("Scanning computer specifications...", "info");
    try {
      const res = await fetch(`${API_BASE}/api/scan-and-save`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Scan failed (${res.status})`);
      }
      const result = await res.json();
      setSelectedPc(result.specs);
      showNotification(
        `Computer '${result.specs.pc_name}' scanned and saved to sheet successfully!`,
        "success"
      );
      fetchPcs();
    } catch (err) {
      showNotification(`Scan error: ${err.message}`, "error");
    } finally {
      setScanning(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pc_name.trim()) {
      showNotification("PC Name is required.", "error");
      return;
    }

    setLoading(true);
    showNotification("Saving computer specifications...", "info");
    try {
      const res = await fetch(`${API_BASE}/save-pc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save PC");
      }

      const result = await res.json();
      showNotification(result.message || "PC specifications stored successfully.", "success");
      setSelectedPc(formData);
      setShowManualForm(false);
      setFormData({
        pc_name: "",
        username: "",
        windows: "",
        cpu: "",
        ram: "",
        gpu: "",
        disk: "",
        manufacturer: "",
        model: "",
        ip_address: "",
      });
      fetchPcs();
    } catch (err) {
      showNotification(`Save error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePc = async (pcName) => {
    if (!window.confirm(`Are you sure you want to remove '${pcName}' from the sheet?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/pcs/${encodeURIComponent(pcName)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to delete");
      }
      showNotification(`'${pcName}' removed successfully.`, "success");
      if (selectedPc?.pc_name === pcName) {
        setSelectedPc(null);
      }
      fetchPcs();
    } catch (err) {
      showNotification(`Delete error: ${err.message}`, "error");
    }
  };

  const downloadExcel = () => {
    window.open(`${API_BASE}/download-excel`, "_blank");
  };

  const openGoogleSheet = () => {
    window.open(GOOGLE_SHEET_URL, "_blank");
  };

  const filteredPcs = useMemo(() => {
    if (!searchQuery.trim()) return pcs;
    const q = searchQuery.toLowerCase();
    return pcs.filter(
      (p) =>
        (p.pc_name || "").toLowerCase().includes(q) ||
        (p.username || "").toLowerCase().includes(q) ||
        (p.cpu || "").toLowerCase().includes(q) ||
        (p.windows || "").toLowerCase().includes(q) ||
        (p.manufacturer || "").toLowerCase().includes(q) ||
        (p.ip_address || "").toLowerCase().includes(q)
    );
  }, [pcs, searchQuery]);

  return (
    <div className="container">
      {/* Top Header */}
      <header className="header">
        <div className="header-title">
          <h1>PC Specifications & Inventory</h1>
          <p className="subtitle">
            Automatic Hardware Specification Collector & Sheet Storage
          </p>
        </div>
        <div className="header-actions">
          <span
            className={`server-status-badge ${
              serverOnline === true
                ? "online"
                : serverOnline === false
                ? "offline"
                : "checking"
            }`}
          >
            {serverOnline === true
              ? "● Backend Connected"
              : serverOnline === false
              ? "● Backend Offline"
              : "○ Checking..."}
          </span>

          {/* Primary Google Sheet Link Button */}
          <button className="btn btn-google-sheet" onClick={openGoogleSheet}>
            <span className="sheet-icon">📊</span> Open Google Sheet
          </button>

          <button
            className="btn btn-primary"
            onClick={scanCurrentPc}
            disabled={scanning || serverOnline === false}
          >
            {scanning ? "Scanning..." : "Re-Scan This PC"}
          </button>

          <button
            className="btn btn-secondary"
            onClick={downloadExcel}
            disabled={serverOnline === false}
          >
            Download Excel (.xlsx)
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            {showManualForm ? "Close Form" : "Add Manually"}
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setShowSyncModal(!showSyncModal)}
            title="Configure Google Sheet Sync"
          >
            ⚙ Sheet Sync
          </button>

          <button
            className="btn btn-icon"
            onClick={fetchPcs}
            disabled={loading}
            title="Refresh Data"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {statusMessage && (
        <div className={`notification ${statusType}`}>
          <span>{statusMessage}</span>
          <button
            className="notification-close"
            onClick={() => setStatusMessage("")}
          >
            ×
          </button>
        </div>
      )}

      {/* Google Sheet Sync Modal / Settings */}
      {showSyncModal && (
        <section className="manual-form-card sync-box">
          <h2>Google Sheet Direct Cloud Sync</h2>
          <p className="hint">
            Target Google Sheet:{" "}
            <a href={GOOGLE_SHEET_URL} target="_blank" rel="noreferrer">
              {GOOGLE_SHEET_URL}
            </a>
          </p>
          <div className="form-group" style={{ marginTop: "12px" }}>
            <label>Google Apps Script Webhook URL (Optional for direct cloud appending):</label>
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={saveWebhook}>
              Save Webhook
            </button>
            <button className="btn btn-outline" onClick={() => setShowSyncModal(false)}>
              Close
            </button>
          </div>
          {webhookStatus && <p className="success" style={{ marginTop: 8 }}>{webhookStatus}</p>}

          <div className="apps-script-guide">
            <strong>How to set up direct Google Sheet appending:</strong>
            <ol>
              <li>Open your Google Sheet and click <em>Extensions &gt; Apps Script</em>.</li>
              <li>Paste this script and click <em>Deploy &gt; New deployment &gt; Web app (Access: Anyone)</em>:</li>
            </ol>
            <pre>
{`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), d.pc_name, d.username, d.windows, d.cpu, d.ram, d.gpu, d.disk, d.manufacturer, d.model, d.ip_address]);
  return ContentService.createTextOutput(JSON.stringify({result:"ok"})).setMimeType(ContentService.MimeType.JSON);
}`}
            </pre>
          </div>
        </section>
      )}

      {/* Manual Entry Form */}
      {showManualForm && (
        <section className="manual-form-card">
          <h2>Add Computer Specifications Manually</h2>
          <form onSubmit={handleManualSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>PC Name *</label>
                <input
                  type="text"
                  name="pc_name"
                  value={formData.pc_name}
                  onChange={handleFormChange}
                  placeholder="e.g. LAB-PC-01"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  placeholder="e.g. labuser"
                />
              </div>
              <div className="form-group">
                <label>Windows / OS</label>
                <input
                  type="text"
                  name="windows"
                  value={formData.windows}
                  onChange={handleFormChange}
                  placeholder="e.g. Windows 10 Pro"
                />
              </div>
              <div className="form-group">
                <label>CPU</label>
                <input
                  type="text"
                  name="cpu"
                  value={formData.cpu}
                  onChange={handleFormChange}
                  placeholder="e.g. Intel Core i5-11400"
                />
              </div>
              <div className="form-group">
                <label>RAM</label>
                <input
                  type="text"
                  name="ram"
                  value={formData.ram}
                  onChange={handleFormChange}
                  placeholder="e.g. 16.00 GB"
                />
              </div>
              <div className="form-group">
                <label>GPU</label>
                <input
                  type="text"
                  name="gpu"
                  value={formData.gpu}
                  onChange={handleFormChange}
                  placeholder="e.g. NVIDIA GeForce RTX 3060"
                />
              </div>
              <div className="form-group">
                <label>Disk</label>
                <input
                  type="text"
                  name="disk"
                  value={formData.disk}
                  onChange={handleFormChange}
                  placeholder="e.g. 512 GB"
                />
              </div>
              <div className="form-group">
                <label>Manufacturer</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleFormChange}
                  placeholder="e.g. Dell Inc."
                />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleFormChange}
                  placeholder="e.g. OptiPlex 7090"
                />
              </div>
              <div className="form-group">
                <label>IP Address</label>
                <input
                  type="text"
                  name="ip_address"
                  value={formData.ip_address}
                  onChange={handleFormChange}
                  placeholder="e.g. 192.168.1.100"
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowManualForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Saving..." : "Save to Sheet"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Layout Grid */}
      <div className="main-layout">
        {/* Computer Details Card */}
        <section className="detail-section">
          <div className="section-header">
            <h2>Computer Details</h2>
            {selectedPc && (
              <span className="badge-highlight">{selectedPc.pc_name}</span>
            )}
          </div>

          {selectedPc ? (
            <div className="card">
              <div className="card-row">
                <strong>PC Name</strong>
                <span>{selectedPc.pc_name || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>Username</strong>
                <span>{selectedPc.username || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>Windows</strong>
                <span>{selectedPc.windows || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>CPU</strong>
                <span>{selectedPc.cpu || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>RAM</strong>
                <span>{selectedPc.ram || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>GPU</strong>
                <span>{selectedPc.gpu || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>Disk</strong>
                <span>{selectedPc.disk || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>Manufacturer</strong>
                <span>{selectedPc.manufacturer || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>Model</strong>
                <span>{selectedPc.model || "N/A"}</span>
              </div>
              <div className="card-row">
                <strong>IP Address</strong>
                <span>{selectedPc.ip_address || "N/A"}</span>
              </div>
              {selectedPc.date && (
                <div className="card-row">
                  <strong>Recorded Date</strong>
                  <span className="date-tag">{selectedPc.date}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-card">
              <p>Scanning computer specifications...</p>
              <p className="hint">
                Specifications will appear here automatically.
              </p>
            </div>
          )}

          {/* Direct Sheet Access Box */}
          <div className="sheet-quick-card">
            <h3>Connected Sheet</h3>
            <p>
              All computer specifications are tracked in your workbook:
            </p>
            <button className="btn btn-google-sheet-full" onClick={openGoogleSheet}>
              Open Google Spreadsheet ↗
            </button>
            <p className="sheet-url-text">{GOOGLE_SHEET_URL}</p>
          </div>

          {/* Quick Agent Guide Box */}
          <div className="agent-guide-box">
            <h3>Remote Agent (Other PCs)</h3>
            <p>
              To record specs from other PCs on your local network:
            </p>
            <code>py agent/agent.py http://{window.location.hostname || "localhost"}:8000</code>
          </div>
        </section>

        {/* Saved Sheet Records Table */}
        <section className="inventory-section">
          <div className="inventory-header">
            <div>
              <h2>Sheet Records ({filteredPcs.length})</h2>
              <p className="subtitle-sm">
                Stored in PC_Specs.xlsx and synchronized with Google Sheet
              </p>
            </div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search PCs by name, CPU, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading records...</p>
            </div>
          ) : filteredPcs.length === 0 ? (
            <div className="empty-state">
              <p>No records stored yet.</p>
              <p className="hint">
                Click <strong>"Re-Scan This PC"</strong> to add this computer.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>PC Name</th>
                    <th>User</th>
                    <th>CPU</th>
                    <th>RAM</th>
                    <th>Manufacturer / Model</th>
                    <th>IP</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPcs.map((item, idx) => {
                    const isSelected = selectedPc?.pc_name === item.pc_name;
                    return (
                      <tr
                        key={item.pc_name || idx}
                        className={isSelected ? "selected-row" : ""}
                        onClick={() => setSelectedPc(item)}
                      >
                        <td className="cell-strong">{item.pc_name}</td>
                        <td>{item.username}</td>
                        <td className="cell-truncate" title={item.cpu}>
                          {item.cpu}
                        </td>
                        <td>{item.ram}</td>
                        <td className="cell-truncate" title={`${item.manufacturer} ${item.model}`}>
                          {item.manufacturer} {item.model}
                        </td>
                        <td>{item.ip_address}</td>
                        <td className="cell-date">{item.date}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-delete"
                            title="Delete record"
                            onClick={() => handleDeletePc(item.pc_name)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;