import base64
import io
import os
import sys
from typing import List, Optional
import numpy as np
from PIL import Image

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ImportError:
    print("FastAPI not installed. Please run: pip install fastapi uvicorn")
    sys.exit(1)

# Check if face_recognition can be imported
FACE_REC_SUPPORT = True
try:
    import face_recognition
except ImportError as e:
    print("\n" + "="*80)
    print("WARNING: 'face_recognition' library (requires dlib) could not be imported.")
    print("The service will run in MOCK/FALLBACK mode.")
    print("To run in production mode, make sure CMake and dlib are installed, then:")
    print("  pip install face-recognition")
    print("="*80 + "\n")
    FACE_REC_SUPPORT = False

app = FastAPI(
    title="PayFix Face Vector Service",
    description="Extracts 128-dimensional face embedding vectors for high-performance matching",
    version="1.0.0"
)

# Enable CORS for local cross-origin development calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    image_base64: str  # Base64 encoded image (can start with data:image/jpeg;base64, etc.)

class ExtractResponse(BaseModel):
    success: bool
    embedding: Optional[List[float]] = None
    error: Optional[str] = None
    face_detected: bool

class CompareRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]
    threshold: Optional[float] = 0.5  # Euclidean threshold (lower = stricter)

class CompareResponse(BaseModel):
    matched: bool
    distance: float
    similarity: float

# ─── Helper Functions ──────────────────────────────────────────────────────────

def decode_base64_image(base64_str: str) -> Image.Image:
    """
    Decodes a base64 string (including data URL prefix) into a PIL Image.
    """
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    
    try:
        image_data = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_data))
        # Ensure it is RGB format (required by face_recognition)
        if image.mode != "RGB":
            image = image.convert("RGB")
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

def mock_extract_embedding(image: Image.Image) -> List[float]:
    """
    Fallback mock vector generator.
    Generates a deterministic 128-dimensional vector based on the image's average colors 
    and grid pixel values to allow end-to-end flow integration if dlib is missing.
    """
    # Resize to 32x32 for speed
    img_small = image.resize((32, 32))
    pixels = np.array(img_small, dtype=float)
    
    # Flatten and normalize
    flat = pixels.flatten()
    mean = np.mean(flat)
    std = np.std(flat) if np.std(flat) > 0 else 1.0
    normalized = (flat - mean) / std
    
    # Take first 128 elements (32 * 32 * 3 = 3072 total values)
    embedding = normalized[:128].tolist()
    
    # Ensure it has exactly 128 elements and is padded with zeros if smaller
    if len(embedding) < 128:
        embedding = embedding + [0.0] * (128 - len(embedding))
        
    return embedding

# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "backend": "face_recognition (dlib)" if FACE_REC_SUPPORT else "mock_fallback_mode",
        "python_version": sys.version
    }

@app.post("/extract", response_model=ExtractResponse)
def extract_face_vector(payload: ExtractRequest):
    try:
        # 1. Decode base64 to image
        pil_image = decode_base64_image(payload.image_base64)
        
        if not FACE_REC_SUPPORT:
            # Fallback mock mode
            mock_emb = mock_extract_embedding(pil_image)
            return ExtractResponse(
                success=True,
                embedding=mock_emb,
                face_detected=True,
                error="Running in mock fallback mode (face_recognition / dlib not installed on server)"
            )
            
        # Convert PIL to numpy RGB array
        image_np = np.array(pil_image)
        
        # 2. Find face locations (using HOG model for CPU speed)
        face_locations = face_recognition.face_locations(image_np, model="hog")
        if not face_locations:
            return ExtractResponse(
                success=False,
                embedding=None,
                face_detected=False,
                error="No face detected in the image"
            )
            
        # 3. Extract 128-d face encodings (vectors)
        # We take the first face detected
        encodings = face_recognition.face_encodings(image_np, known_face_locations=face_locations)
        if not encodings:
            return ExtractResponse(
                success=False,
                embedding=None,
                face_detected=False,
                error="Could not compute face descriptor"
            )
            
        # Convert numpy array to standard list of floats
        embedding = encodings[0].tolist()
        
        return ExtractResponse(
            success=True,
            embedding=embedding,
            face_detected=True
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        return ExtractResponse(
            success=False,
            embedding=None,
            face_detected=False,
            error=f"Internal extraction error: {str(e)}"
        )

@app.post("/compare", response_model=CompareResponse)
def compare_face_vectors(payload: CompareRequest):
    emb1 = np.array(payload.embedding1)
    emb2 = np.array(payload.embedding2)
    
    # Calculate Euclidean distance
    distance = float(np.linalg.norm(emb1 - emb2))
    
    # Convert distance to similarity score
    # face-recognition distance ranges typically from 0 to 1.2
    # Standard threshold is 0.6. Distance < 0.6 = same person.
    # similarity = max(0, 1 - distance)
    similarity = max(0.0, 1.0 - distance)
    matched = distance < payload.threshold
    
    return CompareResponse(
        matched=matched,
        distance=distance,
        similarity=similarity
    )

if __name__ == "__main__":
    import uvicorn
    # Use environment variables for host/port configuration
    host = os.getenv("FACE_API_HOST", "0.0.0.0")
    port = int(os.getenv("FACE_API_PORT", "8000"))
    
    print(f"Starting Face Vector Service on {host}:{port}")
    if not FACE_REC_SUPPORT:
        print("!!! RUNNING IN FALLBACK MOCK MODE !!!")
        
    uvicorn.run(app, host=host, port=port)
