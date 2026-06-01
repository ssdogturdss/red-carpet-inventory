# Branch Protection Recommendations

These settings cannot be applied automatically — a repository admin must configure them in **Settings → Branches → Branch protection rules** for the `main` branch.

## Recommended rules for `main`

| Setting | Value | Reason |
|---|---|---|
| Require a pull request before merging | ✅ Enabled | Prevents direct pushes; enforces review |
| Required approvals | 1 | Minimum peer review |
| Dismiss stale pull request approvals when new commits are pushed | ✅ Enabled | Re-review after force-pushes |
| Require status checks to pass before merging | ✅ Enabled | Blocks broken code |
| Required status checks | `Typecheck`, `Build API Server` | From `ci.yml` |
| Require branches to be up to date before merging | ✅ Enabled | Prevents merge-race regressions |
| Require conversation resolution before merging | ✅ Enabled | All review comments addressed |
| Restrict who can push to matching branches | Admins only | Enforces PR flow |
| Allow force pushes | ❌ Disabled | Preserves history |
| Allow deletions | ❌ Disabled | Prevents accidental branch removal |

## Recommended Rulesets (modern alternative)

GitHub Rulesets (Settings → Rules → Rulesets) are the newer equivalent and support enforcement levels:

- **Enforcement**: Active
- **Target**: `refs/heads/main`
- **Rules**: require pull request (1 approval), require status checks (`Typecheck`, `Build API Server`), restrict deletion, restrict force push

## Release Please integration

`release-please.yml` creates and merges release PRs automatically via the `GITHUB_TOKEN`. Ensure the token has:
- `contents: write`
- `pull-requests: write`

These are already declared in the workflow file.
