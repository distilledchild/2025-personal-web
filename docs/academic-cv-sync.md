# Academic CV Sync

## Purpose

The `/about/academics` page displays the current CV from a public PDF in Google Cloud Storage. The source of truth remains a Google Doc edited in Google Drive.

## Current Flow

1. The user edits the source CV Google Doc in Drive.
2. Cloud Scheduler calls the Cloud Run backend every 5 minutes.
3. The backend checks the Google Doc `modifiedTime`.
4. If the source changed and the quiet window has passed, the backend exports the Google Doc as PDF.
5. The backend strips a leading Google Docs tab/cover page when detected.
6. The backend uploads the cleaned PDF to GCS at `about/cv.pdf`.
7. The backend updates `ABOUT_ACADEMIC.links.cv` in MongoDB to the cache-busted GCS URL.
8. The frontend embeds that URL in the CV iframe.

## Production Resources

- Cloud Run service: `personal-web-backend`
- GCP project: `gold-surface-479021-m1`
- Scheduler job: `academic-cv-sync`
- Schedule: every 5 minutes
- Scheduler target: `POST https://api.distilledchild.space/api/admin/academic-cv/sync`
- GCS object: `gs://distilledchild/about/cv.pdf`

## Required Secrets

- `CV_SOURCE_DOC_ID`: Google Doc id of the CV source document.
- `CV_SYNC_TOKEN`: shared token used by Cloud Scheduler to call the protected sync endpoint.

These are mounted into Cloud Run through `server/cloudbuild.yaml`.

## Backend Endpoints

Run a sync:

```bash
curl -X POST "https://api.distilledchild.space/api/admin/academic-cv/sync" \
  -H "x-api-key: $CV_SYNC_TOKEN"
```

Dry-run a sync:

```bash
curl -X POST "https://api.distilledchild.space/api/admin/academic-cv/sync?dryRun=true" \
  -H "x-api-key: $CV_SYNC_TOKEN"
```

Read status:

```bash
curl "https://api.distilledchild.space/api/admin/academic-cv/status" \
  -H "x-api-key: $CV_SYNC_TOKEN"
```

## Behavior

- Default quiet window: 300 seconds.
- Default output object: `about/cv.pdf`.
- Default cache control: `public, max-age=60`.
- The published URL includes `?v=<sourceModifiedTime>` so the browser sees a fresh PDF after each publish.
- The sync state is stored in MongoDB collection `ACADEMIC_CV_SYNC_STATE`.

## Local Fallback

`server/sync-academic-cv.js` still exists as a local utility, but production no longer depends on a local `.gdoc` path or a local watcher.
