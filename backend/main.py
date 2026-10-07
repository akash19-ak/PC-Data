from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from datetime import datetime
from pathlib import Path
import threading
import socket
import getpass
import platform
import subprocess
import requests
import json
import os

app = FastAPI(title="PC Specifications API", version="1.0.0")

# React frontend CORS access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
EXCEL_FILE = BASE_DIR / "PC_Specs.xlsx"
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
CONFIG_FILE = BASE_DIR / "config.json"

DEFAULT_GOOGLE_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/1n2Y-ODl1AhIs_dRAUfa-sWTrSJFKttzrQMZl0f6gD3Y/edit?gid=0#gid=0"
)

if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

excel_lock = threading.Lock()

HEADERS = [
    "Date",
    "PC Name",
    "Username",
    "Windows",
    "CPU",
    "RAM",
    "GPU",
    "Disk",
    "Manufacturer",
    "Model",
    "IP Address",
]


class PCSpecs(BaseModel):
    pc_name: str
    username: str
    windows: str
    cpu: str
    ram: str
    gpu: str
    disk: str
    manufacturer: str
    model: str
    ip_address: str


class ConfigModel(BaseModel):
    google_sheet_url: str = DEFAULT_GOOGLE_SHEET_URL
    webhook_url: str = ""


def get_config() -> dict:
    config = {
        "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL,
        "webhook_url": os.environ.get("GOOGLE_SHEET_WEBHOOK", ""),
    }
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                config.update(data)
        except Exception:
            pass
    return config


def save_config(cfg: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass


def sync_to_google_sheet(data: dict):
    """Optionally syncs row to Google Sheet via Google Apps Script Web App webhook if configured."""
    cfg = get_config()
    webhook = cfg.get("webhook_url", "").strip()
    if not webhook:
        return {"status": "no_webhook", "message": "Google Sheet Webhook not configured"}

    try:
        resp = requests.post(webhook, json=data, timeout=5)
        return {"status": "success", "response": resp.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def create_excel():
    """Ensure the Excel workbook exists and has the correct sheet and styled headers."""
    needs_init = False
    if not EXCEL_FILE.exists() or EXCEL_FILE.stat().st_size == 0:
        needs_init = True
    else:
        try:
            wb = load_workbook(EXCEL_FILE, read_only=True)
            if "PC Specifications" not in wb.sheetnames and len(wb.sheetnames) == 0:
                needs_init = True
            wb.close()
        except Exception:
            needs_init = True

    if needs_init:
        wb = Workbook()
        ws = wb.active
        ws.title = "PC Specifications"
        ws.append(HEADERS)

        header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")

        for col_num, header in enumerate(HEADERS, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            ws.column_dimensions[cell.column_letter].width = max(len(header) + 6, 16)

        try:
            wb.save(EXCEL_FILE)
            wb.close()
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="PC_Specs.xlsx is open in another program (like Microsoft Excel). Please close it and retry.",
            )


def get_workbook_sheet():
    create_excel()
    wb = load_workbook(EXCEL_FILE)
    if "PC Specifications" in wb.sheetnames:
        ws = wb["PC Specifications"]
    else:
        ws = wb.active
        ws.title = "PC Specifications"
        if ws.max_row == 0 or ws.cell(row=1, column=1).value is None:
            ws.append(HEADERS)
    return wb, ws


def run_command(command: str) -> str:
    try:
        result = subprocess.check_output(
            command,
            shell=True,
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=8,
        )
        return result.strip()
    except Exception:
        return ""


def collect_local_system_specs() -> PCSpecs:
    """Collect hardware and OS specifications for the current machine."""
    hostname = socket.gethostname()
    username = getpass.getuser()
    win_version = platform.platform()

    # CPU
    cpu = run_command("wmic cpu get name")
    if cpu:
        cpu = cpu.replace("Name", "").strip()
    if not cpu:
        cpu = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name"')
    if not cpu:
        cpu = platform.processor() or "Unknown CPU"

    # RAM
    ram = "Unknown"
    ram_raw = run_command("wmic computersystem get TotalPhysicalMemory")
    if not ram_raw:
        ram_raw = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"')
    if ram_raw:
        try:
            digits = [s for s in ram_raw.splitlines() if s.strip().isdigit()]
            if digits:
                gb = int(digits[-1].strip()) / (1024 ** 3)
                ram = f"{gb:.2f} GB"
        except Exception:
            ram = "Unknown"

    # GPU
    gpu = run_command("wmic path win32_videocontroller get name")
    if gpu:
        lines = [line.strip() for line in gpu.splitlines() if line.strip() and line.strip() != "Name"]
        gpu = ", ".join(lines) if lines else "Unknown GPU"
    if not gpu or gpu == "Unknown GPU":
        gpu_ps = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"')
        if gpu_ps:
            gpu = ", ".join([line.strip() for line in gpu_ps.splitlines() if line.strip()])
    if not gpu:
        gpu = "Unknown GPU"

    # Manufacturer & Model
    manufacturer = run_command("wmic computersystem get manufacturer").replace("Manufacturer", "").strip()
    if not manufacturer:
        manufacturer = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).Manufacturer"')
    if not manufacturer:
        manufacturer = "Unknown"

    model = run_command("wmic computersystem get model").replace("Model", "").strip()
    if not model:
        model = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).Model"')
    if not model:
        model = "Unknown"

    # Disk
    disk = "Unknown"
    disk_raw = run_command("wmic diskdrive get size")
    if not disk_raw:
        disk_raw = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive).Size"')
    if disk_raw:
        sizes = []
        for line in disk_raw.splitlines():
            line = line.strip()
            if line.isdigit():
                try:
                    gb = int(line) / (1024 ** 3)
                    sizes.append(f"{gb:.0f} GB")
                except Exception:
                    pass
        if sizes:
            disk = ", ".join(sizes)

    # IP Address
    ip_address = "Unknown"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            ip_address = socket.gethostbyname(hostname)
        except Exception:
            ip_address = "127.0.0.1"

    return PCSpecs(
        pc_name=hostname,
        username=username,
        windows=win_version,
        cpu=cpu,
        ram=ram,
        gpu=gpu,
        disk=disk,
        manufacturer=manufacturer,
        model=model,
        ip_address=ip_address,
    )


@app.on_event("startup")
def on_startup():
    with excel_lock:
        create_excel()


@app.get("/")
def home(request: Request):
    """
    Serves the built Web UI if HTML is requested and frontend build exists,
    otherwise returns the API health JSON.
    """
    accept = request.headers.get("accept", "")
    index_file = DIST_DIR / "index.html"
    if "text/html" in accept and index_file.exists():
        return FileResponse(str(index_file))

    # Also return JSON for non-browser / API checks
    return {
        "message": "PC Specification Server Running",
        "excel_path": str(EXCEL_FILE),
        "status": "healthy",
        "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL,
        "ui_url": "/app",
    }


@app.get("/app")
@app.get("/ui")
def serve_ui():
    """Serves the Single Page Application UI."""
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


@app.get("/specs")
@app.get("/api/current-pc")
def get_current_specs():
    """Returns specifications for the machine hosting the backend."""
    try:
        specs = collect_local_system_specs()
        return specs.model_dump() if hasattr(specs, "model_dump") else specs.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to collect system specs: {str(e)}")


@app.get("/pcs")
@app.get("/api/pcs")
def get_all_pcs():
    """Reads all recorded PC specifications from the Excel file."""
    with excel_lock:
        try:
            wb, ws = get_workbook_sheet()
            rows = list(ws.iter_rows(values_only=True))
            wb.close()
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="PC_Specs.xlsx is open in another program. Please close it to read data.",
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error reading Excel file: {str(e)}",
            )

    if not rows or len(rows) <= 1:
        return {"success": True, "count": 0, "pcs": [], "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL}

    pcs = []
    for row_idx, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue
        pc_dict = {
            "row_id": row_idx,
            "date": str(row[0] or "").strip(),
            "pc_name": str(row[1] or "").strip(),
            "username": str(row[2] or "").strip(),
            "windows": str(row[3] or "").strip(),
            "cpu": str(row[4] or "").strip(),
            "ram": str(row[5] or "").strip(),
            "gpu": str(row[6] or "").strip(),
            "disk": str(row[7] or "").strip(),
            "manufacturer": str(row[8] or "").strip(),
            "model": str(row[9] or "").strip(),
            "ip_address": str(row[10] if len(row) > 10 and row[10] is not None else "").strip(),
        }
        pcs.append(pc_dict)

    return {
        "success": True,
        "count": len(pcs),
        "pcs": pcs,
        "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL,
    }


@app.post("/save-pc")
@app.post("/api/save-pc")
def save_pc(data: PCSpecs):
    """Saves or updates PC specifications in the Excel file without unnecessary duplicate rows."""
    with excel_lock:
        try:
            wb, ws = get_workbook_sheet()
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            row_to_update = None
            target_name = (data.pc_name or "").strip().lower()

            for r in range(2, ws.max_row + 1):
                existing_name = ws.cell(row=r, column=2).value
                if existing_name and str(existing_name).strip().lower() == target_name:
                    row_to_update = r
                    break

            new_values = [
                now_str,
                data.pc_name.strip(),
                data.username.strip(),
                data.windows.strip(),
                data.cpu.strip(),
                data.ram.strip(),
                data.gpu.strip(),
                data.disk.strip(),
                data.manufacturer.strip(),
                data.model.strip(),
                data.ip_address.strip(),
            ]

            if row_to_update:
                for c_idx, val in enumerate(new_values, start=1):
                    ws.cell(row=row_to_update, column=c_idx, value=val)
                action = "updated"
            else:
                ws.append(new_values)
                action = "created"

            wb.save(EXCEL_FILE)
            wb.close()

            # Trigger optional cloud sync
            payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
            payload["date"] = now_str
            threading.Thread(target=sync_to_google_sheet, args=(payload,), daemon=True).start()

            return {
                "success": True,
                "action": action,
                "message": f"PC '{data.pc_name}' information {action} successfully.",
                "data": payload,
                "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL,
            }

        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="PC_Specs.xlsx is currently open in another program (e.g. Microsoft Excel). Please close it to save changes.",
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to write to Excel: {str(e)}",
            )


@app.get("/api/scan-and-save")
@app.post("/api/scan-and-save")
def scan_and_save():
    """Scans the current host PC hardware specs and automatically saves/updates in Excel & Sheet."""
    specs = collect_local_system_specs()
    result = save_pc(specs)
    return {
        "success": True,
        "message": f"Local PC '{specs.pc_name}' scanned and saved successfully.",
        "specs": specs.model_dump() if hasattr(specs, "model_dump") else specs.dict(),
        "save_result": result,
        "google_sheet_url": DEFAULT_GOOGLE_SHEET_URL,
    }


@app.get("/download-excel")
@app.get("/api/download-excel")
def download_excel():
    """Allows downloading the PC_Specs.xlsx file directly from the browser."""
    with excel_lock:
        create_excel()
        if not EXCEL_FILE.exists():
            raise HTTPException(status_code=404, detail="Excel file does not exist.")

        return FileResponse(
            path=str(EXCEL_FILE),
            filename="PC_Specs.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


@app.delete("/api/pcs/{pc_name}")
def delete_pc(pc_name: str):
    """Deletes a PC entry from Excel by PC name."""
    with excel_lock:
        try:
            wb, ws = get_workbook_sheet()
            target = pc_name.strip().lower()
            found_row = None

            for r in range(2, ws.max_row + 1):
                cell_val = ws.cell(row=r, column=2).value
                if cell_val and str(cell_val).strip().lower() == target:
                    found_row = r
                    break

            if not found_row:
                raise HTTPException(status_code=404, detail=f"PC '{pc_name}' not found.")

            ws.delete_rows(found_row, 1)
            wb.save(EXCEL_FILE)
            wb.close()

            return {
                "success": True,
                "message": f"PC '{pc_name}' deleted successfully.",
            }
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="PC_Specs.xlsx is locked. Please close Excel and try again.",
            )