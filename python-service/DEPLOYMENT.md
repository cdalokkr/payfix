# Optimized Google Cloud Run deployment

This directory is the source for the separate **develop-only** CPU service. It
does not change the legacy 128-d service used by `main`.

The service exposes a public `/health` endpoint for readiness checks. The
biometric endpoints (`/extract`, `/compare`, and `/verify-live`) require
`Authorization: Bearer <FACE_API_TOKEN>`. Never commit the token or place it
in a Docker image.

## 1. Select a Google Cloud project

Install the Google Cloud CLI, then authenticate:

```bash
gcloud auth login
gcloud auth application-default login
gcloud projects list
gcloud config set project PROJECT_ID
```

Set the region and repository variables in your terminal:

```bash
export PROJECT_ID="$(gcloud config get-value project)"
export REGION="asia-south1"
export REPOSITORY="payfix-containers"
export SERVICE="payfix-face-service"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}:develop"
```

Enable the required APIs:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 2. Create Artifact Registry and build the container

Create the Docker repository once:

```bash
gcloud artifacts repositories create "${REPOSITORY}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="PayFix develop biometric service images"
```

Build from this directory. The build uses `Dockerfile`, downloads the pinned
ArcFace and YuNet landmark models during the image build, and does not require
models to download at runtime:

```bash
gcloud builds submit . --tag "${IMAGE}"
```

## 3. Store the service token in Secret Manager

Create a new token locally. Do not use the Hugging Face upload token:

```bash
openssl rand -base64 48
```

Create a Secret Manager secret and add the generated value through the Google
Cloud Console, or pipe it from a secure local shell without committing it:

```bash
gcloud secrets create payfix-face-api-token --replication-policy="automatic"
printf '%s' "$FACE_API_TOKEN" | \
  gcloud secrets versions add payfix-face-api-token --data-file=-
```

The `FACE_API_TOKEN` environment variable in that command must exist only in
your local shell. Use the same value for the Replit/Vercel
`DEV_FACE_API_TOKEN` secret.

Create a dedicated runtime identity and grant it access only to this secret:

```bash
gcloud iam service-accounts create payfix-face-runtime \
  --display-name="PayFix develop face service runtime"

export RUNTIME_SERVICE_ACCOUNT="payfix-face-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding payfix-face-api-token \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Deploy with scale-to-zero guardrails

Deploy the container with one instance maximum and one inference at a time:

```bash
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=1 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=1 \
  --timeout=60 \
  --set-secrets="FACE_API_TOKEN=payfix-face-api-token:latest"
```

`--allow-unauthenticated` only makes the Cloud Run URL reachable by the
PayFix server. The application rejects biometric requests without the secret
Bearer token. `/health` is intentionally unauthenticated.

## 5. Verify the service

Get the service URL:

```bash
export FACE_API_URL="$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" \
  --format='value(status.url)')"
echo "${FACE_API_URL}"
```

Check model readiness:

```bash
curl --fail "${FACE_API_URL}/health"
```

The response should report `status: "healthy"`, `version: "2.2.0"`, and
`model_ready: true`.

Confirm biometric routes reject missing authentication:

```bash
curl -i -X POST "${FACE_API_URL}/compare" \
  -H "Content-Type: application/json" \
  -d '{"embedding1":[1,0],"embedding2":[1,0]}'
```

This must return `401`.

## 6. Point only the develop deployment at Cloud Run

Set these in the develop/preview deployment environment:

```text
DEV_FACE_API_URL=<the Cloud Run service URL>
DEV_FACE_API_TOKEN=<the same value stored in Secret Manager>
```

Keep `FACE_API_URL` unchanged. It remains the legacy main service URL. Do not
paste the Cloud Run URL into application source code.

Finally test profile enrollment, PWA check-in, PWA check-out, and kiosk
check-in/out against the hardening branch before merging it into `develop`.

## Acceptance checks

- Browser preview asks for a 960 × 1280, 3:4, 24fps front stream where the
  camera supports it.
- Browser face/eye guidance runs on a 256px transient canvas at 8Hz and may
  trigger capture after a real eye blink. It never authorizes attendance.
- Uploads remain three natural 720 × 960 maximum JPEG frames.
- The server still requires one face and valid passive liveness on every frame,
  uses five server-side facial landmarks to align the ArcFace input, returns
  the server-created canonical 480 × 640 portrait, and compares 512-d
  normalized embeddings at the configured threshold.
- This alignment upgrade introduces the
  `arcface-512-yunet-5pt-v1` template format. Existing unversioned templates
  must be re-enrolled and approved before they can be used for attendance.
- The old kiosk v1 capture label remains accepted; the new kiosk sends the
  shared v2 label.