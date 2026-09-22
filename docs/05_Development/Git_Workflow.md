# PillCare - Git Workflow & Release Strategy

## 1. Branching Strategy

```text
  main (Production Deployment & Releases)
   ^
   |  (Pull Request after QA Approval)
  feature/*  or  fix/*
```

- **`main`**: Production ready code. Automatically triggers GitHub Actions build pipelines.
- **`feature/<name>`**: Isolated feature development branches.
- **`fix/<bug-id>`**: Bug fixes and hotfixes.

---

## 2. Commit Message Conventions
Follow Conventional Commits format:
- `feat(analytics)`: Add Healthcare Intelligence endpoints
- `fix(ci)`: Fix gradlew script path in GitHub Actions workflow
- `docs(prd)`: Update Product Requirements Document
- `refactor(ui)`: Optimize RefillModal render cycle

---

## 3. Mandatory User Permission Rule for Git Push
Before running `git push origin main`:
1. Verify `npx tsc --noEmit` returns exit code 0.
2. Run backend 17-point monkey test (`python backend/scratch/full_monkey_end_to_end_test.py`).
3. **STOP AND REQUEST USER CONSENT**: Confirm with the user before executing `git push`.
