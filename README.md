# PC Specs Manager

This project was redesigned for free cloud deployment.

## What changed

- Removed Windows-only system inspection logic from the backend.
- The frontend now detects the user's current browser/device info in the browser.
- The API accepts saved records and stores them in a JSON file by default.
- Optional Google Sheets sync is supported via `GOOGLE_SHEET_WEBHOOK`.
- The frontend is prepared for GitHub Pages / Cloudflare Pages deployment.

## Local development

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open http://localhost:5173

## Deploying for free

### Frontend

Use GitHub Pages or Cloudflare Pages.

Set this environment variable in the frontend build:

```bash
VITE_API_URL=https://your-api-url.example.com
```

### Backend

Use Render or Railway. The project includes a `render.yaml` file for Render.

Set env var:

```bash
GOOGLE_SHEET_WEBHOOK=https://script.google.com/.../exec
```

This optional value lets the API push records to Google Sheets.

## API

- GET /health
- GET /api/pcs
- POST /api/save-pc
- DELETE /api/pcs/{pc_name}

## Notes

This version is cloud-friendly and suitable for free-tier hosting, but the browser can only detect what the browser can access, so it does not expose full local OS hardware information the way the old Windows-only version did.
