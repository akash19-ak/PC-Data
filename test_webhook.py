import requests
import json

webhook_url = "https://script.google.com/macros/s/AKfycbz7MVUFUEbw_TvcbkfVho7Yd5ZOVFA0WojJoyvqu5uVGydDjxZsFlOH5gspYrmWXal2/exec"

payload = {
    "timestamp": "2026-10-07 23:35:00",
    "employeeName": "System Inspector Admin",
    "pcName": "OFFICE-MAIN-PC",
    "department": "IT Operations",
    "os": "Windows 11 Pro 64-bit",
    "cpuCores": "12 Logical Cores",
    "ram": "16 GB RAM",
    "gpu": "AMD Radeon Graphics",
    "screenResolution": "1920x1080 (1.25x Scale)",
    "ipAddress": "192.168.1.100",
    "location": "Ahmadnagar, Maharashtra",
    "browser": "Google Chrome 122",
    "network": "4G Online (2.5 Mbps)",
    "battery": "100% (⚡ Charging)",
    "timezone": "Asia/Kolkata"
}

try:
    print("Sending test payload to Google Sheet Webhook...")
    response = requests.post(webhook_url, json=payload, timeout=15)
    print("Status Code:", response.status_code)
    print("Response Text:", response.text)
except Exception as e:
    print("Error:", e)
