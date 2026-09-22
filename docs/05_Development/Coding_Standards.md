# PillCare - Coding Standards & Engineering Guidelines

## 1. TypeScript & React Native Standards
- **Strict Mode**: `noImplicitAny`, `strictNullChecks` enforced in `tsconfig.json`.
- **Component Architecture**: Functional components only; use hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
- **File Naming**: PascalCase for components (`RefillModal.tsx`), camelCase for utilities (`analytics.ts`).
- **Styles**: Use Vanilla CSS / React Native `StyleSheet.create`. No ad-hoc inline styling objects inside render loops.

---

## 2. Python Backend Standards (FastAPI)
- **PEP 8 Compliance**: Follow PEP 8 formatting rules.
- **Type Annotations**: All endpoint function signatures must include Python type hints (`Pydantic` schemas).
- **Asynchronous Execution**: Use `async def` for I/O bound endpoints.

---

## 3. Strict Directive: Code Push Permission Rule
> [!CAUTION]
> **USER CONSENT MANDATORY**: Per developer directive, no code changes or documentation updates shall be pushed to remote Git (`git push origin main`) without presenting the changes and obtaining explicit user consent.
