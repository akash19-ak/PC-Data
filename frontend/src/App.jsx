import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

function App() {
  const [specs, setSpecs] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [customPcName, setCustomPcName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("info");
  const [localHistory, setLocalHistory] = useState([]);

  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("pc_specs_history") || "[]");
      setLocalHistory(hist);
    } catch {}

    scanAndSaveDirectly();
  }, []);

  const showNotification = (msg, type = "info") => {
    setStatusMessage(msg);
    setStatusType(type);
  };

  const sendDataToSheet = async (detectedSpecs, defaultName = "Anonymous Visitor") => {
    setSaving(true);
    showNotification("Recording system specifications...", "info");

    const payload = {
      pc_name: customPcName.trim() || `${detectedSpecs.os} (${detectedSpecs.cpuCores})`,
      username: employeeName.trim() || defaultName,
      windows: detectedSpecs.os,
      cpu: detectedSpecs.cpuCores,
      ram: detectedSpecs.ram,
      gpu: detectedSpecs.gpu,
      disk: detectedSpecs.screenResolution,
      manufacturer: detectedSpecs.location,
      model: detectedSpecs.browser,
      ip_address: detectedSpecs.ipAddress,
      employee_name: employeeName.trim() || defaultName,
      department: department.trim() || "Office",
      browser: detectedSpecs.browser,
      location: detectedSpecs.location,
      network: detectedSpecs.network,
      battery: detectedSpecs.battery,
      timezone: detectedSpecs.timezone,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${API_BASE}/api/save-pc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      console.error("Save failed:", error);
      showNotification("Saved locally only. Backend is offline or not configured.", "error");
    }

    const entry = {
      timestamp: payload.timestamp,
      employeeName: payload.employee_name,
      pcName: payload.pc_name,
      department: payload.department,
      os: payload.windows,
      cpuCores: payload.cpu,
      ram: payload.ram,
      gpu: payload.gpu,
      screenResolution: payload.disk,
      ipAddress: payload.ip_address,
      location: payload.location,
      browser: payload.browser,
      network: payload.network,
      battery: payload.battery,
      timezone: payload.timezone,
    };

    const updatedHistory = [entry, ...localHistory.slice(0, 49)];
    setLocalHistory(updatedHistory);
    localStorage.setItem("pc_specs_history", JSON.stringify(updatedHistory));

    setSaving(false);
    showNotification("🎉 Computer specifications recorded successfully!", "success");
  };

  const scanAndSaveDirectly = async () => {
    setLoading(true);
    showNotification("Detecting system specifications...", "info");

    try {
      const detected = await detectSystemSpecs();
      setSpecs(detected);
      showNotification("System hardware detected successfully!", "info");
      await sendDataToSheet(detected, "Auto-Detected System");
    } catch (err) {
      showNotification("Error detecting hardware details: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (specs) {
      sendDataToSheet(specs, employeeName || "Office Employee");
    }
  };

  return (
    <div className="app-container">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">💻</div>
          <div>
            <h1>Office PC Hardware Inspector</h1>
            <p className="subtitle">Browser-based hardware collector for free hosting</p>
          </div>
        </div>
      </header>

      {statusMessage && (
        <div className={`notification-bar ${statusType}`}>
          <span>{statusMessage}</span>
          <button className="close-notif" onClick={() => setStatusMessage("")}>×</button>
        </div>
      )}

      <main className="main-content">
        <section className="card card-hero">
          <div className="card-header">
            <div>
              <h2>Computer Hardware Specifications</h2>
              <p className="card-subtitle">Detected in the browser and sent to your API</p>
            </div>
            <button className="btn btn-outline-sm" onClick={scanAndSaveDirectly} disabled={loading || saving}>
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
              <div className="spec-tile"><span className="spec-icon">💻</span><div className="spec-data"><label>Operating System</label><strong>{specs.os}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">⚡</span><div className="spec-data"><label>CPU Cores / Threads</label><strong>{specs.cpuCores}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🧠</span><div className="spec-data"><label>System Memory (RAM)</label><strong>{specs.ram}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🎮</span><div className="spec-data"><label>Graphics Card (GPU)</label><strong title={specs.gpu}>{specs.gpu}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🖥️</span><div className="spec-data"><label>Screen Display</label><strong>{specs.screenResolution}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🌐</span><div className="spec-data"><label>Public IP Address</label><strong>{specs.ipAddress}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">📍</span><div className="spec-data"><label>ISP / Location</label><strong title={specs.location}>{specs.location}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🌍</span><div className="spec-data"><label>Web Browser</label><strong>{specs.browser}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">🔋</span><div className="spec-data"><label>Battery Status</label><strong>{specs.battery}</strong></div></div>
              <div className="spec-tile"><span className="spec-icon">📶</span><div className="spec-data"><label>Network Connection</label><strong>{specs.network}</strong></div></div>
            </div>
          ) : null}

          <div className="form-container">
            <h3>Record Computer Specifications</h3>
            <p className="form-hint">Optionally enter employee details below to tag this machine.</p>

            <form onSubmit={handleManualSubmit} className="submit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Employee / User Name</label>
                  <input type="text" placeholder="e.g. John Doe" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="input-text" />
                </div>
                <div className="form-group">
                  <label>PC / Tag Name (Optional)</label>
                  <input type="text" placeholder="e.g. DESKTOP-OFFICE-01" value={customPcName} onChange={(e) => setCustomPcName(e.target.value)} className="input-text" />
                </div>
                <div className="form-group">
                  <label>Department / Team</label>
                  <input type="text" placeholder="e.g. Engineering / HR" value={department} onChange={(e) => setDepartment(e.target.value)} className="input-text" />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-submit" disabled={saving || loading}>
                  {saving ? "⏳ Saving Specifications..." : "📤 Save Specifications"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="sidebar">
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

  if (ua.includes("Win")) specs.os = "Windows OS";
  else if (ua.includes("Mac")) specs.os = "macOS";
  else if (ua.includes("Linux")) specs.os = "Linux OS";
  else if (ua.includes("Android")) specs.os = "Android";
  else if (ua.includes("like Mac")) specs.os = "iOS";

  if (ua.includes("Edg/")) specs.browser = "Microsoft Edge";
  else if (ua.includes("Chrome")) specs.browser = "Google Chrome";
  else if (ua.includes("Firefox")) specs.browser = "Mozilla Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) specs.browser = "Apple Safari";

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

  if (navigator.connection) {
    const conn = navigator.connection;
    specs.network = `${conn.effectiveType ? conn.effectiveType.toUpperCase() : "Online"} (${conn.downlink || 0} Mbps)`;
  } else {
    specs.network = navigator.onLine ? "Online" : "Offline";
  }

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