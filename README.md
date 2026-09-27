# SecureLink: Cyber-Secure Tactical Datalink System
**TRL 3/4 Laboratory Demonstration & Simulation Platform**

SecureLink is a comprehensive, production-grade cyber-secure tactical datalink system designed for real-time telemetry authentication, cryptographic verification, and threat filtering. It implements the multi-stage security pipeline described in the project proposal for a Technology Readiness Level (TRL) 3/4 laboratory-validated proof-of-concept.

---

## 1. Project Architecture

The system processes tactical telemetry streams from UAVs, UGVs, and ground relay stations across an uncompromised 10-stage cryptographic pipeline:

```
INPUT
  ↓
1. Signal Ingestion (UDP:9871, Continuous File Ingestion /data/incoming, REST API)
  ↓
2. Preprocessing & Frame Normalization
  ↓
3. Dynamic Nonce & Freshness Check (Sliding 5.0s window & bounded LRU replay cache)
  ↓
4. AES-256-GCM Decryption & 128-bit GHASH Tag Authentication
  ↓
5. ECDSA NIST P-256 Digital Signature Verification
  ↓
6. SHA-256 Payload Integrity Digest Check
  ↓
7. Deterministic Packet Classification (AUTHENTIC, REPLAYED, TAMPERED, etc.)
  ↓
8. Tactical Trust Assessment (Multi-factor score: 0 to 100)
  ↓
9. Adaptive Verification & Filtering (Deterministic policy enforcement)
  ↓
10. Decision (ACCEPT / REJECT / BLOCK)
     ├── Forwarded to Trusted C2 Output Interface
     ├── Persisted to SQLite Database & Compliance Audit Logs
     └── Broadcast over Real-Time WebSocket Bus (/ws)
```

### Classification & Action Matrix

| Classification | Verification Result | Pipeline Action | Trust Score |
| :--- | :--- | :--- | :--- |
| **AUTHENTIC** | Valid GCM tag, valid ECDSA signature, fresh nonce, matching hash | **ACCEPTED** | 90 - 100 / 100 |
| **REPLAYED** | Repeated nonce or timestamp outside freshness tolerance | **BLOCKED** | 15 - 35 / 100 |
| **TAMPERED** | GCM tag mismatch or corrupted ciphertext bytes | **BLOCKED** | 10 - 25 / 100 |
| **INVALID SIGNATURE** | ECDSA P-256 signature verification failed | **BLOCKED** | 20 - 40 / 100 |
| **INTEGRITY FAILURE** | SHA-256 payload digest mismatch | **BLOCKED** | 25 - 45 / 100 |
| **INVALID FORMAT** | Malformed frame schema or missing required fields | **REJECTED** | 0 - 10 / 100 |
| **FILTERED** | Source on restricted exclusion list | **FILTERED** | 30 - 50 / 100 |

---

## 2. Directory Structure (Unified Full-Stack)

```
securelink/
├── api/
│   └── index.py            # Vercel Python Serverless ASGI entrypoint
├── app/
│   ├── api/                # REST & WebSocket endpoints
│   ├── core/               # Configuration, paths, logging
│   ├── crypto/             # AES-256-GCM, ECDSA P-256, SHA-256, KeyManager
│   ├── database/           # SQLAlchemy models and SQLite connection
│   ├── ingestion/          # Continuous file watcher, UDP receiver, Simulator
│   ├── processing/         # Pipeline orchestrator, Freshness, TrustScore, Filter
│   ├── schemas/            # Pydantic data schemas
│   ├── services/           # Audit logger, C2 output, WebSocket manager
│   └── main.py             # FastAPI core application
├── src/                    # React 19 + TypeScript + Tailwind CSS Frontend
│   ├── components/         # TopNav, Sidebar, Pipeline, StatCard, Modals, Tables
│   ├── pages/              # Dashboard, LiveTelemetry, Verification, Threats, etc.
│   ├── services/           # REST API, WebSocket client & Tactical Simulation Fallback
│   └── types/              # TypeScript telemetry interfaces
├── public/                 # Favicons, icons, and SVG assets
├── data/
│   └── samples/            # Pre-generated sample authentic & tampered telemetry vectors
├── scripts/
│   ├── generate_sample_file.py # Utility to drop test telemetry into data/incoming
│   └── verify_acceptance_test.py # Automated end-to-end verification
├── tests/                  # Pytest unit and integration test suite
├── index.html              # Frontend HTML entrypoint
├── package.json            # Unified dependencies and build scripts
├── requirements.txt        # Python backend dependencies
├── run.py                  # Local FastAPI server runner
├── start.bat               # 1-click unified launcher for both backend & frontend
├── vercel.json             # Zero-config Vercel deployment & routing rewrites
├── vite.config.ts          # Vite build config
└── README.md
```

---

## 3. Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js v18+ & npm

### Setup
```powershell
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

---

## 4. Running the System

### Option A: 1-Click Launch (Windows)
Double-click `start.bat` or run:
```powershell
.\start.bat
```
This automatically boots both the FastAPI backend (port 8000) and the Vite frontend (port 5173).

### Option B: Manual Execution
```powershell
# Terminal 1: Backend
python run.py
# Server runs on http://127.0.0.1:8000

# Terminal 2: Frontend
npm run dev
# Dashboard opens on http://localhost:5173
```

---

## 5. Ingestion Modes

### Mode 1: Live Input Mode
- **UDP Listener**: Asynchronous UDP receiver active on `0.0.0.0:9871`.
- **REST Telemetry Ingestion**: Submit raw encrypted frames to `POST /api/v1/telemetry/ingest`.

### Mode 2: Simulated Demonstration Mode
- In the dashboard, click **START DEMO** in the top-right header.
- The backend simulator worker continuously generates realistic synthetic tactical telemetry at a configurable rate (0.5 to 5.0 Hz).
- Generates authentic frames as well as laboratory attack vectors (Replay, Tamper, Invalid Sig, Integrity Fail).
- **Critical Architectural Guarantee**: Every simulated packet traverses the exact same multi-stage verification pipeline as live telemetry.

---

## 6. Continuous File Ingestion (`data/incoming`)

The backend continuously monitors `data/incoming/` for new telemetry files (`.json`, `.jsonl`, `.csv`).

To test continuous file ingestion:
1. Run the sample generator script:
   ```powershell
   python scripts/generate_sample_file.py
   ```
2. The script drops a new authorized telemetry file into `data/incoming/`.
3. The backend automatically:
   - Detects the file.
   - Calculates the SHA-256 identity hash (preventing duplicate processing).
   - Extracts and validates telemetry records.
   - Passes every packet through the security pipeline.
   - Archives the file to `data/processed/`.
   - Broadcasts real-time updates to connected browser dashboards without requiring a page refresh.

---

## 7. Cryptographic Key Security & Zero Secret Exposure

- **AES-256-GCM Session Key**: Managed in backend secure runtime memory.
- **Frontend Masking**: The frontend displays `••••••••••••••••••••••••••••••••` with safe metadata:
  - Algorithm: `AES-256-GCM`
  - Key ID: `SK-ALPHA-042`
  - Status: `ACTIVE`
  - Rotation: `READY`
- **Dynamic Re-Keying**: Clicking **KEY RE-SYNC** sends an authorized command to `POST /api/v1/keys/resync`. The backend rotates the active session key, generates a new Key ID, logs an operator audit action, and updates connected dashboards via WebSocket.
- The raw 256-bit symmetric key bytes and ECDSA private keys are **never** returned in API responses, console logs, or browser storage.

---

## 8. REST API Endpoints & WebSocket Bus

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/stats` | Aggregated metrics, trust scores, and filter counters |
| `GET` | `/api/v1/dashboard/pipeline` | Real-time status for all 10 stages |
| `GET` | `/api/v1/telemetry/packets` | Search and filter processed telemetry packets |
| `GET` | `/api/v1/telemetry/packets/{id}` | Complete cryptographic deep dive for a packet |
| `POST`| `/api/v1/telemetry/ingest` | Direct ingestion for live network feeds |
| `GET` | `/api/v1/telemetry/c2-stream` | Stream of verified packets forwarded to Trusted C2 |
| `GET` | `/api/v1/threats` | Intercepted threats and security incidents |
| `GET` | `/api/v1/keys/active` | Safe cryptographic key metadata (secret masked) |
| `POST`| `/api/v1/keys/resync` | Trigger dynamic session re-keying |
| `POST`| `/api/v1/operator/pause` | Pause telemetry stream processing |
| `POST`| `/api/v1/operator/resume` | Resume telemetry stream processing |
| `POST`| `/api/v1/operator/override` | Adjust dynamic freshness tolerance window |
| `GET` | `/api/v1/archive/logs` | Persistent security audit trail |
| `GET` | `/api/v1/archive/logs/export` | Download audit logs as CSV or JSON |
| `GET` | `/api/v1/archive/files` | File ingestion history from `data/incoming` |
| `WS`  | `/ws` | Real-time WebSocket event dispatcher |

### WebSocket Events
- `packet_processed`: Emitted for every packet evaluated by the pipeline.
- `threat_detected`: Emitted when a packet is blocked or filtered due to security violation.
- `key_status_changed`: Emitted when dynamic re-keying occurs.
- `system_status_changed`: Emitted on stream pause/resume or mode change.
- `file_processed`: Emitted when a file in `data/incoming` is processed and archived.

---

## 9. Running Automated Tests

Run the full pytest suite:
```powershell
cd backend
.\venv\Scripts\activate
$env:PYTHONPATH=".;.."
python -m pytest ..\tests -v
```

All 14 tests verify:
- AES-256-GCM encryption, decryption, and tamper detection.
- ECDSA NIST P-256 signature verification and corruption detection.
- SHA-256 payload integrity hashing.
- Sliding-window freshness and nonce replay prevention.
- Deterministic 0-100 Trust Score engine breakdown.
- Continuous file watcher detection and automatic archiving.
- API endpoints and strict secret key masking.

---

## 10. Deploying to Vercel

SecureLink is fully unified for zero-configuration, 1-click deployment on Vercel with both frontend and backend integrated.

### Zero-Config Deployment
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New... -> Project"**.
2. Select your repository: `TharunTirumala/securedatalink`.
3. Leave all settings at their defaults (Root Directory: `./`).
4. Click **Deploy**.

Vercel will automatically:
- Detect the Vite React frontend at the root and build it via `npm run build`.
- Detect the Python FastAPI serverless application at `api/index.py` using `requirements.txt`.
- Configure `vercel.json` routing so all `/api/*` requests go directly to the FastAPI serverless API, and all other routes go to the React SPA with zero Mixed-Content or CORS issues.
- Provide client-side tactical telemetry simulation fallback directly in the browser if running disconnected from a live network feed.
