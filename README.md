# ReflectAI Journal — User-Authenticated Personal Reflection & AI Journal

ReflectAI is a secure, user-authenticated journaling and personal reflection web application powered by **Gemini 3.6 Flash** and **Cloud Firestore**. Every reflection, conversation turn, and executive summary is cryptographically isolated to the individual authenticated user under `/users/{userId}/interactions/{interactionId}`.

---

## Architecture & Security Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Browser Client                                │
│  - Firebase Authentication (Google Sign-In Popup)                      │
│  - Cloud Firestore Client SDK (Direct owner-isolated read/write)       │
│  - Zero raw passwords stored or transmitted                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         REST API   │  (No API keys in client)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Node.js Express Server                          │
│  - Strict request deserialization & null-safe payload ingestion        │
│  - Secret Manager / Env Var injection (GEMINI_API_KEY)                 │
│  - Resilient Gemini Fallback Ladder (gemini-3.6-flash -> fallbacks)    │
│  - Serves compiled Vite SPA in production                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Google Cloud Platform                          │
│  - Cloud Firestore: Document Isolation (request.auth.uid == userId)   │
│  - Secret Manager: Zero-hardcoding credential hygiene                  │
│  - Cloud Run: Containerized serverless deployment                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Environment & Prerequisites

Ensure the following tools are installed on your workstation:
- **Node.js** (v20+ recommended)
- **Google Cloud SDK (`gcloud` CLI)**
- **Firebase CLI (`npm install -g firebase-tools`)**

### Enable Required Google Cloud APIs

```bash
# Set your active project ID
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable Cloud Run, Secret Manager, and Cloud Firestore APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 2. Secret Management Setup (Zero-Hardcoding Hygiene)

We use Google Cloud Secret Manager to manage the `GEMINI_API_KEY` securely without checking secrets into source code:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the default Cloud Run compute service account access to read the secret
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration (Cloud Firestore)

ReflectAI strictly enforces owner-isolated document storage so that users can only read and write their own journal entries and reflections.

### `firestore.rules`

Deploy the following security rules configuration:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Configure environment variables in .env
cp .env.example .env
# Set GEMINI_API_KEY in .env

# Run unified full-stack development server (Express + Vite)
npm run dev
```

Visit `http://localhost:3000` to interact with the application.

---

## 5. Cloud Run Deployment Flow

Build and deploy the application container directly to Google Cloud Run:

```bash
export SERVICE_NAME="reflectai-app"
export REGION="asia-southeast1" # or your preferred region e.g. us-central1

# Deploy container to Cloud Run with Secret Manager binding
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

---

## 6. Required Campaign Verification Binding

Apply the mandatory challenge verification label to your deployed Cloud Run service:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

Verify the labels:
```bash
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(metadata.labels)"
```

---

## 7. Model Resilience & Fallback Protocol

The backend implements an automated fallback ladder to ensure uninterrupted availability:
1. **Primary Model**: `gemini-3.6-flash`
2. **High-Availability Fallback**: `gemini-3.1-flash-lite`
3. **Dynamic Alias**: `gemini-flash-latest`
4. **Deep Reasoning Fallback**: `gemini-3.7-flash`

Recoverable HTTP status codes (`503 UNAVAILABLE`, `429 RESOURCE_EXHAUSTED`, `404 NOT_FOUND`, `500 INTERNAL`) trigger immediate graceful failover down the chain.
