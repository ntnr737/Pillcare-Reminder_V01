# Defend What You Ship — AI Engineering Rules & Whiteboard Defense Protocol

> **Reference**: "DEFEND WHAT YOU SHIP: 25 Habits for Using AI Without Losing the Plot, and the One Test That Keeps You Honest" (v2 Whiteboard Edition).
> **Scope**: Mandatory for all AI assistants, agents, and engineers operating within this repository.

---

## 1. The Core Benchmark: The Whiteboard Defense

> *"I should be able to pull you aside at any moment and ask you to explain any customer-facing system you have shipped. You should be able to clearly explain how it works and defend the decisions you made."*

### What is Expected:
1. A clear, confident, high-level explanation of how the system works.
2. The ability to defend the design decisions behind it with trade-offs.
3. Honest, concrete answers about where the system breaks, its limits, and how it could be abused.

### The Four Questions (Must Always Be Answerable):
1. **"Why did you do X instead of Y?"** (Red flag: *"The AI suggested it."* Backed up with: `docs/DECISIONS.md`, `docs/ALTERNATIVES.md`)
2. **"What happens if this actor behaves maliciously?"** (Red flag: *"Users wouldn't do that."* Backed up with: `docs/THREAT.md`, `docs/CONSTRAINTS.md`)
3. **"What data structure did you use here and why?"** (Red flag: Not knowing why it fits the access pattern. Backed up with: `docs/DATA.md`, `docs/FLOW.md`)
4. **"Where does this fail?"** (Red flag: *"It shouldn't fail."* Backed up with: `docs/FAILURE.md`, `docs/TESTING.md`, `docs/ROLLBACK.md`)

---

## 2. The Two Lanes

Before touching any code, determine which lane you are in:

| Attribute | Lane A: PoC, Demo, Experiment | Lane B: Customer Facing (Production) |
| :--- | :--- | :--- |
| **Goal** | Learn fast, test idea, throw away if fails. | Serve real users reliably, safely, and cost-effectively. |
| **AI Usage** | Generate 100% of it. | Use AI heavily, but stay the author of the decisions. |
| **Understanding** | Minimal needed. | High-level mental model; defensible at a whiteboard. |
| **Priority** | Speed over quality. | Correctness, safety, security, and clarity over speed. |
| **Required Docs** | None needed. | `docs/` core files, `docs/defense/DEFENSE-*.md`, Pre-Ship Gate. |
| **Failure Impact**| Nobody harmed; delete it. | Users, patient health, clinical data, or billing affected. |

> **The Promotion Rule**: The instant a PoC touches a real user or enters a customer-facing release, it moves to Lane B. Its defense **must** be written before it stays live.  
> **Quick Test**: *"If this broke tonight, would a customer notice or be harmed?"* If yes, you are in **Lane B**.

---

## 3. Mandatory AI Session Lifecycle

Every AI session MUST execute the following sequence:

### A. Start of Session (Read First)
1. Read `docs/HANDOVER.md` to pick up exact context without amnesia.
2. Read `docs/CONSTRAINTS.md` to know what is strictly forbidden.
3. Read `docs/ARCHITECTURE.md` to maintain the high-level system mental model.

### B. During Implementation (Directing, Not Approving)
1. **Ask Why Before What (Habit 11)**: Explain the proposed plan, potential pitfalls, and alternatives *before* editing code. Never generate large multi-file diffs without an approved plan.
2. **Small Requests Only (Habit 12)**: One logical change per prompt/step. Never combine multiple unrelated refactors.
3. **Decisions Habit (Habit 2 & 14)**: For any meaningful design choice (library, schema change, caching TTL, background runner), append an entry to `docs/DECISIONS.md` noting the context, options, chosen reason, rejected alternatives, trade-offs, model name, and date.
4. **Explicit Comments (Habit 3)**: Document intent, invariants, and assumptions. Never comment obvious syntax.
5. **Least Privilege Execution (Habit 22)**:
   - **Safe to auto-allow**: Reading files, running linters/typechecks, local tests, searching codebase.
   - **Pause and read**: Modifying config/build files, database writes/migrations, auth changes, adding dependencies, bulk deletions.
   - **Never auto-allow**: Modifying `.env` or credentials, production DB operations, git force pushes, disabling tests/security checks, piping shell scripts.

### C. End of Session (Update Last)
1. Run real verification tests and capture actual outputs in `docs/TESTING.md`.
2. Update `docs/HANDOVER.md` with a concise 5-line status: What was Done, In Progress, Broken/Risky, Next, and Do Not Touch.
3. Confirm all unverified assumptions in `docs/bugs/` or `docs/features/` are marked and addressed.

---

## 4. The Pre-Ship Gate Checklist

Before code in Lane B is merged, tagged, or deployed, verify all 14 criteria:

- [ ] 1. I can explain how this works at a high level, without notes.
- [ ] 2. `docs/defense/DEFENSE-XXX.md` is written and current.
- [ ] 3. I know why we chose this approach over at least one alternative (`docs/ALTERNATIVES.md`).
- [ ] 4. I can name who could abuse it and what stops them (`docs/THREAT.md`).
- [ ] 5. I know the first place it will fail and how we would notice (`docs/FAILURE.md`).
- [ ] 6. I know the main data structures and why they fit (`docs/DATA.md`).
- [ ] 7. I read the full git diff, not just the AI's summary.
- [ ] 8. Tests and typechecks ran and real outputs were verified.
- [ ] 9. A customer path was tested end-to-end by hand.
- [ ] 10. No secrets, keys, or credentials landed in code or commits.
- [ ] 11. New dependencies are justified, version-pinned, and logged.
- [ ] 12. Rollback steps are written and the last good commit is known (`docs/ROLLBACK.md`).
- [ ] 13. Unverified assumptions are cleared or consciously accepted.
- [ ] 14. `docs/HANDOVER.md` and `docs/DECISIONS.md` are updated.
