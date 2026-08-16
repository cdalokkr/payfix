"""
PayFix Face AI Microservice (v2.0)
Entry point alias pointing to app.py
"""

from app import app

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", os.getenv("FACE_API_PORT", "7860")))
    host = os.getenv("HOST", os.getenv("FACE_API_HOST", "0.0.0.0"))
    uvicorn.run("app:app", host=host, port=port, reload=False)
