# GitHub Actions → Firebase Hosting

## One-time setup (already done if you used `firebase init hosting:github`)

1. [Firebase Console](https://console.firebase.google.com/project/latexdiff/hosting) — Hosting enabled on project **latexdiff**.
2. GitHub repo **Settings → Secrets and variables → Actions** — secret **`FIREBASE_SERVICE_ACCOUNT_LATEXDIFF`** (JSON service account from Firebase).
3. **Settings → Actions → General** — “Allow all actions and reusable workflows” (or allow Firebase actions).

## What runs automatically

| Event | Workflow | Result |
|--------|-----------|--------|
| Push to `main` | `firebase-hosting-merge.yml` | Live site update |
| Pull request | `firebase-hosting-pull-request.yml` | Preview URL on the PR |

## Enable workflows on GitHub

Workflow files live in `.github/workflows/`. They only appear under the **Actions** tab after you **push them to `main`**:

```bash
git add .github/workflows/
git commit -m "Add Firebase Hosting GitHub Actions workflows"
git push origin main
```

Then open: https://github.com/jingjie00/latexdiff-ui/actions

## Check deploy worked

- Green workflow run on your commit.
- Footer on the live site shows **built … GMT** matching the run time.
