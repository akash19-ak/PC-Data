import { useEffect, useState, useMemo } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  const [pcs, setPcs] = useState([]);
  const [selectedPc, setSelectedPc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); // 'info' | 'success' | 'error'
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);

  // Manual entry form state
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

  // Check server health & load initial list
  useEffect(() => {
    fetchPcs();
  }, []);

  const showNotification = (msg, type = "info") => {
    setStatusMessage(msg);
    setStatusType(type);
  };

  const fetchPcs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pcs`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setServerOnline(true);
      if (data.pcs) {
        setPcs(data.pcs);
        if (data.pcs.length > 0 && !selectedPc) {
          setSelectedPc(data.pcs[0]);
        }
      }
      showNotification("Data loaded successfully from Excel.", "success");
    } catch (err) {
      setServerOnline(false);
      showNotification(
        `Unable to connect to backend server at ${API_BASE}. Please ensure FastAPI is running.`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const scanCurrentPc = async () => {
    setScanning(true);
    showNotification("Collecting hardware and system specifications...", "info");
    try {
      const res = await fetch(`${API_BASE}/api/scan-and-save`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Scan failed (Status: ${res.status})`);
      }
      const result = await res.json();
      setSelectedPc(result.specs);
      showNotification(
        `PC '${result.specs.pc_name}' scanned and saved to Excel successfully.`,
        "success"
      );
      // Reload inventory list
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
    showNotification("Saving PC specifications...", "info");
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
      showNotification(result.message || "PC information saved successfully.", "success");
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
    if (!window.confirm(`Are you sure you want to delete '${pcName}' from Excel?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/pcs/${encodeURIComponent(pcName)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to delete PC");
      }
      showNotification(`PC '${pcName}' removed successfully.`, "success");
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

  // Filtered PC list based on search
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
      {/* Header bar */}
      <header className="header">
        <div className="header-title">
          <h1>PC Specifications Manager</h1>
          <p className="subtitle">Hardware & System Inventory Management</p>
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
          <button
            className="btn btn-primary"
            onClick={scanCurrentPc}
            disabled={scanning || serverOnline === false}
          >
            {scanning ? "Scanning System..." : "Scan Current PC"}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            {showManualForm ? "Close Form" : "Add Manually"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={downloadExcel}
            disabled={serverOnline === false}
          >
            Download Excel (.xlsx)
          </button>
          <button
            className="btn btn-icon"
            onClick={fetchPcs}
            disabled={loading}
            title="Refresh from Excel"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Notification / Status Message */}
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

      {/* Manual Entry Form */}
      {showManualForm && (
        <section className="manual-form-card">
          <h2>Add / Update PC Specification</h2>
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
                  placeholder="e.g. labadmin"
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
                {loading ? "Saving..." : "Save to Excel"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Grid: Detail Card & Excel Table */}
      <div className="main-layout">
        {/* Selected PC Specifications Card */}
        <section className="detail-section">
          <div className="section-header">
            <h2>Specification Details</h2>
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
              <p>No PC selected.</p>
              <p className="hint">
                Click <strong>"Scan Current PC"</strong> above or choose a row from
                the inventory table.
              </p>
            </div>
          )}

          {/* Quick Agent Guide Box */}
          <div className="agent-guide-box">
            <h3>Remote PC Inventory (Agent)</h3>
            <p>
              To record specs from other computers in the network, run the agent
              on those machines:
            </p>
            <code>py agent/agent.py http://{window.location.hostname || "localhost"}:8000</code>
          </div>
        </section>

        {/* Excel Inventory Table */}
        <section className="inventory-section">
          <div className="inventory-header">
            <div>
              <h2>Excel Inventory ({filteredPcs.length})</h2>
              <p className="subtitle-sm">Records saved in PC_Specs.xlsx</p>
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
              <p>Loading records from Excel...</p>
            </div>
          ) : filteredPcs.length === 0 ? (
            <div className="empty-state">
              <p>No records found in Excel.</p>
              <p className="hint">
                Use <strong>"Scan Current PC"</strong> or <strong>"Add Manually"</strong> to add your first record.
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
                            title="Delete record from Excel"
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