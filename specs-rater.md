# Specification — Automated Rater & Analysis Dashboard

**Version:** 1.1 (implemented build)
**Location in repo:** `/rater/` (subdirectory of the main Next.js project)
**Stack:** Python 3.11+ · FastAPI · SQLite (shared DB) · OpenAI API · Pandas · SciPy · Plotly
**Port:** 8000
**Audience:** Development team / maintainers

---

## 0. Overview

A self-contained Python web application that:

1. Reads participant responses directly from the shared SQLite database at `prisma/study.db`
2. Scores free-text answers automatically via the OpenAI API, comparing each response against the gold-standard answer key and rubric
3. Runs all statistical analyses required by the paper
4. Exposes a browser-based dashboard on port 8000 with KPI cards, charts, an editable raw-data table, and an academic narrative generator
5. Generates a ready-to-paste Results section for the paper via GPT-4o

The rater is launched independently of the main Next.js app. Both processes can run simultaneously — they share only the SQLite file (read/write from the main app, read + score-write from the rater).

---

## 1. Stack & Local Setup

| Concern | Choice |
|---|---|
| Language | Python 3.11+ |
| Web framework | FastAPI + Uvicorn |
| Database access | `sqlite3` stdlib (direct, no ORM — read-only except for writing scores back) |
| LLM scoring | `openai` Python SDK (`gpt-4o`, `temperature=0`) |
| Data analysis | `pandas`, `scipy`, `pingouin` |
| Charts | `plotly` (returns JSON consumed by frontend) |
| Frontend | Single-file HTML + Alpine.js + Plotly.js (served by FastAPI as static) |
| Port | **8000** |

### Launch script

Defined in the **root** `package.json`:

```json
"rater": "cd rater && fkill -f :8000 --silent; if [ ! -x .venv/bin/python ]; then echo 'Missing rater/.venv. Run: cd rater && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt' >&2; exit 1; fi; .venv/bin/python -m uvicorn main:app --reload --port 8000"
```

This means the rater is launched from the repo root with:

```bash
npm run rater
```

The script uses the venv-local Python directly (`rater/.venv/bin/python`), gives a clear error if the venv is missing, and kills any existing process on port 8000 silently before starting.

### Python environment

```bash
cd rater
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### `rater/requirements.txt`

```
fastapi
uvicorn[standard]
openai
pandas
scipy
pingouin
plotly
python-dotenv
```

### Environment variables

The rater reads from the **root** `.env.local` file (not a separate one), using `python-dotenv` with an explicit path:

```python
from dotenv import load_dotenv
load_dotenv("../.env.local")
```

This call is made at module load time in `main.py`, before any other imports that depend on env vars.

The root `.env.local` must contain:

```env
# Already present:
DATABASE_URL="file:./study.db"
PORT=3333

# Required for rater:
OPENAI_API_KEY="sk-..."
```

The rater will print a clear startup error to stderr if `OPENAI_API_KEY` is not set, but will still start the server.

### Database path

The rater resolves the DB path relative to its own location:

```python
DB_PATH = Path(__file__).parent.parent / "prisma" / "study.db"
```

If `study.db` does not exist at startup, the rater raises a clear startup error: `"study.db not found at {DB_PATH}. Run the main app first."`

---

## 2. Gold-Standard Answer Key & Scoring Rubric

Defined in `rater/gold_standard.json`, loaded at startup by `scorer.py`.

### Structure

```jsonc
{
  "<scenario_id>": {
    "scenario_description": "...",
    "scoring_type": "multi_step",
    "elements": [
      {
        "id": "<element_id>",
        "description": "...",
        "weight": 0.0–1.0,
        "keywords_hint": ["..."]
      }
    ],
    "fatal_errors": ["..."]
  }
}
```

Weights within each scenario sum to 1.0. Three scenarios are defined: `P1`, `P2`, `P3`.

---

## 3. LLM Scoring — Prompt Design

### Principle

- Model: `gpt-4o`
- Temperature: `0` (deterministic, replicable)
- Response format: JSON object (use `response_format={"type": "json_object"}`)
- One API call per task row (i.e. per participant × scenario combination)
- The prompt passes: the scenario ID, the participant's diagnosis text, the participant's corrective action text, the list of scoreable elements with weights, and the list of fatal errors

### System prompt

Loaded from `rater/prompts/system.txt` at startup. Never hardcoded in Python.

### User prompt (constructed per row)

```
Scenario ID: {scenario_id}

PARTICIPANT RESPONSE:
--- Diagnosis ---
{diagnosis_text}

--- Corrective Action ---
{corrective_action_text}

RUBRIC:
{json.dumps(elements, indent=2)}

FATAL ERRORS TO DETECT:
{json.dumps(fatal_errors, indent=2)}
```

### Score computation after API call

```python
weighted_score = sum(
    element["weight"] * element_scores[element["id"]]
    for element in elements
)
if fatal_error_detected:
    # fatal error zeroes the action sub-score only, preserving diagnosis sub-scores
    weighted_score = apply_fatal_penalty(scenario_id, weighted_score, element_scores)

final_accuracy = round(weighted_score, 4)
```

### Resilience

- On malformed JSON: retry once with explicit correction prompt; if still malformed, write `accuracy = null` and continue
- On API exception: write `accuracy = null`, `rater_notes = "API error: {msg}"`, continue
- Empty responses (both fields null/empty): score `accuracy = 0.0` without calling the API
- Token usage logged to console per `/api/score` call

---

## 4. Database Integration

### Read

The rater queries `study.db` directly via `sqlite3`. It reads all completed tasks joined with their session demographics and post-session rankings. Only tasks with a non-null `end_time` are included.

### Write

The rater adds an `accuracy` column to a **separate table** in the same `study.db`. It never modifies `Session`, `Task`, or `PostSession`.

```sql
CREATE TABLE IF NOT EXISTS TaskScore (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         INTEGER UNIQUE,
  accuracy        REAL,
  element_scores  TEXT,     -- JSON blob
  fatal_error     INTEGER,  -- 0 or 1
  rater_notes     TEXT,
  scored_at       TEXT,     -- ISO timestamp
  model_used      TEXT      -- e.g. "gpt-4o"
);
```

`TaskScore` is created automatically on first run. Existing rows are never overwritten unless `?force=true` is passed.

---

## 5. API Endpoints (FastAPI)

### `POST /api/score`

Triggers scoring for all unscored tasks.

- Reads all tasks without a `TaskScore` entry
- Calls OpenAI for each (skips empty responses: `accuracy = 0.0`)
- Writes results to `TaskScore`
- Returns:

```json
{
  "scored": 12,
  "skipped_already_scored": 4,
  "skipped_empty": 2,
  "errors": [],
  "token_usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
}
```

Query param `?force=true` deletes all existing scores and rescores everything.

### `GET /api/data`

Returns the full merged dataset as JSON (sessions + tasks + scores + post-session). Single source of truth for the dashboard frontend — all charts are rendered from this response. NumPy types and NaN/Inf values are serialised cleanly via `_clean_json_value()`.

### `GET /api/stats`

Returns the pre-computed statistical results as a JSON object:

```json
{
  "accuracy":    { "friedman": {...}, "posthoc": [...], "descriptive": {...} },
  "time":        { "shapiro": {...}, "rm_anova": {...}, "friedman": {...}, "posthoc": [...], "descriptive": {...} },
  "trust":       { "friedman": {...}, "posthoc": [...], "descriptive": {...} },
  "calibration": { "friedman": {...}, "one_sample_wilcoxon": {...}, "descriptive": {...} },
  "preference":  { "friedman": {...}, "first_choice_counts": {...}, "borda_means": {...} },
  "correlation_confidence_accuracy": { "KG": {...}, "LLM": {...}, "DOC": {...} },
  "cronbach_alpha": { "KG": 0.0, "LLM": 0.0, "DOC": 0.0 }
}
```

Tests that require a minimum of 3 complete within-subjects cases return `null` gracefully when data is insufficient (partial data during experiment).

### `PATCH /api/score/{task_id}`

Manual override: sets `accuracy` for a specific task from the dashboard table without re-calling the API. Body:

```json
{ "accuracy": 0.75, "rater_notes": "Manually corrected by researcher" }
```

After patching, the dashboard re-fetches `/api/stats` and re-renders all charts without a full page reload.

### `POST /api/narrative`

Generates a ready-to-paste academic Results section from the current stats.

- Reuses `stats_module.compute_stats()` (same logic as `GET /api/stats`, no duplication)
- Calls GPT-4o with `temperature=0.3`
- System prompt loaded from `rater/prompts/narrative_system.txt`
- User message: `"The following JSON contains the complete statistical results. Write the Results section based on this data.\n\n{json.dumps(stats_result)}`
- Returns: `{ "narrative": "<text>" }`
- Returns HTTP 422 if no scored data is available
- Returns HTTP 503 if `OPENAI_API_KEY` is not set
- Returns HTTP 502 on OpenAI API error

### `GET /`

Serves `rater/static/dashboard.html` (single-file dashboard).

### `GET /api/health`

Returns:

```json
{ "db": "ok|missing", "openai_api_key": "set|missing", "status": "ok|degraded" }
```

---

## 6. Statistical Analysis — Required Tests

All tests run server-side in Python on `GET /api/stats`. Results are recomputed on each call (fast enough for N ≤ 30). Minimum 3 complete within-subjects cases required for any inferential test; returns `null` otherwise.

### 6.1 Diagnostic Accuracy (RQ1)

- Primary test: **Friedman test** across KG / LLM / DOC (within-subjects, 3 conditions)
- Post-hoc: **Wilcoxon signed-rank** (3 pairwise comparisons: KG–LLM, KG–DOC, LLM–DOC), Bonferroni correction (α_adj = 0.0167)
- Effect size: **Kendall's W** for Friedman; **matched-pairs rank-biserial r** for Wilcoxon

### 6.2 Resolution Time (RQ2)

- Normality: **Shapiro–Wilk** per condition
- Primary test: **one-way repeated-measures ANOVA** (`pingouin.rm_anova`) with Greenhouse–Geisser correction if sphericity violated, or **Friedman** if normality fails
- Post-hoc: **paired t-tests** (Bonferroni) if normal, **Wilcoxon** otherwise
- Effect size: **partial η²** (ANOVA), **rank-biserial r** (Wilcoxon fallback)

### 6.3 Perceived Trust (RQ3)

- Compute `trust_score = mean(trust_t1, trust_t2, trust_t3)` per task
- Internal consistency: **Cronbach's α** per tool condition (threshold ≥ 0.70) via `pingouin.cronbach_alpha`
- Same ANOVA / Friedman pipeline as §6.2

### 6.4 Trust Calibration Index (RQ4)

- Compute per task: `calibration_index = (trust_score / 7) - accuracy`
- Positive = over-trust, negative = under-trust
- **Friedman test** across conditions
- **One-sample Wilcoxon** per condition vs. 0

### 6.5 Preference Ranking (RQ5)

- **Friedman test** on Borda points (1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt)
- Descriptive: frequency table of first-choice selections per tool; Borda mean per tool

### 6.6 Correlation: Confidence vs. Accuracy (RQ6)

- **Spearman correlation** between `confidence_score` and `accuracy` per tool condition

---

## 7. Dashboard — Frontend Specification

Single HTML file served at `/`. Uses **Plotly.js** (CDN) and **Alpine.js** (CDN). No build step. On load, fetches `/api/data` and `/api/stats` and renders everything client-side.

### Visual style

- Background: `#09090f` (near-black)
- Surface: `#111118` / `#1a1a26`
- Typography: Inter (UI) + JetBrains Mono (data/numbers)
- Color scheme: blue = KG (`#60a5fa`), green = LLM (`#4ade80`), amber = DOC (`#fbbf24`)
- All Plotly charts use matching dark backgrounds and borders
- Fixed-shell layout: header is sticky, only `<main>` scrolls (identical pattern to the main Next.js app)

### Layout

```
┌─────────────────────────────────────────────────┐
│  Header: title + Score / Force rescore / Refresh │  ← sticky, no scroll
├─────────────────────────────────────────────────┤
│  KPI Cards row                                   │
├──────────────┬──────────────┬────────────────────┤
│  Accuracy    │  Time        │  Trust             │  ← chart row 1
├──────────────┼──────────────┼────────────────────┤
│  Calibration │  Scenario×Tool│  Confidence scatter│  ← chart row 2
├──────────────┴──────────────┴────────────────────┤
│  Preference ranking  │  Timeout rate             │  ← chart row 3
├─────────────────────────────────────────────────┤
│  Stats panel (collapsible)                       │
├─────────────────────────────────────────────────┤
│  Raw data table (editable accuracy column)       │
├─────────────────────────────────────────────────┤
│  Academic Results Narrative                      │  ← narrative panel
└─────────────────────────────────────────────────┘
```

### 7.1 KPI Cards (top row)

| Card | Value |
|---|---|
| Total sessions | count of unique session_ids |
| Total scored tasks | count of tasks with accuracy ≠ null |
| Mean accuracy — KG | mean accuracy where tool = KG (formatted 0.000) |
| Mean accuracy — LLM | same, LLM |
| Mean accuracy — DOC | same, DOC |
| Timeout rate | % of tasks where timed_out = true |

### 7.2 Charts

All 8 charts are Plotly figures with dark theme, labelled axes, and titles.

| # | Title | Type | Axes |
|---|---|---|---|
| 1 | Diagnostic Accuracy per Tool | Box + points | X: tool, Y: accuracy 0–1 |
| 2 | Resolution Time per Tool | Box + points + T.O. markers (×) | X: tool, Y: seconds; dotted ref at 300 s |
| 3 | Perceived Trust per Tool | Box + points | X: tool, Y: Likert 1–7 |
| 4 | Trust Calibration Index per Tool | Box + points | X: tool, Y: index; dashed ref at 0 |
| 5 | Accuracy by Scenario × Tool | Grouped bar | X: P1/P2/P3, Y: mean accuracy |
| 6 | Confidence vs. Accuracy | Scatter (color = tool) | X: confidence 1–7, Y: accuracy 0–1; Spearman r in name |
| 7 | Tool Preference Ranking | Stacked bar (normalised %) | X: tool, Y: share %; stacks = 1st/2nd/3rd |
| 8 | Timeout Rate per Tool | Bar | X: tool, Y: % |

### 7.3 Statistical Results Panel (collapsible)

Shows formatted tables for: Friedman test results, post-hoc pairwise comparisons, Cronbach's α, Spearman r, one-sample Wilcoxon for calibration. Values highlighted in red when p < threshold.

### 7.4 Raw Data Table (editable accuracy)

One row per task. The `accuracy` column is inline-editable. On blur, sends `PATCH /api/score/{task_id}` and re-renders all charts and stats without a full reload. Text columns truncated to 80 chars with hover tooltip.

### 7.5 Academic Results Narrative Panel

Located below the raw data table.

- Single **"Generate narrative"** button, disabled until `statsData` is loaded and non-empty
- Clicking calls `POST /api/narrative`
- Button shows a spinner and is disabled during generation to prevent double calls
- On success: renders the returned text in a read-only `<textarea>` that auto-resizes to content height (no internal scrollbar)
- **"Copy to clipboard"** button appears next to the textarea once text is present
- On error: displays a red inline error message below the button

---

## 8. Narrative Generation — Prompt Design

### System prompt

Loaded from `rater/prompts/narrative_system.txt`. Content:

- Instructs the model to act as an academic writing assistant for the Results section
- Enforces passive voice, third person, no em-dashes
- Requires exact numerical reporting (no rounding or paraphrasing)
- Specifies subsection order: Diagnostic Accuracy → Resolution Time → Perceived Trust → Trust Calibration → Tool Preference
- Within each subsection: overall test → post-hoc comparisons → one-sentence direction
- Cronbach's α reported before trust results
- Non-significant results flagged with exact p-value
- Style: human factors / information systems journal
- Output: body text only, no title/abstract/intro

### Model parameters

- Model: `gpt-4o`
- Temperature: `0.3` (slightly above zero for fluent prose, consistent results)

### User message

```
The following JSON contains the complete statistical results. Write the Results section based on this data.

{json.dumps(stats_result, indent=2)}
```

---

## 9. Project Structure

```text
/rater/
├── main.py                  FastAPI app entrypoint + all API endpoints
├── db.py                    SQLite connection + query helpers
├── scorer.py                OpenAI scoring logic
├── stats.py                 All statistical tests
├── gold_standard.json       Answer key + rubric
├── prompts/
│   ├── system.txt           Fixed LLM system prompt for scoring
│   └── narrative_system.txt System prompt for academic narrative generation
├── static/
│   └── dashboard.html       Single-file dashboard (HTML + Alpine + Plotly)
├── requirements.txt
└── .venv/                   Python virtual environment (not committed)
```

The rater does **not** use a `prisma/` folder or any ORM — it accesses `../prisma/study.db` directly via `sqlite3`.

---

## 10. Resilience & Safety

| Concern | Implementation |
|---|---|
| OpenAI API failure on a row | Catch exception, write `accuracy = null`, `rater_notes = "API error: {msg}"`, continue |
| Malformed JSON response from LLM | Retry once with correction prompt; if still malformed, write null and log |
| DB locked by main app write | `sqlite3` with `timeout=10` |
| Re-scoring safety | Existing scores never overwritten unless `?force=true` |
| Raw data protection | Rater never writes to `Session`, `Task`, or `PostSession` tables |
| NumPy/NaN serialisation | `_clean_json_value()` in `main.py` converts NumPy scalars and NaN/Inf to JSON-safe values |
| Partial data | All tests return `null` gracefully when N < 3 complete within-subjects cases |
| Cost control | Token usage logged to console per `/api/score` call |
| Missing venv | `npm run rater` gives a clear error message with setup instructions |

---

## 11. Launch Commands Summary

```bash
# Main data collection app (port 3333)
npm run dev

# Rater + dashboard (port 8000)
npm run rater
```

---

## 12. Deliverables Checklist

- [x] `npm run rater` kills port 8000 and starts uvicorn cleanly using the local venv
- [x] App fails with a clear error if `study.db` is not found
- [x] App fails with a clear error if `OPENAI_API_KEY` is not set
- [x] `gold_standard.json` is loaded and validated at startup
- [x] `TaskScore` table is created automatically on first run if absent
- [x] `POST /api/score` skips already-scored rows by default
- [x] `POST /api/score?force=true` rescores all rows
- [x] Empty responses score `accuracy = 0.0` without API call
- [x] LLM prompt is loaded from `prompts/system.txt`, not hardcoded
- [x] Temperature is `0` for scoring, `0.3` for narrative generation
- [x] All 8 charts render with dark scientific style, labelled axes, titles
- [x] Dashboard uses fixed-shell layout (sticky header, scrollable main area only)
- [x] Accuracy inline edit in table triggers chart and stats refresh without full reload
- [x] Statistical results panel shows Friedman + post-hoc + Cronbach + Spearman + Wilcoxon
- [x] Rater never modifies `Session`, `Task`, or `PostSession` tables
- [x] Token usage logged to console per scoring run
- [x] Dashboard works with N < 24 (partial data during experiment)
- [x] `POST /api/narrative` generates academic Results section via GPT-4o
- [x] Narrative system prompt loaded from `prompts/narrative_system.txt`
- [x] Narrative panel button disabled until stats are loaded
- [x] Narrative textarea auto-resizes to content, no internal scroll
- [x] Copy to clipboard button appears after successful generation
