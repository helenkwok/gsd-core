---
type: Fixed
pr: 5510
---
check decision-coverage-plan and check gap-analysis.plan-post (and every other gate that takes a path argument) now accept a phase directory reached through a symlinked, out-of-repo .planning instead of refusing it with path escapes its allowed directory; paths outside the project and its own .planning are still refused (#5474).
