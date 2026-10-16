# PillCare Engineering Agent Directives — Defend What You Ship

Welcome, Agent. This repository adheres to the **"Defend What You Ship" (Whiteboard Defense)** standard.
You are not here to generate code blindly; you are here to collaborate with the engineer so that every change is defensible, secure, maintainable, and verified.

---

## 1. Non-Negotiable Instructions for AI Sessions

1. **Read First, Update Last**:
   - **START**: Always inspect [`docs/HANDOVER.md`](docs/HANDOVER.md), [`docs/CONSTRAINTS.md`](docs/CONSTRAINTS.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before writing or suggesting code changes.
   - **END**: Always update [`docs/HANDOVER.md`](docs/HANDOVER.md) with session progress and risks.

2. **Always State Why Before What**:
   - Before writing or changing code, explain your plan, what could go wrong, and what alternatives exist.
   - Obtain user approval on the plan before generating code.

3. **Log Architecture & Design Decisions**:
   - Every non-trivial change, new dependency, caching strategy, or schema shift must be appended to [`docs/DECISIONS.md`](docs/DECISIONS.md) using the standard format (Context, Options, Chosen, Why, Trade-off, Revisit If, Model + Date).
   - Document rejected alternatives in [`docs/ALTERNATIVES.md`](docs/ALTERNATIVES.md).

4. **Observe the Two Lanes**:
   - **Lane A (PoC/Experimental)**: Rapid testing, throwaway code.
   - **Lane B (Customer-Facing/Production)**: Full defense required. If a customer or patient touches it, or clinical medication schedules are affected, it is strictly Lane B.
   - Never release Lane B code without completing [`docs/TESTING.md`](docs/TESTING.md) and verifying the Pre-Ship Gate.

5. **Permission & Allow Hygiene**:
   - **Auto-Allow**: Code formatting, reading files, searching code, running typechecks (`npx tsc --noEmit`), running tests.
   - **Pause & Explain**: Multi-file edits, schema changes, config/build changes, adding npm/pip packages, deleting files.
   - **Never Execute Without Explicit User Prompt**: Modifying production secrets, `.env` files, production database drops, git force pushes, or running unverified shell scripts.

---

## 2. Directory Layout for Project Documentation

```
docs/
├── HANDOVER.md         # Living session handoff: Done, In Progress, Broken, Next, Do Not Touch
├── DECISIONS.md        # Architectural decision records (ADRs) with rationale & model attribution
├── ALTERNATIVES.md     # Catalog of rejected options & trade-offs
├── ARCHITECTURE.md     # 1-page system map, modules, data flow, trust boundaries
├── FLOW.md             # End-to-end execution path traces
├── CONSTRAINTS.md      # Absolute off-limits rules (never, always, only)
├── THREAT.md           # Security threat model: actors, attack surfaces, mitigations
├── FAILURE.md          # Resilience map: dependency failures, rate limits, alerts
├── DATA.md             # Key data structures, schemas, storage access patterns
├── TESTING.md          # Verification commands, pass criteria, real output logs
├── ROLLBACK.md         # Disaster recovery, rollback commits, feature flags
├── defense/            # Whiteboard defense briefs per shipped subsystem
├── features/           # Feature specification and progress traces
└── bugs/               # Root cause analysis & verification traces for production bugs
```

Refer to `.agents/rules/defend-what-you-ship.md` for the complete 25-habits specification.
