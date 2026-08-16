---
title: PayFix Face AI Service (Develop)
emoji: ⚡
colorFrom: indigo
colorTo: blue
sdk: gradio
app_file: app.py
pinned: false
---

# PayFix Face AI Biometric Microservice (v2.0)

High-Speed 512-d ArcFace Vector Extraction & Passive Anti-Spoof Liveness API for PayFix HRMS & Biometric Attendance.

## Endpoints

- `GET /` — Interactive Test Console
- `GET /health` — Health Check & Memory Status
- `POST /extract` — Extract 512-d ArcFace & 128-d Vector + Liveness Assessment
- `POST /compare` — Compare two face embeddings (Cosine dot product)
- `POST /verify-live` — Live image vs stored embedding 1-step verification
