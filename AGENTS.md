# AGENTS.md — Guide for AI Coding Assistants

This document governs how automated AI assistants inspect, modify, and verify code within this repository.

---

## 1. Operating Principles

1. **Local-First Architecture:** The project is configured to run locally on a development laptop without requiring cloud services, paid external APIs, Kubernetes, or container orchestration.
2. **Read Before Writing:** Inspect existing files before editing or declaring features as complete. Do not assume file contents or directory structures.
3. **Incremental Changes:** Keep code modifications focused on the specific task. Avoid large refactors of unrelated files.
4. **Honest Reporting:** Clearly differentiate between implemented, partially implemented, and planned features. Never generate synthetic data and present it as genuine predictive model output.
5. **Preserve Documentation Integrity:** Update documentation in the same step as code modifications when routes, schemas, or behaviors change.

---

## 2. Pre-Modification Checklist

Before modifying any file or module:
1. Review [`docs/tasks.md`](docs/tasks.md) to confirm the scope of planned work.
2. Review [`docs/platform/architecture.md`](docs/platform/architecture.md) for expected service boundaries and communication paths.
3. List existing files in the target directory to verify current dependencies and structure.

---

## 3. Code Standards & Conventions

- **Frontend (React + Vite):**
  - Use standard React hooks (`useState`, `useEffect`).
  - Keep styling modular in standard CSS (e.g., [`frontend/src/index.css`](frontend/src/index.css)).
  - Always handle API connection failures with clean fallback states.
- **Backend (Node.js + Express):**
  - Use CommonJS modules (`require` / `module.exports`) to match the existing codebase.
  - Keep configuration in environment variables managed via `dotenv`.
  - Ensure CORS middleware permits requests from the frontend development port (`5173`).
- **AI Service (Python + FastAPI):**
  - Use Pydantic schemas in [`ai-service/schemas.py`](ai-service/schemas.py) for all request and response structures.
  - Keep heavy model loading logic cached in memory rather than reloading per request.
  - Maintain separation between inference logic (`detector.py`) and HTTP endpoints (`main.py`).

---

## 4. Verification Procedures

After making code changes, execute the relevant check:

### Frontend
```powershell
cd frontend
npm run build
```
Confirms the Vite compilation and JSX transformation succeed with zero build errors.

### Backend
```powershell
cd backend
npm start
```
Verify startup output and probe `http://localhost:5000/api/health`.

### AI Service
```powershell
cd ai-service
# Standalone detector verification:
python test_detection.py
# Web service verification:
uvicorn main:app --port 8000
```
Verify that `http://localhost:8000/health` returns status `ok`.

---

## 5. Documentation Maintenance Rules

When changes affect system behavior, update the corresponding documentation:

| Modification Type | Target Documentation |
|---|---|
| Adding or changing an API endpoint | `docs/platform/architecture.md` (Endpoints table) |
| Altering data communication flow | `docs/platform/architecture.md` (Data flow diagram) |
| Adding or changing detection parameters | `docs/feats/vehicle-detection.md` |
| Updating milestone progress | `docs/tasks.md` |

---

## 6. Prohibited Practices

- ❌ Do not delete or overwrite files without reading them first.
- ❌ Do not introduce cloud dependencies, container requirements, or paid APIs unless explicitly requested.
- ❌ Do not implement speculative ML models when labeled data requirements are unmet.
- ❌ Do not create empty placeholder directories without accompanying implementation files.
- ❌ Do not fabricate benchmark scores, detection counts, or test assertions.
