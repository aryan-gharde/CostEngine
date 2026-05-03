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
