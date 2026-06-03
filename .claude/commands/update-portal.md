Sync `index.html` with the current state of the repo, then commit and push to GitHub.

## Step 1 — Scan repo for content

Collect the full current inventory by listing files:

- `tutorial/01_basics/*.md` → lessons for BASICS section
- `tutorial/02_tools/*.md` → lessons for TOOLS section
- `tutorial/03_advanced/*.md` → lessons for ADVANCED section
- `tutorial/tasks/*.md` → lessons for TASKS section
- `tutorial/definitions/*.md` (skip the `review-app/` subdirectory) → definition pages
- Corresponding code files: `01_basics/*.ts`, `02_tools/*.ts`, `03_advanced/*.ts`, `tasks/*.ts`

Sort each group numerically by filename prefix.

## Step 2 — Diff against current NAV in index.html

Read `index.html` and extract the `NAV` array. For each scanned file, check if a matching entry already exists in NAV (match by the `tutorial` / `code` / `file` path). Identify:

- **Missing entries** — files on disk not present in NAV
- **Stale entries** — NAV items whose files no longer exist on disk (remove them)

If there is nothing to add or remove, print "Portal is already up to date." and stop.

## Step 3 — Update the NAV array in index.html

For each **missing** entry, insert it in the correct position inside the NAV array following the existing pattern:

**Lesson** (basics / tools / advanced / tasks):
```js
{ type:'lesson', id:'<section>-<NN>', label:'<NN> <Title>',
  tutorial:'tutorial/<dir>/<filename>.md',
  code:'<dir>/<filename>.ts' },
```

Derive the `id` from the section prefix and the two-digit number in the filename (e.g. `basics-06`).
Derive the `label` from the filename: strip the number prefix and extension, replace underscores with spaces, title-case it (e.g. `06_vision_api.md` → `06 Vision Api`).

**Definition**:
```js
{ type:'def', id:'def-<slug>', label:'<Human Label>',
  file:'tutorial/definitions/<filename>.md' },
```

Derive `slug` from the filename without extension (e.g. `embeddings`).
Derive the human label by title-casing the slug with spaces (e.g. `Rag Basics` → fix to `RAG Basics` where the original filename gives a hint).

Remove any stale entries whose files no longer exist.

## Step 4 — Verify

After editing, check:
- NAV array is valid JavaScript (no trailing commas before `]`, no missing commas between entries)
- Every new `id` is unique within NAV
- No duplicate entries

## Step 5 — Commit and push

```bash
git add index.html
git commit -m "Update portal nav: add <list of added items>"
git push
```

Print a short summary: how many items were added, removed, and the push result.
