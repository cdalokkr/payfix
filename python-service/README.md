---
title: PayFix Face AI Service (Develop Optimized)
emoji: ⚡
colorFrom: indigo
colorTo: blue
sdk: gradio
app_file: gradio_app.py
pinned: false
---

# PayFix Face AI Biometric Microservice (v2.1)

High-speed 512-d ArcFace extraction, server-side canonical 3:4 portraits, and
passive liveness checks for PayFix enrollment, PWA attendance, and kiosk
attendance. This Gradio Space hosts the optimized FastAPI routes on paid
CPU-capable Gradio infrastructure and uses a bounded CPU inference
configuration for predictable multi-frame latency. Hugging Face ZeroGPU is not
an equivalent production target for this CPU/ONNX service: it is quota-limited,
queue-based GPU infrastructure rather than persistent CPU hosting.

## Endpoints

- `GET /health` — Health Check, model warm status, and performance configuration
- `POST /extract` — Extract 512-d ArcFace & 128-d Vector + Liveness Assessment
- `POST /compare` — Compare two face embeddings (Cosine dot product)
- `POST /verify-live` — Live image vs stored embedding 1-step verification

The Space's `FACE_API_TOKEN` secret protects all biometric routes. The public
Space URL is configured only through PayFix's `DEV_FACE_API_URL`, and the
corresponding PayFix server secret is `DEV_FACE_API_TOKEN`. Neither value is
hardcoded in application source.
