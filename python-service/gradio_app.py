"""Authenticated Gradio host for the optimized PayFix face service.

The Space UI is intentionally informational only. PayFix talks to the custom
FastAPI routes below, so the Gradio event API is never part of biometric
authorization or matching.
"""

import hmac
import os
from typing import Any, Dict, Optional

import gradio as gr
import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException

import optimized_app as service


SPACE_API_TOKEN = os.getenv("FACE_API_TOKEN", "")


def require_api_token(authorization: Optional[str] = Header(default=None)) -> None:
    """Protect biometric routes when the Space is public or shared."""
    if not SPACE_API_TOKEN:
        raise HTTPException(status_code=503, detail="FACE_API_TOKEN is not configured")
    expected = f"Bearer {SPACE_API_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Authentication required")


# Gradio is the Space runtime. The UI deliberately does not accept
# face images or display embeddings; it exists only to make the Space healthy
# and observable in a browser.
with gr.Blocks(title="PayFix Biometric Service") as demo:
    gr.Markdown(
        "# PayFix Biometric Service\n"
        "This Space hosts the server-side biometric API for the develop preview. "
        "Biometric routes require the PayFix service token."
    )


api = FastAPI(title="PayFix Biometric Service", docs_url=None, redoc_url=None)


@api.get("/health")
def health() -> Dict[str, Any]:
    return service.health()


@api.post("/extract", response_model=service.ExtractResponse, dependencies=[Depends(require_api_token)])
def extract_endpoint(payload: service.ExtractRequest) -> service.ExtractResponse:
    return service.extract(payload)


@api.post("/compare", response_model=service.CompareResponse, dependencies=[Depends(require_api_token)])
def compare_endpoint(payload: service.CompareRequest) -> service.CompareResponse:
    return service.compare(payload)


@api.post("/verify-live", response_model=service.VerifyLiveResponse, dependencies=[Depends(require_api_token)])
def verify_live_endpoint(payload: service.VerifyLiveRequest) -> service.VerifyLiveResponse:
    result = service.extract(service.ExtractRequest(
        image_base64=payload.image_base64,
        require_512=len(payload.stored_embedding) == 512,
        require_128=len(payload.stored_embedding) == 128,
    ))
    if not result.success or not result.embedding:
        return service.VerifyLiveResponse(
            success=False,
            matched=False,
            similarity=0,
            is_live=False,
            liveness_score=0,
            face_detected=result.face_detected,
            error_code=result.error_code,
            error_message=result.error_message,
            diagnostics=result.diagnostics,
        )
    comparison = service.compare(service.CompareRequest(
        embedding1=result.embedding,
        embedding2=payload.stored_embedding,
        threshold=payload.threshold,
    ))
    return service.VerifyLiveResponse(
        success=True,
        matched=comparison.matched,
        similarity=comparison.similarity,
        is_live=result.is_live,
        liveness_score=result.liveness_score,
        face_detected=True,
        diagnostics=result.diagnostics,
    )


# Mount after API route registration so /health and the authenticated biometric
# routes always win over the Gradio UI's root mount.
app = gr.mount_gradio_app(api, demo, path="/")


if __name__ == "__main__":
    # Gradio Spaces set PORT when needed; local smoke tests use 7860. Running
    # Uvicorn keeps the custom FastAPI routes intact instead of letting
    # Blocks.launch recreate the internal application.
    service.get_session()
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))