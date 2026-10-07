import requests
import socket
import getpass
import platform
import subprocess
import json
import sys
import os

DEFAULT_SERVER_URL = os.environ.get("PC_DATA_SERVER_URL", "http://localhost:8000/save-pc")


def run_command(command: str) -> str:
    """Execute a system command and return stripped output."""
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


def get_cpu() -> str:
    cpu = run_command("wmic cpu get name")
    if cpu:
        cpu = cpu.replace("Name", "").strip()
    if not cpu:
        cpu = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name"')
    if not cpu:
        cpu = platform.processor() or "Unknown"
    return cpu


def get_ram() -> str:
    result = run_command("wmic computersystem get TotalPhysicalMemory")
    if not result:
        result = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"')

    try:
        digits = [line.strip() for line in result.splitlines() if line.strip().isdigit()]
        if digits:
            gb = int(digits[-1]) / (1024 ** 3)
            return f"{gb:.2f} GB"
        return "Unknown"
    except Exception:
        return "Unknown"


def get_gpu() -> str:
    result = run_command("wmic path win32_videocontroller get name")
    if result:
        lines = [line.strip() for line in result.splitlines() if line.strip() and line.strip() != "Name"]
        if lines:
            return ", ".join(lines)
    result_ps = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"')
    if result_ps:
        lines = [line.strip() for line in result_ps.splitlines() if line.strip()]
        if lines:
            return ", ".join(lines)
    return "Unknown"


def get_manufacturer() -> str:
    res = run_command("wmic computersystem get manufacturer").replace("Manufacturer", "").strip()
    if not res:
        res = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).Manufacturer"')
    return res if res else "Unknown"


def get_model() -> str:
    res = run_command("wmic computersystem get model").replace("Model", "").strip()
    if not res:
        res = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).Model"')
    return res if res else "Unknown"


def get_disk() -> str:
    result = run_command("wmic diskdrive get size")
    if not result:
        result = run_command('powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive).Size"')

    sizes = []
    for line in result.splitlines():
        line = line.strip()
        if line.isdigit():
            try:
                gb = int(line) / (1024 ** 3)
                sizes.append(f"{gb:.0f} GB")
            except Exception:
                pass
    return ", ".join(sizes) if sizes else "Unknown"


def get_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def collect_specs() -> dict:
    return {
        "pc_name": socket.gethostname(),
        "username": getpass.getuser(),
        "windows": platform.platform(),
        "cpu": get_cpu(),
        "ram": get_ram(),
        "gpu": get_gpu(),
        "disk": get_disk(),
        "manufacturer": get_manufacturer(),
        "model": get_model(),
        "ip_address": get_ip(),
    }


def send_to_server(data: dict, server_url: str):
    print("=" * 60)
    print("PC Specification Agent")
    print("=" * 60)
    print(f"Target Server URL: {server_url}")
    print("\nCollected System Information:")
    print(json.dumps(data, indent=4))
    print("-" * 60)

    try:
        print(f"Sending specifications to {server_url} ...")
        response = requests.post(server_url, json=data, timeout=8)
        if response.status_code == 200:
            print("SUCCESS: PC specifications successfully sent and recorded!")
            print(f"Server response: {response.text}")
        else:
            print(f"WARNING: Server returned status code {response.status_code}")
            print(f"Server response: {response.text}")
    except requests.exceptions.ConnectionError:
        print(f"\nERROR: Could not connect to backend server at '{server_url}'.")
        print("Please ensure the FastAPI backend is running: py -m uvicorn main:app --host 0.0.0.0 --port 8000")
    except requests.exceptions.Timeout:
        print(f"\nERROR: Request to '{server_url}' timed out.")
    except Exception as e:
        print(f"\nERROR: An unexpected error occurred: {str(e)}")


if __name__ == "__main__":
    target_url = DEFAULT_SERVER_URL
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        arg_url = sys.argv[1]
        if not arg_url.startswith("http"):
            arg_url = f"http://{arg_url}"
        if not arg_url.endswith("/save-pc"):
            arg_url = f"{arg_url.rstrip('/')}/save-pc"
        target_url = arg_url

    specs = collect_specs()
    send_to_server(specs, target_url)