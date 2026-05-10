# Construction Cost Intelligence Platform

Production-like interactive prototype with:

- React + Vite + Tailwind CSS frontend
- Zustand state management
- Recharts dashboards
- FastAPI backend
- PostgreSQL-ready persistence with SQLite fallback
- HuggingFace Llama 3 integration with a local fallback when `LLAMA_API_KEY` is not set

## Project Structure

```text
frontend/
  src/
    components/
    pages/
    store/
backend/
  main.py
  routes/
  services/
  models/
```

## Backend Setup

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

The backend defaults to SQLite and creates `construction_cost_demo.db` automatically.

For PostgreSQL, set:

```bash
set DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/construction_cost
```

For Llama 3 via HuggingFace:

```bash
set LLAMA_API_KEY=your_huggingface_token
```

If no key is set, `/ai/explain` returns a deterministic local consultant-style response so the workflow remains usable.

Demo login:

```text
email: demo@siteiq.in
password: demo12345
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Optional API override:

```bash
set VITE_API_URL=http://127.0.0.1:8000
```

Open the Vite URL, usually `http://localhost:5173`.

## Render Deployment

This repo is a monorepo with two Render services:

- `backend` as a Python/FastAPI Web Service
- `frontend` as a Static Site

The included `render.yaml` can be used as a Render Blueprint.

### Option A: Deploy With Blueprint

1. Push this repo to GitHub.
2. In Render, choose **New > Blueprint**.
3. Select the GitHub repo.
4. Render will detect `render.yaml` and create:
   - `cost-estimation-engine-api`
   - `cost-estimation-engine`
5. When prompted, add `LLAMA_API_KEY` if you have one. If you skip it, AI Advisor still works with the local fallback.

### Option B: Create Services Manually

Backend Web Service:

```text
Root Directory: backend
Runtime: Python
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Backend environment variables:

```text
PYTHON_VERSION=3.12.7
FRONTEND_URL=https://YOUR_FRONTEND_SERVICE.onrender.com
LLAMA_API_KEY=your_huggingface_key_optional
DATABASE_URL=your_render_postgres_url_optional
```

Frontend Static Site:

```text
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
```

Frontend environment variable:

```text
VITE_API_URL=https://YOUR_BACKEND_SERVICE.onrender.com
```

### Database Note

The app defaults to SQLite, which will run on Render but is not persistent across deploys/restarts on free ephemeral storage. For a real deployment, create a Render PostgreSQL database and set `DATABASE_URL` on the backend service.

### CORS Note

The backend allows local development origins, the configured `FRONTEND_URL`, and Render `*.onrender.com` origins.

## Main API Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `POST /project/create`
- `GET /project/list`
- `POST /estimate/calculate`
- `POST /estimate/project/{project_id}/recalculate`
- `POST /estimate/version`
- `GET /estimate/version/{project_id}`
- `POST /ai/explain`
- `POST /scenario/run`
- `GET /admin/prices`
- `POST /admin/prices`
- `GET /admin/templates`
- `POST /admin/templates`

## Supported Workflows

- Signup/login and persisted browser session
- Project creation through a three-step wizard
- Estimate generation using area, quality tier, finish level, floors, materials, and risk buffer
- Editable cost rows across Structure, Finishing, MEP, and Labour
- Recalculate, save version, compare versions, export PDF
- Real-time simulated material price fluctuation
- Delay and quality scenario simulation
- AI explanation and cost-reduction suggestions
- Admin editing for material prices and templates
- Document intake for CSV, XLSX, PDF, DXF, and DWG uploads
- AI-style material mapping with confidence scores and category classification
- DXF drawing entity takeoff with DWG conversion and scanned-PDF OCR readiness notes
- Reports with charts and CSV export
- Dark mode

## Document Intake Notes

Open the `Intake` page after login to upload architectural/design and material files.

Supported now:

- CSV material schedules
- XLSX/XLSM material schedules
- Text-based PDF extraction
- DXF entity and area takeoff hooks
- DWG upload detection with conversion-required status

Production OCR/CAD upgrades to add next:

- Tesseract, AWS Textract, Azure Form Recognizer, or Google Document AI for scanned PDFs
- DWG to DXF/IFC conversion worker
- BIM/IFC quantity takeoff
- Human review queue for low-confidence mappings
