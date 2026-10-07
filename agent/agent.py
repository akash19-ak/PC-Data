import requests
import socket
import getpass
import platform
import subprocess
import json


SERVER_URL = "http://YOUR_SERVER_IP:8000/save-pc"


def run_command(command):

    try:

        result = subprocess.check_output(
            command,
            shell=True,
            text=True,
            stderr=subprocess.DEVNULL
        )

        return result.strip()

    except:

        return "Unknown"


def get_cpu():

    return run_command(
        "wmic cpu get name"
    ).replace("Name", "").strip()


def get_ram():

    result = run_command(
        "wmic computersystem get TotalPhysicalMemory"
    )

    try:

        value = result.splitlines()[-1].strip()

        gb = int(value) / (1024 ** 3)

        return f"{gb:.2f} GB"

    except:

        return "Unknown"


def get_gpu():

    return run_command(
        "wmic path win32_videocontroller get name"
    ).replace("Name", "").strip()


def get_manufacturer():

    return run_command(
        "wmic computersystem get manufacturer"
    ).replace("Manufacturer", "").strip()


def get_model():

    return run_command(
        "wmic computersystem get model"
    ).replace("Model", "").strip()


def get_disk():

    result = run_command(
        "wmic diskdrive get size"
    )

    sizes = []

    for line in result.splitlines():

        line = line.strip()

        if line.isdigit():

            gb = int(line) / (1024 ** 3)

            sizes.append(f"{gb:.0f} GB")

    return ", ".join(sizes)


def get_ip():

    hostname = socket.gethostname()

    try:

        return socket.gethostbyname(hostname)

    except:

        return "Unknown"


data = {

    "pc_name": socket.gethostname(),

    "username": getpass.getuser(),

    "windows": platform.platform(),

    "cpu": get_cpu(),

    "ram": get_ram(),

    "gpu": get_gpu(),

    "disk": get_disk(),

    "manufacturer": get_manufacturer(),

    "model": get_model(),

    "ip_address": get_ip()

}


print(json.dumps(data, indent=4))


response = requests.post(
    SERVER_URL,
    json=data
)


print(response.json())