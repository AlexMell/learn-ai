Update the flashcard and quiz app at `tutorial/definitions/review-app/index.html` to include content from all definition files in `tutorial/definitions/`.

## Step 1 — Scan

Read all `.md` files in `tutorial/definitions/` (skip subdirectories). For each file identify:
- The topic slug (use the filename without extension, e.g. `embeddings`)
- All **Interview Q&A** blocks (Q: / A: pairs)
- The **Правила напам'ять** section (key numbers and rules)
- Any tables from the **Підводні камені** or core sections worth adding to Cheatsheet

## Step 2 — Diff against current app

Read `tutorial/definitions/review-app/index.html` and check the `CARDS` and `QUIZ` arrays plus `TOPIC_META`. Identify:
- Topics already present → skip their cards/questions (do not duplicate)
- New topics not yet in the app → need full addition

## Step 3 — Add new topics

For each **new** topic:

**In CSS** — add a badge color class `.badge-<slug>` following the existing pattern:
```css
.badge-<slug> { background: rgba(R,G,B,0.15); color: #RRGGBB; }
```
Pick a distinct color not already used by existing badges.

**In HTML** — add a filter button inside `.filter-group`:
```html
<button class="filter-btn" onclick="setFilter('<slug>', this)">Label</button>
```

**In JS `TOPIC_META`** — add entry:
```js
<slug>: { label: 'Display Name', cls: 'badge-<slug>' },
```

**In JS `CARDS` array** — add 4-6 flashcards from the Interview Q&A sections:
```js
{ topic: '<slug>', q: '...', a: '...' },
```

**In JS `QUIZ` array** — add 3-4 multiple choice questions based on the Правила напам'ять and core concepts. Each question must have exactly 4 options and a `correct` index (0-3). Make wrong answers plausible but clearly incorrect.

**In HTML Cheatsheet** — add a new `<div class="cheat-section">` with:
- A `<h2>` with the topic badge
- Either a `cheat-grid` of cards (for key numbers) or a `cheat-table` (for rules/comparisons)
- Content sourced from Правила напам'ять and summary tables in the definition file

## Step 4 — Verify

After editing, confirm:
- No duplicate topic slugs in `TOPIC_META`
- No duplicate questions in `CARDS` or `QUIZ`
- Every new slug referenced in HTML filter buttons exists in `TOPIC_META`
- Badge CSS class exists for every new slug
- The file is valid HTML (no unclosed tags, no broken JS arrays — check for missing commas)
