# APMS Data Collection App

A lightweight wizard-style web application for digitising data collection in a within-subjects experiment comparing three troubleshooting support tools (**KG**, **LLM**, **DOC**) on a Bambu Lab P1P 3D printer.

The app guides one participant at a time through a fixed sequence of screens, enforces a hard 5-minute timer per task, persists all responses to a local SQLite database, and prevents backward navigation during the experiment.

**Stack:** Next.js 14 (App Router) · TypeScript · SQLite · Prisma ORM · Tailwind CSS

---

## Prerequisites

- Node.js 18+
- npm

---

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:FabioDani95/APMS-data-collection-app.git
cd APMS-data-collection-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the `.env` file

Create a `.env` file in the root of the project:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
```

> The `OPENAI_API_KEY` is required only for the optional synthetic data generation feature.

### 4. Set up the database

```bash
npx prisma generate
npx prisma db push
```

This creates the SQLite database at `prisma/study.db`.

### 5. Start the app

```bash
npm run dev
```

The app will be available at [http://localhost:3333](http://localhost:3333).

> The dev script automatically kills any existing process on port 3333 before starting.

---

## Usage

### Experimenter flow

1. Open [http://localhost:3333/admin](http://localhost:3333/admin)
2. Select the participant group (G1–G6) and interface language (English / Italian)
3. Click **Start session** — the app generates a participant ID automatically
4. Hand the keyboard/mouse to the participant

### Participant flow

```
/admin          → Experimenter setup
/               → Demographics
/instructions   → Tool orientation
/task/1         → Task 1 (5 min timer)
/task/2         → Task 2 (5 min timer)
/task/3         → Task 3 (5 min timer)
/post-session   → Post-session questionnaire
/done           → Thank-you screen
```

Navigation is **strictly forward-only** — participants cannot go back.

### Admin results

Visit [http://localhost:3333/admin/results](http://localhost:3333/admin/results) to:

- Browse all collected sessions
- Edit session, task, or post-session data inline
- Delete an entire participant session
- Download the full dataset as CSV

CSV export is also available directly at `/api/export`.

---

## Optional: Synthetic Data Generation

On the demographics screen, the experimenter can open the **LLM generation modal** to generate a complete synthetic participant session (demographics, 3 tasks, post-session ranking) via OpenAI GPT-4o.

This feature requires a valid `OPENAI_API_KEY` in `.env`. The key is never exposed to the browser — generation is server-side only.

---

## Study Configuration

All study content (scenarios, tools, instructions, Likert labels) is defined in [config/study.json](config/study.json). No hardcoded content exists in the page components.

The Latin Square group-to-tool-order mapping (G1–G6) is also driven by this configuration.

---

## Project Structure

```
app/            → Next.js App Router pages and API routes
components/     → React components
config/         → study.json (all study content)
lib/            → Shared utilities and server logic
prisma/         → Prisma schema and SQLite database
middleware.ts   → Forward-only navigation guard
```

---

## Notes

- The app is designed for **local deployment on a single machine**.
- Only one active participant session is supported at a time.
- The tools used by participants (KG chatbot, ChatGPT, Bambu wiki) are accessed independently in a separate browser tab — this app only collects responses.
- A red **Abort session** button is visible during active sessions and deletes all data for that session.
