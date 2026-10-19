---
type: Fixed
pr: 5510
---
**Gates now accept phase directories under a symlinked out-of-repo .planning** — check decision-coverage-plan, check gap-analysis.plan-post and every other gate taking a path argument no longer fail with "path escapes its allowed directory"; paths outside the project and its own .planning are still refused (#5474).
