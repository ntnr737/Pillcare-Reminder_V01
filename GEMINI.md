# MANDATORY AGENT DIRECTIVE: WHITEBOARD DEFENSE & "DEFEND WHAT YOU SHIP" PROTOCOL

> **CRITICAL INSTRUCTION FOR ALL AI AGENTS & CODING SESSIONS**:
> You must strictly obey the following 6-step lifecycle and rules on EVERY task, feature, bug fix, or refactor. Do NOT generate code blindly. Every change you propose or make must be defensible at a whiteboard.

---

## 1. The Mandatory 6-Step Agent Execution Loop

Whenever you are invoked, you MUST follow these steps in exact chronological sequence:

```
┌────────────────────────────────────────────────────────┐
│  STEP 1: Read Context First (HANDOVER, CONSTRAINTS)    │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  STEP 2: Ask Why Before What (Plan & Alternatives)     │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  STEP 3: Classify Lane (Lane A: PoC vs Lane B: Prod)   │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  STEP 4: Record Decisions (DECISIONS.md, ALTERNATIVES) │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  STEP 5: Code with Explicit Intent & Scoped Permission │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│  STEP 6: Real Verification & Handoff (TESTING, GATE)   │
└────────────────────────────────────────────────────────┘
```

### Step 1: Read Context First (Amnesia Prevention)
- At the start of the session, ALWAYS view:
  1. `docs/HANDOVER.md` (to see what is Done, In progress, Broken/Risky, Next, and Do Not Touch).
  2. `docs/CONSTRAINTS.md` (to know protected areas: auth, payments, medication schedules, cloud billing).
  3. `docs/ARCHITECTURE.md` (to review the high-level system map and trust boundaries).
- Never re-ask questions or re-derive decisions that are already documented.

### Step 2: Ask Why Before What (Plan First)
- Before implementing or editing code, explain:
  1. The proposed plan and architectural approach.
  2. What could go wrong with this plan.
  3. What alternatives were rejected and why this choice was selected.
- Obtain user approval on the plan before generating code.

### Step 3: Classify the Lane (Lane A vs Lane B)
- **Lane A (PoC / Experiment / Demo)**: If the code is throwaway and no user touches it, speed over quality is allowed.
- **Lane B (Customer-Facing / Production)**: If a patient, doctor, user, payment, or data is touched, it is **Lane B**. Full defense is required.
- *The Promotion Rule*: The moment a PoC gets a real user or release tag, its defense must be written before it stays live.

### Step 4: Record Architectural Decisions (ADRs)
- For every non-trivial design choice, append an entry to `docs/DECISIONS.md` using the standard format:
  `Context`, `Options`, `Chosen`, `Why`, `Trade-off`, `Revisit If`, `Model + Date`.
- Record rejected options in `docs/ALTERNATIVES.md`.

### Step 5: Code with Explicit Intent & Least Privilege
- **Comments**: Comment intent, assumptions, and invariants (e.g. `// Invariant: must run after auth check`). Never comment obvious syntax.
- **Scope Control**: One logical behavior change per step. Never stack unrelated changes.
- **Permission Policy**:
  - **Auto-Allow**: Reading files, searching code, running type checks (`npx tsc --noEmit`), running tests.
  - **Pause and Read**: Modifying config/build files, database writes/migrations, auth changes, adding dependencies, deleting files.
  - **Never Auto-Allow**: Modifying `.env` or credentials, production DB operations, git force pushes, disabling tests/security checks, piping shell scripts into bash.

### Step 6: Real Verification & Session Handoff
- Run real test commands (e.g., `npx tsc --noEmit`, Python compilation, test scripts).
- Record actual terminal outputs in `docs/TESTING.md`. Never claim tests pass without real terminal execution proof.
- Verify the **Pre-Ship Gate Checklist** before closing the task.
- Update `docs/HANDOVER.md` with the 5-line summary: Done, In Progress, Broken/Risky, Next, and Do Not Touch.

---

## 2. The Four Whiteboard Defense Questions

You must always be ready to answer these 4 questions without notes:
1. **"Why did you do X instead of Y?"** (Documented in `docs/DECISIONS.md`, `docs/ALTERNATIVES.md`)
2. **"What happens if this actor behaves maliciously?"** (Documented in `docs/THREAT.md`, `docs/CONSTRAINTS.md`)
3. **"What data structure did you use here and why?"** (Documented in `docs/DATA.md`, `docs/FLOW.md`)
4. **"Where does this fail?"** (Documented in `docs/FAILURE.md`, `docs/TESTING.md`, `docs/ROLLBACK.md`)

---

## 3. The 14-Point Pre-Ship Gate Checklist

Before anything in Lane B ships:
- [ ] 1. I can explain how this works at a high level, without notes.
- [ ] 2. `docs/defense/DEFENSE-XXX.md` is written in my own words and is current.
- [ ] 3. I know why we chose this approach over at least one alternative.
- [ ] 4. I can name who could abuse it and what stops them (`docs/THREAT.md`).
- [ ] 5. I know the first place it will fail and how I would notice (`docs/FAILURE.md`).
- [ ] 6. I know the main data structures and why they fit (`docs/DATA.md`).
- [ ] 7. I read the full diff, not just the AI summary.
- [ ] 8. Tests ran and I saw real output (`docs/TESTING.md`).
- [ ] 9. A customer path was tried by hand end to end.
- [ ] 10. No secrets, keys or tokens landed in the code.
- [ ] 11. New dependencies are justified, version-pinned, and logged.
- [ ] 12. Rollback steps are written and the last good commit is known (`docs/ROLLBACK.md`).
- [ ] 13. Unverified assumptions are cleared or consciously accepted.
- [ ] 14. `docs/HANDOVER.md` and `docs/DECISIONS.md` are updated.
