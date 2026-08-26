# PayFix legacy 128-d Hugging Face service

This directory is the hardened replacement for the legacy `FACE_API_URL`
Hugging Face Docker Space used by the `main` branch.

## Deploy it to the existing Space

1. In the Space repository, replace its root `main.py` and `Dockerfile` with
   the files from this directory.
2. Commit the change and wait for the Docker Space build to complete.
3. Confirm `GET /health` returns `"status": "healthy"`, `"dimensions": 128`,
   and `"backend": "face_recognition (dlib)"`.
4. Keep the existing Space URL as the Vercel Production `FACE_API_URL`.
5. Do not set `FACE_API_MOCK`; the application now fails closed if the face
   service cannot verify a real 128-d descriptor.

The service accepts only a single face, rejects unavailable model support and
invalid vectors, and retains the legacy `POST /extract` and `POST /compare`
endpoints. It is intentionally separate from the 512-d service used by
`develop`.