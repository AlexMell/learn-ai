Read ROADMAP.md in the repo root.

## Step 1 — Find the next task

Scan checkboxes top to bottom. Find the **first** unchecked `[ ]` task. Ignore tasks marked `?` unless the user explicitly asks to revisit them. Only ONE task per invocation — never generate multiple tasks.

If the user passed an argument ($ARGUMENTS), treat it as a task reference (e.g. "2.3" or "hooks") and jump to that task instead.

## Step 2 — Generate the task

Based on the task type:

**Code task** (mentions a `.ts` file path): create the file at the specified path in the style of existing `tasks/*.ts` files:
- Problem description as a comment block at the top: requirements, expected output, hints
- Imports and boilerplate only — the user writes the implementation themselves
- Do NOT write the solution. Hints may reference relevant files in `tutorial/definitions/` or existing examples

**Setup/config task** (Supabase tables, GitHub Actions, hooks in settings.json, MCP config): explain the steps concisely, show config snippets, but let the user execute them. Verify together afterwards.

**Reading/define task**: point to the source, remind about the `/define <topic>` and `/update-review-app` flow.

## Step 3 — State the Definition of Done

Quote the DoD from ROADMAP.md for this task so the user knows exactly when it's complete.

## Step 4 — Verify and close (when user returns with results)

When the user shows their work:
1. Review the code — check it against the DoD
2. Ask 1-2 questions to verify the user can explain their own code (rule: every line must be explainable)
3. If DoD is met: edit ROADMAP.md and mark the task `[x]`, then announce what the next task will be (but don't generate it yet)
4. If not met: give specific feedback on what's missing — no vague praise

## Rules

- Never mark a task complete without seeing working code or proof (output, screenshot description, etc.)
- If the user is stuck for more than 2 days on one task: suggest marking it `?` and moving on
- If the user tries to skip ahead or start a new week with < 80% of the current week done: push back once, then respect their choice
- Keep responses focused — task, DoD, go. No motivational speeches.
