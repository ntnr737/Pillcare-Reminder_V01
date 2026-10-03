# Git Push & Tag User Confirmation Policy

## MANDATORY RULE FOR AGENT (ANTIGRAVITY)
Before executing any `git push`, `git tag`, or remote deployment command:
1. You MUST ask the user for explicit confirmation.
2. Clearly state the commit message, target branch, and destination remote repository.
3. Wait for the user's explicit approval before executing `git push` or `git tag`.

NEVER auto-push code to `origin/main` or create remote tags automatically during routine bug fixes, optimizations, or refactoring tasks.
