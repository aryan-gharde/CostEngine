from fastapi import APIRouter, File, UploadFile

from services.document_parser import analyze_documents

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/analyze")
async def analyze_uploads(files: list[UploadFile] = File(...)):
    payload = []
    for file in files:
        payload.append((file.filename, await file.read()))
    return analyze_documents(payload)

