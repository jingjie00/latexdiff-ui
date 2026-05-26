# GitHub Actions → Firebase Hosting

## Setup

1. Firebase project **latexdiff** with Hosting enabled.
2. GitHub secret **`FIREBASE_SERVICE_ACCOUNT_LATEXDIFF`** (service account JSON).
3. Repo **Settings → Actions → General** → workflow permissions: **Read and write**.

## Workflows

| File | Trigger | What it does |
|------|---------|----------------|
| `firebase-hosting-merge.yml` | Push to `main` | `npm ci` → `npm run build` → `firebase deploy` (live) |
| `firebase-hosting-pull-request.yml` | Pull request | Same build → preview channel `pr-<number>` |

We deploy **`dist/`** (Vite output) via the Firebase CLI in a plain shell step. Workflows avoid extra marketplace actions (`FirebaseExtended/action-hosting-deploy`, `google-github-actions/auth`, etc.) because GitHub sometimes cannot download them from codeload (403 / internal server error).

Authentication: the service account JSON secret is written to `$RUNNER_TEMP/firebase-sa.json` and `GOOGLE_APPLICATION_CREDENTIALS` is set — no `google-github-actions/auth` action.

## Manual deploy

```bash
npm ci && npm run build
firebase deploy --only hosting --project latexdiff
```

## Verify

- [Actions tab](https://github.com/jingjie00/latexdiff-ui/actions) — green run
- Live site footer — **built … GMT** matches deploy time
