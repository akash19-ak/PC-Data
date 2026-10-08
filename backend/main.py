from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path
from datetime import datetime
import json
import os
import requests

app = FastAPI(title="PC Specifications API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "pcs.json"
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
CONFIG_FILE = BASE_DIR / "config.json"

if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


class PCSpecs(BaseModel):
    pc_name: str = Field(default="")
    username: str = Field(default="")
    windows: str = Field(default="")
    cpu: str = Field(default="")
    ram: str = Field(default="")
    gpu: str = Field(default="")
    disk: str = Field(default="")
    manufacturer: str = Field(default="")
    model: str = Field(default="")
    ip_address: str = Field(default="")
    employee_name: str = Field(default="")
    department: str = Field(default="")
    browser: str = Field(default="")
    location: str = Field(default="")
    network: str = Field(default="")
    battery: str = Field(default="")
    timezone: str = Field(default="")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))


class ConfigModel(BaseModel):
    webhook_url: str = ""


def ensure_data_file():
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text("[]", encoding="utf-8")


def load_records() -> list:
    ensure_data_file()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def save_records(records: list):
    ensure_data_file()
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(records, handle, indent=2)


def get_config() -> dict:
    config = {
        "webhook_url": os.environ.get("GOOGLE_SHEET_WEBHOOK", ""),
    }
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as file:
                data = json.load(file)
                config.update(data)
        except Exception:
            pass
    return config


def save_config(cfg: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as file:
            json.dump(cfg, file, indent=2)
    except Exception:
        pass


def sync_to_google_sheet(data: dict):
    webhook_url = os.environ.get("GOOGLE_SHEET_WEBHOOK") or get_config().get("webhook_url")
    if not webhook_url:
        return {"status": "disabled", "message": "Google Sheets sync is not configured."}

    try:
        response = requests.post(webhook_url, json=data, timeout=20)
        return {
            "status": "sent",
            "http_status": response.status_code,
            "response_text": response.text[:500],
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/")
def home(request: Request):
    accept = request.headers.get("accept", "")
    index_file = DIST_DIR / "index.html"
    if "text/html" in accept and index_file.exists():
        return FileResponse(str(index_file))
    return {
        "message": "PC Specification Server Running",
        "status": "healthy",
        "ui_url": "/app",
        "storage": str(DATA_FILE),
    }


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "healthy", "records": len(load_records())}


@app.get("/app")
@app.get("/ui")
def serve_ui():
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {
        "message": "Frontend build not generated yet. Run 'npm run build' in the frontend folder or start Vite dev server on http://localhost:5173"
    }


@app.get("/api/config")
def get_configuration():
    return get_config()


@app.post("/api/config")
def update_configuration(cfg: ConfigModel):
    data = cfg.model_dump() if hasattr(cfg, "model_dump") else cfg.dict()
    save_config(data)
    return {"success": True, "config": data}


@app.get("/api/pcs")
def get_all_pcs():
    pcs = load_records()
    return {"success": True, "count": len(pcs), "pcs": pcs}


@app.post("/api/save-pc")
def save_pc(payload: dict):
    if not payload:
        raise HTTPException(status_code=400, detail="No data provided.")

    record = dict(payload)
    record.setdefault("timestamp", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    record.setdefault("date", record["timestamp"])
    record.setdefault("pc_name", record.get("pcName") or record.get("pc_name") or "Unknown PC")
    record.setdefault("username", record.get("employee_name") or record.get("username") or "Unknown User")
    record.setdefault("windows", record.get("windows") or record.get("os") or "Unknown OS")
    record.setdefault("cpu", record.get("cpu") or record.get("cpuCores") or "Unknown CPU")
    record.setdefault("ram", record.get("ram") or "Unknown RAM")
    record.setdefault("gpu", record.get("gpu") or "Unknown GPU")
    record.setdefault("disk", record.get("disk") or "Unknown Disk")
    record.setdefault("manufacturer", record.get("manufacturer") or "Unknown Manufacturer")
    record.setdefault("model", record.get("model") or "Unknown Model")
    record.setdefault("ip_address", record.get("ip_address") or record.get("ipAddress") or "Unknown IP")

    records = load_records()
    existing_index = next(
        (index for index, item in enumerate(records) if str(item.get("pc_name", "")).strip().lower() == str(record["pc_name"]).strip().lower()),
        None,
    )

    if existing_index is not None:
        records[existing_index] = record
        action = "updated"
    else:
        records.append(record)
        action = "created"

    save_records(records)
    sync_result = sync_to_google_sheet(record)

    return {
        "success": True,
        "action": action,
        "message": f"PC '{record['pc_name']}' information {action} successfully.",
        "data": record,
        "google_sheet": sync_result,
    }


@app.get("/api/scan-and-save")
@app.post("/api/scan-and-save")
def scan_and_save():
    return {
        "success": True,
        "message": "This frontend version collects specs in the browser and sends them to the API.",
        "note": "No Windows-only system commands are used in this cloud-friendly build.",
    }


@app.delete("/api/pcs/{pc_name}")
def delete_pc(pc_name: str):
    records = load_records()
    filtered = [item for item in records if str(item.get("pc_name", "")).strip().lower() != pc_name.strip().lower()]
    if len(filtered) == len(records):
        raise HTTPException(status_code=404, detail=f"PC '{pc_name}' not found.")
    save_records(filtered)
    return {"success": True, "message": f"PC '{pc_name}' deleted successfully."}
