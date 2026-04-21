# Agent Instructions

## Branch & Deployment Strategy

This project uses a two-branch workflow on Vercel:

| Branch | Vercel Deployment | Purpose |
|--------|-------------------|---------|
| `main` | Production URL | Stable, tested version — only updated when features are confirmed working |
| `beta` | Preview/alias URL | Active development and testing of new features |

### Rules

- **All new feature work happens on `beta`**. Never develop directly on `main`.
- Pushing to `beta` auto-deploys to the Vercel beta preview URL.
- When a feature is tested and approved on `beta`, merge into `main` to promote it to production.
- After merging to `main`, always switch back to `beta` to continue development.

### Common Commands

```bash
# Switch to beta to continue working
git checkout beta

# Commit and deploy to beta
git add .
git commit -m "description of change"
git push

# Promote beta → production
git checkout main
git merge beta
git push
git checkout beta   # return to beta immediately after
```

### Keeping branches in sync (e.g. after a hotfix on main)

```bash
git checkout beta
git merge main
git push
```
