# Architecture Deep Dive

## System Design

```
Browser
   │
   │  HTTP (REST)
   ▼
React Frontend (Vite · port 5173)
   │
   │  Proxy → localhost:8000
   ▼
FastAPI Backend (Uvicorn · port 8000)
   │
   ├── POST /stylize ──────────────────────► Background Thread
   │      returns job_id immediately              │
   │                                              │ run_style_transfer()
   ├── GET /status/{id} ◄── poll every 3s ────── │ (3-8 min CPU)
   │      returns progress 0.0→1.0               │
   │                                              │
   └── GET /result/{id} ◄──── completed ◄────────┘
          returns PNG file

NST Engine (nst_engine.py)
   ├── load_image()           PIL → normalized tensor
   ├── ContentLoss            MSE on conv4_2 features
   ├── StyleLoss              MSE on Gram matrices (5 layers)
   ├── build_model_and_losses() VGG-19 with loss modules inserted
   └── run_style_transfer()   L-BFGS optimization loop
```

## Data Flow

1. User uploads content + style image via React UI
2. FastAPI validates files, saves to `uploads/`
3. BackgroundTask starts NST engine in thread
4. Client polls `/status/{id}` every 3 seconds
5. Progress updates flow: engine → job record → API → UI
6. On completion, result saved to `outputs/`
7. Client downloads from `/result/{id}`
8. User can download PNG directly
