# Field Specifications — P1P Troubleshooting Study · Data Collection App

**Version:** 1.3 (implemented build)  
**Stack:** Next.js 14 (App Router) · SQLite · Prisma ORM  
**Target:** Local deployment, single machine, single active session at a time  
**Audience:** Development team / maintainers

---

## 0. Project Overview

A lightweight wizard-style local application to digitise the data collection process for a within-subjects experiment comparing three troubleshooting support tools (KG, LLM, DOC) on a Bambu Lab P1P 3D printer.

The app guides one participant at a time through a fixed sequence of screens, enforces a hard 5-minute timer per task, persists all responses to a local SQLite database, and prevents backward navigation during the experiment.

The tools themselves (KG chatbot, ChatGPT, Bambu wiki) are used independently by the participant on the same or an adjacent browser tab. This application only collects participant data, timestamps, trust ratings, and post-session preferences.

### Implemented additions vs. the original brief

- Bilingual UI support is implemented for **English** and **Italian**, with **English as default**.
- The application behaves like a **fixed-shell app**, not a long web page: the viewport is fixed and only the inner content area scrolls.
- An admin results browser page is implemented at `/admin/results` to inspect, edit, delete, and export data directly from the browser.
- CSV export is available locally at `/api/export` **without password**.
- A global red **Abort session** button is visible during active sessions; it deletes the current session and returns to `/admin`.
- `participant_id` is **auto-generated server-side** and hidden from the admin form UI.
- An optional **LLM-based synthetic data generation** feature is available at the start of the participant flow to prefill a complete synthetic session (demographics, 3 tasks, and post-session ranking) from experimenter guidance.
- The terminal `/done` screen is implemented as a **celebration screen** with participant-name personalization, balloons/confetti, and a direct CTA to start a new data collection.

---

## 1. Stack & Local Setup

| Concern | Choice |
|---|---|
| Framework | Next.js 14, App Router |
| Language | TypeScript |
| Database | SQLite via Prisma |
| Styling | Tailwind CSS |
| Port | **3333** |
| Launch script | `npm run dev` — kills any existing process on port 3333 before starting |

### `package.json` dev script

```json
"dev": "fkill -f :3333 --silent; next dev -p 3333"
```

### `.env.local` (implemented)

```env
DATABASE_URL="file:./study.db"
PORT=3333
OPENAI_API_KEY="sk-..."
```

### LLM feature note

- The data-collection app now also reads `OPENAI_API_KEY` from the root `.env.local`.
- This key is used only by the optional synthetic-data generation route.
- The key is never exposed to the browser; generation happens server-side.

### Prisma notes

- The SQLite file lives at `prisma/study.db`.
- The Prisma SQLite URL is `file:./study.db` because the path is resolved relative to `prisma/schema.prisma`.
- Expected setup:

```bash
npm run prisma:generate
npm run prisma:push
```

---

## 2. Configuration File — `config/study.json`

All study content lives in `config/study.json`. Page code must not hardcode scenario content.

### Implemented structure

The original brief used a monolingual JSON example. The implemented app extends this to support localisation:

- `study_title` is localized (`en`, `it`)
- `tools[*].label` is localized
- `trust_questions[]` are localized
- scenario fields such as `subsystem`, `machine_state`, `process_parameters`, `observable_symptoms`, and `error_message` are localized
- instructions content is localized
- Likert endpoint labels are configurable in JSON

### Rule

All scenario text displayed to participants must come from `config/study.json`, never from hardcoded JSX strings.

---

## 3. Database Schema (`prisma/schema.prisma`)

### Implemented schema

```prisma
model Session {
  id                   Int          @id @default(autoincrement())
  participant_id       String       @unique
  group_id             String
  created_at           DateTime     @default(now())
  first_name           String?
  background           String?
  academic_level       String?
  exp_3d_printing      String?
  conf_troubleshooting Int?
  fam_manufacturing    Int?
  tasks                Task[]
  post_session         PostSession?
}

model Task {
  id                     Int       @id @default(autoincrement())
  session_id             Int
  session                Session   @relation(fields: [session_id], references: [id], onDelete: Cascade)
  task_order             Int
  scenario_id            String
  tool_assigned          String
  start_time             DateTime?
  end_time               DateTime?
  time_spent_seconds     Int?
  diagnosis_text         String?
  corrective_action_text String?
  confidence_score       Int?
  trust_t1               Int?
  trust_t2               Int?
  trust_t3               Int?
  timed_out              Boolean   @default(false)

  @@unique([session_id, task_order])
}

model PostSession {
  id                 Int      @id @default(autoincrement())
  session_id         Int      @unique
  session            Session  @relation(fields: [session_id], references: [id], onDelete: Cascade)
  rank_1             String
  rank_2             String
  rank_3             String
  rank_justification String?
  open_comment       String?
}
```

### Important implementation note

Demographic fields on `Session` are nullable in the schema because the session row is created on `/admin` before demographics are filled in. This is intentional and required by the implemented flow.

---

## 4. Routes, Navigation Policy & Session Control

### Route map

```text
/admin                          → Screen 0: Experimenter setup
/admin/results                  → Admin results browser
/                               → Screen 1: Demographics
/instructions                   → Screen 2: Tool orientation
/task/1                         → Screen 3: Task 1
/task/2                         → Screen 4: Task 2
/task/3                         → Screen 5: Task 3
/post-session                   → Screen 6: Post-session questionnaire
/done                           → Screen 7: Thank-you

/api/sessions                   → Create session
/api/sessions/[id]              → Update demographics
/api/sessions/[id]/generate     → Generate a full synthetic-data session via LLM
/api/sessions/current           → Abort current session
/api/tasks                      → Start task row
/api/tasks/[id]                 → Save/update task row
/api/post-session               → Save post-session questionnaire
/api/export                     → CSV export
/api/admin/results/[sessionId]  → Admin edit/delete operations
```

### Navigation policy

The participant flow is still **strictly forward-only**.

### Guards implemented

1. **Server-side middleware gate**
   `middleware.ts` reads the HTTP-only session cookie and redirects the participant to the correct current step if they try to jump ahead.

2. **Client-side back-button intercept**
   On participant-facing pages, `popstate` is intercepted and the app immediately pushes forward again. A persistent warning toast is shown.

3. **`beforeunload` warning**
   Task pages show the browser-native leave warning on refresh/close.

4. **No participant back navigation UI**
   No back buttons, breadcrumbs, or nav menu are shown in the participant flow.

5. **Terminal `/done` route**
   Reaching `/done` clears the session cookie; further navigation falls back to `/admin`.

### Additional implemented admin/session controls

- `/admin` and `/admin/results` are always reachable and bypass the participant flow guard.
- A fixed red **Abort session** button is visible while a session cookie exists.
- Abort deletes the entire current session (including tasks and post-session data) and returns to `/admin`.

---

## 5. Screen-by-Screen Specifications

### Screen 0 — `/admin`

Filled by the experimenter before handing the keyboard to the participant.

| Field | Type | Validation | DB column |
|---|---|---|---|
| Group | Select (G1–G6) | Required | `session.group_id` |
| Interface language | Select | `en` / `it` | stored in session cookie only |

### Participant ID behaviour

- `participant_id` is **not shown in the UI**
- it is generated **server-side**
- current format is `ID001`, `ID002`, ...
- generation considers already saved sessions and also accepts legacy values like `001`

**On submit:** create a `Session` row, set an HTTP-only session cookie, redirect to `/`.

---

### Screen 1 — `/` (Demographics)

| Field | Type | Notes | Validation | DB column |
|---|---|---|---|---|
| First name or alias | Text input | — | Required, max 80 chars | `session.first_name` |
| Academic / professional background | Text input | Free text | Required | `session.background` |
| Current level | Text input | Help text explains examples such as `MSc year 2`, `PhD candidate`, `researcher`, `engineer` | Required | `session.academic_level` |
| Prior experience with 3D printing | Radio | `none`, `basic`, `intermediate`, `advanced` | Required | `session.exp_3d_printing` |
| Self-assessed troubleshooting confidence | Likert 1–7 | Explicitly labeled `1 = low / 7 = high` | Required | `session.conf_troubleshooting` |
| Familiarity with manufacturing processes | Likert 1–7 | Explicitly labeled `1 = low / 7 = high` | Required | `session.fam_manufacturing` |

**On submit:** update the existing `Session` row and redirect to `/instructions`.

### Optional synthetic-data generation path

At the top of the demographics screen, the experimenter may open an LLM generation modal instead of filling the session manually.

The modal currently supports:

- participant full name or alias guidance
- background hint
- academic level hint
- explicit 3D-printing experience override
- explicit troubleshooting confidence override
- explicit manufacturing familiarity override
- preferred tool
- least preferred tool
- three 0–100 sliders controlling:
  - answer verbosity
  - decisiveness of conclusions
  - baseline trust in support tools
- free-text notes for additional behavioural guidance

### Synthetic data generation behaviour

- Generation is **optional**; the manual participant flow remains unchanged.
- The request is sent to `POST /api/sessions/[id]/generate`.
- The route uses the same root `OPENAI_API_KEY` and the same model currently used by the rater (`gpt-4o`).
- Generation is server-side only; the browser never receives the API key.
- The generator is asked to produce a complete, internally consistent synthetic dataset for one participant session:
  - `Session` demographics
  - all 3 `Task` rows
  - `PostSession` ranking and comments
- The synthetic-data generation is constrained by:
  - the selected `group_id`
  - the Latin-square task/tool order
  - localized scenario text from `config/study.json`
  - explicit experimenter hints from the modal
- If the provided name is incomplete, the server normalises it to a plausible full name by inventing a surname when needed.
- The server validates that all required fields are present and that task free-text responses are not near-duplicates across scenarios; invalid generations are retried with corrective instructions before being rejected.
- On success, the session is persisted as fully completed and the UI redirects directly to `/done`.

---

### Screen 2 — `/instructions`

Static read-only orientation page populated from `config/study.json`.

Content shown:

- general instructions
- general rules
- per-tool usage sections for KG / LLM / DOC

Single CTA button:

- `I have read the instructions — Start Task 1`

**On click:** create (or upsert) task 1 with `start_time`, then redirect to `/task/1`.

---

### Screen 3–5 — `/task/[n]`

Task pages are generated dynamically from:

`group_id → latin_square → task order`

### Layout

- desktop: two columns
- mobile: stacked layout with scenario content in an accordion

### Left panel

Read-only scenario vignette sourced from `config/study.json`.

### Right panel

- fixed timer block at top of the task panel
- response textareas
- confidence Likert
- trust block with 3 Likert items

### Timer behaviour

- starts from `task_duration_seconds` (300 s)
- displays `MM:SS`
- becomes red at <= 60 seconds
- on timeout:
  - fields become disabled
  - `timed_out = true`
  - draft is saved
  - blocking overlay appears
  - Continue button appears after 5 seconds

### Autosave/resume behaviour

- autosave every 30 seconds
- refresh resumes from DB `start_time`
- remaining time is calculated from DB/server time, not from client-only state

### Likert labels

All task Likert blocks explicitly show scale endpoints:

- English: `1 = Low`, `7 = High`
- Italian: `1 = Poco`, `7 = Tanto`

**On submit:**

1. `end_time` is written
2. `time_spent_seconds` is computed
3. task row is updated
4. `completed_steps` in the session cookie is advanced
5. next task is created/upserted when applicable

---

### Screen 6 — `/post-session`

Three dependent dropdowns for ranking `KG`, `LLM`, and `DOC`, plus:

- justification textarea
- open comment textarea

All three rankings must be distinct.

**On submit:** save/upsert `PostSession`, redirect to `/done`.

---

### Screen 7 — `/done`

Terminal celebration screen.

- personalized with the participant's saved name
- balloons/confetti animation is shown on the final page only
- includes a direct button to `/admin` to start a new data collection
- no participant back navigation
- cookie is cleared
- future navigation returns to `/admin`

---

## 6. Admin Results Browser

### Route

`/admin/results`

### Purpose

Provide an experimenter-facing browser view over the collected data without requiring direct SQLite access.

### Implemented features

- view saved results directly in browser
- one card/row per exported task row
- CSV download from browser
- inline editing of:
  - session-level fields
  - task-level fields
  - post-session fields
- delete an entire participant session from browser

### Deletion semantics

Deleting from the results page deletes the **entire session**, not a single task row. This preserves consistency between `Session`, `Task[]`, and `PostSession`.

---

## 7. API Routes

### `POST /api/sessions`

Creates a new session from:

```json
{ "group_id": "G1", "locale": "en" }
```

Response:

```json
{ "session_id": 12, "participant_id": "ID002" }
```

Side effect:

- sets the HTTP-only session cookie

### `PATCH /api/sessions/:id`

Updates demographics.

### `POST /api/sessions/:id/generate`

Generates a complete synthetic-data session for the current cookie-bound session.

Request payload includes experimenter guidance such as:

```json
{
  "participant_name": "Giulia",
  "background_hint": "Mechanical engineering student with some lab experience",
  "preferred_tool": "DOC",
  "answer_verbosity_percent": 65,
  "decisiveness_percent": 40,
  "tool_trust_percent": 55,
  "notes": "Careful but not very confident under time pressure"
}
```

Implemented behaviour:

- validates that the session in the URL matches the current session cookie
- calls OpenAI server-side using `OPENAI_API_KEY`
- generates:
  - demographics
  - 3 completed tasks using the correct tool/scenario order
  - post-session ranking/comments
- upserts all generated rows into SQLite in one transaction
- advances the session cookie to the completed state
- returns a `/done?...` redirect target so the celebration screen can still render even if the cookie is already being cleared

### `DELETE /api/sessions/current`

Aborts the **current cookie-bound session**:

- deletes the session and all cascade-related data
- clears the session cookie
- returns `{ ok: true, nextPath: "/admin" }`

### `POST /api/tasks`

Starts or upserts a task row.

### `PATCH /api/tasks/:id`

Handles:

- autosave
- timeout draft save
- timeout continue
- normal completion

### `POST /api/post-session`

Saves post-session data.

### `GET /api/export`

Returns the full CSV export of all sessions joined with tasks and post-session rows.

### `PATCH /api/admin/results/[sessionId]`

Admin browser edit endpoint for session/task/post-session data.

### `DELETE /api/admin/results/[sessionId]`

Admin browser delete endpoint; removes the whole session.

---

## 8. Resilience & Data Safety

| Concern | Implemented behaviour |
|---|---|
| Timer in client JS | Draft autosave every 30 seconds |
| Page refresh mid-task | Resume from DB `start_time` |
| Accidental back navigation | Middleware + `popstate` interception |
| Duplicate submissions | Buttons disabled while saving |
| Participant IDs | Auto-generated server-side |
| Legacy IDs in DB | Next ID generator accepts both `001` and `ID001` patterns |
| Incomplete sessions | Included in export with null columns where data is missing |
| CSV escaping | Implemented with `csv-stringify` |

### CSV escaping requirement

Free-text fields may contain commas, quotes, and line breaks. CSV serialisation must:

- quote fields
- escape internal quotes as `""`
- encode line breaks as `\n` in output

---

## 9. UI / UX Guidelines

- typography: clean sans-serif / Inter
- visual style: white, neutral, academic
- no dark mode
- no decorative animations during the data-collection flow
- a celebratory animation is intentionally allowed on the terminal `/done` screen only
- tool badges use blue / green / amber
- fixed-shell layout: the app viewport is fixed and **only the content area scrolls**
- task timer remains visible inside the task panel
- Likert scales are clickable 1–7 blocks with explicit low/high labels
- mobile layout stacks content; scenario panel collapses into accordion

---

## 10. Project Structure (implemented)

```text
/
├── app/
│   ├── admin/
│   │   ├── page.tsx
│   │   └── results/page.tsx
│   ├── api/
│   │   ├── admin/results/[sessionId]/route.ts
│   │   ├── export/route.ts
│   │   ├── post-session/route.ts
│   │   ├── sessions/route.ts
│   │   ├── sessions/[id]/route.ts
│   │   ├── sessions/[id]/generate/route.ts
│   │   ├── sessions/current/route.ts
│   │   ├── tasks/route.ts
│   │   └── tasks/[id]/route.ts
│   ├── done/page.tsx
│   ├── instructions/page.tsx
│   ├── post-session/page.tsx
│   ├── task/[n]/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AbortSessionButton.tsx
│   ├── AdminForm.tsx
│   ├── AdminResultsTable.tsx
│   ├── CelebrationScene.tsx
│   ├── Countdown.tsx
│   ├── DemographicsForm.tsx
│   ├── InstructionsStartButton.tsx
│   ├── LikertScale.tsx
│   ├── LLMParticipantGenerator.tsx
│   ├── NavigationGuard.tsx
│   ├── PostSessionForm.tsx
│   ├── ScenarioPanel.tsx
│   ├── TaskClient.tsx
│   └── ToolBadge.tsx
├── config/
│   └── study.json
├── lib/
│   ├── config.ts
│   ├── export.ts
│   ├── i18n.ts
│   ├── navigation.ts
│   ├── participant-id.ts
│   ├── prisma.ts
│   ├── session.ts
│   ├── synthetic-participant.ts
│   ├── types.ts
│   ├── utils.ts
│   └── validation.ts
├── prisma/
│   ├── schema.prisma
│   └── study.db
├── middleware.ts
├── .env.local
└── package.json
```

---

## 11. Out of Scope

- authentication / user login
- multi-concurrent participant sessions
- cloud deployment
- external KG / LLM / wiki integrations
- automated scoring
- email / notifications
- remote admin security hardening

---

## 12. Implemented Deviations from the Original 1.1 Brief

1. `participant_id` is no longer entered manually; it is auto-generated and hidden from the UI.
2. CSV export is no longer password-protected.
3. A browser-based admin results page has been added.
4. Admin users can now edit or delete saved records from the browser.
5. A global abort button has been added to terminate the current session and delete its data.
6. The app supports English and Italian instead of English-only content.
7. The shell uses fixed-height application scrolling instead of page-level browser scrolling.
8. Session demographic fields are nullable in Prisma to support the create-first / fill-later flow.

---

## 13. Verification Checklist

- [x] `npm run dev` kills port 3333 and restarts cleanly
- [x] `npm run prisma:push` creates/syncs `prisma/study.db`
- [x] Scenario content is served from `config/study.json`
- [x] Latin Square mapping G1–G6 is implemented
- [x] Timer enforces the 5-minute hard limit
- [x] Timer resumes after refresh from DB time
- [x] Autosave runs every 30 seconds
- [x] Middleware enforces forward-only participant navigation
- [x] Client-side back interception is active
- [x] `/done` clears the cookie and resets flow
- [x] CSV export uses proper serialisation
- [x] Incomplete sessions appear in CSV
- [x] Admin results page can inspect/export/edit/delete data
- [x] Global abort session action is implemented
- [x] UI supports English and Italian
- [x] Fixed-shell application scrolling is implemented
