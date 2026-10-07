import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [specs, setSpecs] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [customPcName, setCustomPcName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info"); // 'info' | 'success' | 'error'
  const [localHistory, setLocalHistory] = useState([]);

  useEffect(() => {
    // Load local history
    try {
      const hist = JSON.parse(localStorage.getItem("pc_specs_history") || "[]");
      setLocalHistory(hist);
    } catch {}

    // Auto-scan hardware specs on page load and save directly
    scanAndSaveDirectly();
  }, []);

  const showNotification = (msg, type = "info") => {
    setStatusMessage(msg);
    setStatusType(type);
  };

  const scanAndSaveDirectly = async () => {
    setLoading(true);
    showNotification("Detecting system specifications...", "info");

    try {
      const detected = await detectSystemSpecs();
      setSpecs(detected);
      showNotification("System hardware detected successfully!", "info");
      
      // Save locally and keep the recent history in browser storage
      await sendDataToSheet(detected, "Auto-Detected System");
    } catch (err) {
      showNotification("Error detecting hardware details: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const sendDataToSheet = async (detectedSpecs, defaultName = "Anonymous Visitor") => {
    setSaving(true);
    showNotification("Recording system specifications...", "info");

    const payload = {
      timestamp: new Date().toLocaleString(),
      employeeName: employeeName.trim() || defaultName,
      pcName: customPcName.trim() || `${detectedSpecs.os} (${detectedSpecs.cpuCores})`,
      department: department.trim() || "Office",
      os: detectedSpecs.os,
      cpuCores: detectedSpecs.cpuCores,
      ram: detectedSpecs.ram,
      gpu: detectedSpecs.gpu,
      screenResolution: detectedSpecs.screenResolution,
      ipAddress: detectedSpecs.ipAddress,
      location: detectedSpecs.location,
      browser: detectedSpecs.browser,
      network: detectedSpecs.network,
      battery: detectedSpecs.battery,
      timezone: detectedSpecs.timezone,
    };

    // Save to the local backend if it is running
    try {
      await fetch("http://localhost:8000/api/save-pc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pc_name: payload.pcName,
          username: payload.employeeName,
          windows: payload.os,
          cpu: payload.cpuCores,
          ram: payload.ram,
          gpu: payload.gpu,
          disk: payload.screenResolution,
          manufacturer: payload.location,
          model: payload.browser,
          ip_address: payload.ipAddress,
        }),
      }).catch(() => null);
    } catch (e) {}

    // Save to local storage history
    const updatedHistory = [payload, ...localHistory.filter(h => h.timestamp !== payload.timestamp).slice(0, 49)];
    setLocalHistory(updatedHistory);
    localStorage.setItem("pc_specs_history", JSON.stringify(updatedHistory));

    setSaving(false);
    showNotification("🎉 Computer specifications recorded successfully!", "success");
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (specs) {
      sendDataToSheet(specs, employeeName || "Office Employee");
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Background Glow */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">💻</div>
          <div>
            <h1>Office PC Hardware Inspector</h1>
            <p className="subtitle">System Hardware Inspector & Auto Spec Collector</p>
          </div>
        </div>
      </header>

      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`notification-bar ${statusType}`}>
          <span>{statusMessage}</span>
          <button
            className="close-notif"
            onClick={() => setStatusMessage("")}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content Dashboard */}
      <main className="main-content">
        {/* Left Side: Hardware Specs Display & Submission Form */}
        <section className="card card-hero">
          <div className="card-header">
            <div>
              <h2>Computer Hardware Specifications</h2>
              <p className="card-subtitle">
                Extracted automatically from your current device
              </p>
            </div>
            <button
              className="btn btn-outline-sm"
              onClick={scanAndSaveDirectly}
              disabled={loading || saving}
            >
              {loading ? "Scanning..." : "🔄 Re-Scan & Save"}
            </button>
          </div>

          {loading ? (
            <div className="skeleton-loader">
              <div className="spinner"></div>
              <p>Detecting computer hardware specifications...</p>
            </div>
          ) : specs ? (
            <div className="specs-grid">
              <div className="spec-tile">
                <span className="spec-icon">💻</span>
                <div className="spec-data">
                  <label>Operating System</label>
                  <strong>{specs.os}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">⚡</span>
                <div className="spec-data">
                  <label>CPU Cores / Threads</label>
                  <strong>{specs.cpuCores}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🧠</span>
                <div className="spec-data">
                  <label>System Memory (RAM)</label>
                  <strong>{specs.ram}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🎮</span>
                <div className="spec-data">
                  <label>Graphics Card (GPU)</label>
                  <strong title={specs.gpu}>{specs.gpu}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🖥️</span>
                <div className="spec-data">
                  <label>Screen Display</label>
                  <strong>{specs.screenResolution}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🌐</span>
                <div className="spec-data">
                  <label>Public IP Address</label>
                  <strong>{specs.ipAddress}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">📍</span>
                <div className="spec-data">
                  <label>ISP / Location</label>
                  <strong title={specs.location}>{specs.location}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🌍</span>
                <div className="spec-data">
                  <label>Web Browser</label>
                  <strong>{specs.browser}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">🔋</span>
                <div className="spec-data">
                  <label>Battery Status</label>
                  <strong>{specs.battery}</strong>
                </div>
              </div>

              <div className="spec-tile">
                <span className="spec-icon">📶</span>
                <div className="spec-data">
                  <label>Network Connection</label>
                  <strong>{specs.network}</strong>
                </div>
              </div>
            </div>
          ) : null}

          {/* Submission Form Section */}
          <div className="form-container">
            <h3>Record Computer Specifications</h3>
            <p className="form-hint">
              Optionally enter employee details below to tag this machine in system records.
            </p>

            <form onSubmit={handleManualSubmit} className="submit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Employee / User Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-text"
                  />
                </div>

                <div className="form-group">
                  <label>PC / Tag Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. DESKTOP-OFFICE-01"
                    value={customPcName}
                    onChange={(e) => setCustomPcName(e.target.value)}
                    className="input-text"
                  />
                </div>

                <div className="form-group">
                  <label>Department / Team</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering / HR"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="input-text"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-submit"
                  disabled={saving || loading}
                >
                  {saving
                    ? "⏳ Saving Specifications..."
                    : "📤 Save Specifications"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Right Side: Information & Recent Submissions */}
        <aside className="sidebar">
          {/* Recent Submissions History */}
          {localHistory.length > 0 && (
            <div className="card history-card">
              <h3>📜 System Record History ({localHistory.length})</h3>
              <div className="history-list">
                {localHistory.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-main">
                      <strong>{item.employeeName}</strong>
                      <span className="history-date">{item.timestamp}</span>
                    </div>
                    <div className="history-sub">
                      {item.os} • {item.cpuCores} • {item.ram} • {item.gpu}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

/**
 * Helper function to collect client-side system specs via Browser APIs
 */
async function detectSystemSpecs() {
  const specs = {
    timestamp: new Date().toLocaleString(),
    os: "Unknown OS",
    browser: "Unknown Browser",
    cpuCores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Logical Cores` : "N/A",
    ram: navigator.deviceMemory ? `~${navigator.deviceMemory} GB RAM` : "N/A (Browser default)",
    gpu: "Standard Graphics Processor",
    screenResolution: `${window.screen.width} x ${window.screen.height} (${window.devicePixelRatio}x Scale, ${window.screen.colorDepth}-bit)`,
    ipAddress: "Fetching...",
    location: "Fetching...",
    network: "N/A",
    battery: "N/A",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "N/A",
  };

  const ua = navigator.userAgent;

  // OS Detection
  if (ua.includes("Win")) specs.os = "Windows OS";
  else if (ua.includes("Mac")) specs.os = "macOS";
  else if (ua.includes("Linux")) specs.os = "Linux OS";
  else if (ua.includes("Android")) specs.os = "Android";
  else if (ua.includes("like Mac")) specs.os = "iOS";

  // Browser Detection
  if (ua.includes("Edg/")) specs.browser = "Microsoft Edge";
  else if (ua.includes("Chrome")) specs.browser = "Google Chrome";
  else if (ua.includes("Firefox")) specs.browser = "Mozilla Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) specs.browser = "Apple Safari";

  // WebGL GPU Renderer Detection
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        specs.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } else {
        specs.gpu = gl.getParameter(gl.RENDERER);
      }
    }
  } catch (e) {
    specs.gpu = "WebGL Renderer Not Available";
  }

  // Public IP & Location API
  try {
    const ipRes = await fetch("https://ipapi.co/json/").catch(() => null);
    if (ipRes && ipRes.ok) {
      const data = await ipRes.json();
      specs.ipAddress = data.ip || "N/A";
      specs.location = `${data.city || ""}, ${data.region || ""}, ${data.country_name || ""} (${data.org || ""})`;
    } else {
      const ipify = await fetch("https://api.ipify.org?format=json").then((r) => r.json()).catch(() => null);
      if (ipify && ipify.ip) {
        specs.ipAddress = ipify.ip;
        specs.location = "Public IP";
      }
    }
  } catch (e) {
    specs.ipAddress = "Offline / Restricted";
    specs.location = "Local Network";
  }

  // Network Connection API
  if (navigator.connection) {
    const conn = navigator.connection;
    specs.network = `${conn.effectiveType ? conn.effectiveType.toUpperCase() : "Online"} (${conn.downlink || 0} Mbps)`;
  } else {
    specs.network = navigator.onLine ? "Online" : "Offline";
  }

  // Battery API
  if (navigator.getBattery) {
    try {
      const batt = await navigator.getBattery();
      const level = Math.round(batt.level * 100);
      specs.battery = `${level}% (${batt.charging ? "⚡ Charging" : "🔋 Discharging"})`;
    } catch (e) {}
  }

  return specs;
}

export default App;