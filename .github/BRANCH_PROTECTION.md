# Branch Protection for `main`

Set these rules via **GitHub Web UI**: Repository → Settings → Branches → Add rule → `main`

## Steps

1. Go to **Settings → Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable the following options:

### Required status checks
- ✅ **Require status checks to pass before merging**
- **Contexts**: `CI Test`
  - (Your workflow `.github/workflows/ci.yml` reports this check name)

### Pull request reviews
- ✅ **Require pull request reviews before merging**
- Select **Code review** (any reviewer)
- ✅ **Dismiss stale pull request reviews when a new commit is pushed**

### Additional recommended
- ✅ **Include administrators** (applies protections to repo admins/owner too)
- ✅ **Require review before merging** (makes the Merge button require approval)

### Optional
- ✅ **Require linear history** (squash/merge only, no rebase-merge)
- ✅ **Require conversation resolution** (threads must be resolved before merge)
- ❌ **Allow auto-merge** (keep off until you understand it)

4. Click **Save rule**

## Result

The "Merge pull request" button in GitHub will be **disabled** until **all** of the following are true:

| Condition | What happens |
|---|---|
| **Tests pass** | CI runs on Ubuntu + Windows (`.github/workflows/ci.yml`); both must pass |
| **You approve** | Someone (you or a collaborator) leaves a review → Approve |
| **Both above** | Merge button enables; click to merge |

## Verification after setup

```bash
# Push a commit to main → CI runs automatically
git commit --allow-empty -m "test: verify protection" && git push origin main

# Open a PR against main → Tests run; merge button stays disabled until you approve
```

## Notes

- The CI workflow runs on **both** `ubuntu-latest` and `windows-latest` (matrix strategy)
- If you need to bypass temporarily, remove the protection rule, push, then re-add it
- This works with the `workflow_dispatch` trigger in the CI file (manual runs from the Actions tab)