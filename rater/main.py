"""
main.py — FastAPI entrypoint for the P1P Study Rater & Analysis Dashboard.

Launch with:
    cd rater && uvicorn main:app --reload --port 8000
Or from repo root:
    npm run rater
"""

import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Load root .env.local BEFORE importing scorer (which reads OPENAI_API_KEY)
load_dotenv(Path(__file__).parent.parent / ".env.local")

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db
import scorer
import stats as stats_module

# ---------------------------------------------------------------------------
# Startup validation
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    errors: list[str] = []

    # 1. Check DB
    try:
        db.ensure_task_score_table()
    except FileNotFoundError as exc:
        errors.append(str(exc))

    # 2. Check OpenAI key + load assets
    try:
        scorer.load_assets()
    except EnvironmentError as exc:
        errors.append(str(exc))
    except FileNotFoundError as exc:
        errors.append(str(exc))

    if errors:
        for e in errors:
            print(f"[rater] STARTUP ERROR: {e}", file=sys.stderr)
        # Still start the server so the user can see the error in the browser
    else:
        print("[rater] Startup OK — DB and OpenAI assets loaded.")

    yield


app = FastAPI(
    title="P1P Study — Rater & Analysis Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# Serve dashboard.html from /static/
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _clean_json_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _clean_json_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean_json_value(v) for v in value]
    if isinstance(value, tuple):
        return [_clean_json_value(v) for v in value]
    if hasattr(value, "item") and callable(value.item):
        try:
            return _clean_json_value(value.item())
        except Exception:
            pass
    try:
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            return None
    except TypeError:
        return value
    return value


# ---------------------------------------------------------------------------
# Dashboard entrypoint
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    html_path = STATIC_DIR / "dashboard.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="dashboard.html not found")
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# POST /api/score
# ---------------------------------------------------------------------------

@app.post("/api/score")
async def score_endpoint(force: bool = Query(default=False)):
    """
    Score all unscored tasks (or all tasks if force=true).
    """
    try:
        db.ensure_task_score_table()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if force:
        db.delete_all_scores()
        tasks = db.fetch_all_tasks_for_scoring()
    else:
        tasks = db.fetch_unscored_tasks()

    already_scored = 0
    if not force:
        all_tasks = db.fetch_all_tasks_for_scoring()
        already_scored = len(all_tasks) - len(tasks)

    if not tasks:
        return {"scored": 0, "skipped_already_scored": already_scored, "skipped_empty": 0, "errors": []}

    result = scorer.score_batch(tasks)
    result["skipped_already_scored"] = already_scored
    result["token_usage"] = scorer.get_token_usage()
    return result


# ---------------------------------------------------------------------------
# GET /api/data
# ---------------------------------------------------------------------------

@app.get("/api/data")
async def data_endpoint():
    """
    Full merged dataset: sessions + tasks + scores.
    Single source of truth for the dashboard frontend.
    """
    try:
        rows = db.fetch_merged_data()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # Serialise booleans and NaN/None cleanly
    return _clean_json_value(rows)


# ---------------------------------------------------------------------------
# GET /api/stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
async def stats_endpoint():
    """
    Pre-computed statistical results for all research questions.
    """
    try:
        rows = db.fetch_merged_data()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not rows:
        return {"error": "No scored data available yet. Run /api/score first."}

    result = stats_module.compute_stats(rows)
    return _clean_json_value(result)


# ---------------------------------------------------------------------------
# PATCH /api/score/{task_id}  — manual accuracy override
# ---------------------------------------------------------------------------

class ScorePatch(BaseModel):
    accuracy: float
    rater_notes: str = "Manually corrected by researcher"


@app.patch("/api/score/{task_id}")
async def patch_score(task_id: int, body: ScorePatch):
    if not (0.0 <= body.accuracy <= 1.0):
        raise HTTPException(status_code=422, detail="accuracy must be between 0.0 and 1.0")

    now_iso = datetime.now(timezone.utc).isoformat()
    updated = db.patch_task_score(
        task_id=task_id,
        accuracy=body.accuracy,
        rater_notes=body.rater_notes,
        scored_at=now_iso,
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"No TaskScore row found for task_id={task_id}")

    return {"ok": True, "task_id": task_id, "accuracy": body.accuracy}


# ---------------------------------------------------------------------------
# POST /api/narrative — generate academic Results section via GPT-4o
# ---------------------------------------------------------------------------

NARRATIVE_SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "narrative_system.txt"
_narrative_system_prompt: str | None = None
NARRATIVE_REQUIRED_SNIPPETS = [
    r"\section{Results}",
    r"\subsection{Participants}",
    r"\subsection{Diagnostic Accuracy (RQ1)}",
    r"\subsection{Resolution Time (RQ2)}",
    r"\subsection{Perceived Trust and Calibration (RQ3)}",
    r"\subsection{Cognitive Load and Subjective Preference}",
    r"\begin{table}[t]",
    r"\label{tab:results_summary}",
    r"Accuracy (0--1)",
    r"Time (s)",
    r"Trust (1--7)",
    r"Calibration index",
    r"\end{table}",
]
NARRATIVE_LATEX_TEMPLATE = r"""
\section{Results}
\label{sec:results}

\subsection{Participants}
\label{subsec:results_participants}

\subsection{Diagnostic Accuracy (RQ1)}
\label{subsec:results_accuracy}

\subsection{Resolution Time (RQ2)}
\label{subsec:results_time}

\subsection{Perceived Trust and Calibration (RQ3)}
\label{subsec:results_trust}

\subsection{Cognitive Load and Subjective Preference}
\label{subsec:results_load_pref}

\begin{table}[t]
    \centering
    \caption{Summary statistics across conditions
    (mean $\pm$ SD). $^*p < .05$, $^{**}p < .01$,
    $^{***}p < .001$.}
    \label{tab:results_summary}
    \renewcommand{\arraystretch}{1.15}
    \begin{tabular}{@{}lcccc@{}}
        \toprule
        \textbf{Measure} & \textbf{KG} & \textbf{LLM} &
        \textbf{DOC} & \textbf{$p$} \\
        \midrule
        Accuracy (0--1)   & & & & \\
        Time (s)          & & & & \\
        Trust (1--7)      & & & & \\
        Calibration index & & & & \\
        \bottomrule
    \end{tabular}
\end{table}
""".strip()


def _get_narrative_system_prompt() -> str:
    global _narrative_system_prompt
    if _narrative_system_prompt is None:
        if not NARRATIVE_SYSTEM_PROMPT_PATH.exists():
            raise FileNotFoundError(f"narrative_system.txt not found at {NARRATIVE_SYSTEM_PROMPT_PATH}")
        _narrative_system_prompt = NARRATIVE_SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    return _narrative_system_prompt


def _collect_decimal_strings(value: Any) -> set[str]:
    decimals: set[str] = set()
    if isinstance(value, dict):
        for inner in value.values():
            decimals.update(_collect_decimal_strings(inner))
    elif isinstance(value, list):
        for inner in value:
            decimals.update(_collect_decimal_strings(inner))
    elif isinstance(value, float):
        decimals.add(str(value))
    return decimals


def _validate_narrative(narrative: str, stats_result: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    stripped = narrative.strip()

    for snippet in NARRATIVE_REQUIRED_SNIPPETS:
        if snippet not in stripped:
            issues.append(f"Missing required LaTeX structure snippet: {snippet}.")

    if "TODO" in stripped:
        issues.append("Narrative still contains TODO placeholders.")

    allowed_decimals = _collect_decimal_strings(stats_result)
    narrative_decimals = set(re.findall(r"(?<![\w])\d+\.\d+(?![\w])", stripped))
    unexpected_decimals = sorted(value for value in narrative_decimals if value not in allowed_decimals)
    if unexpected_decimals:
        issues.append(
            "Narrative includes decimal values not present in the current stats JSON: "
            + ", ".join(unexpected_decimals[:12])
            + ("..." if len(unexpected_decimals) > 12 else "")
        )

    return issues


@app.post("/api/narrative")
async def narrative_endpoint():
    try:
        rows = db.fetch_merged_data()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not rows:
        raise HTTPException(status_code=422, detail="No scored data available. Run /api/score first.")

    stats_result = _clean_json_value(stats_module.compute_stats(rows))
    sessions_n = int(len({row["session_id"] for row in rows}))
    qualitative_preference_rows = []
    seen_sessions: set[int] = set()
    for row in rows:
        session_id = int(row["session_id"])
        if session_id in seen_sessions:
            continue
        seen_sessions.add(session_id)
        qualitative_preference_rows.append({
            "session_id": session_id,
            "rank_justification": row.get("rank_justification"),
            "open_comment": row.get("open_comment"),
        })

    import json as _json
    from openai import OpenAI as _OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not set.")

    system_prompt = _get_narrative_system_prompt()
    user_message = (
        "Fill the following LaTeX Results template with current results. Preserve the exact section, subsection, "
        "label, and table structure, and replace the empty content and table cells with grounded text and values.\n\n"
        "Do not output TODO comments. Do not add extra sections. Do not remove any required structural lines.\n\n"
        f"The current dataset contains only N = {sessions_n} sessions. Flag preliminary results where appropriate.\n\n"
        "Use only the exact statistics present in the JSON below. Do not invent missing tests, coefficients, "
        "p-values, demographic variables, NASA-TLX scores, or Arburg-specific analyses. "
        "If a value is null or absent, state in LaTeX prose that it could not be computed or was not collected.\n\n"
        "LaTeX template to fill:\n"
        + NARRATIVE_LATEX_TEMPLATE
        + "\n\nCurrent statistical results JSON:\n"
        + _json.dumps(stats_result, indent=2)
        + "\n\nCurrent open-ended preference comments JSON:\n"
        + _json.dumps(qualitative_preference_rows, indent=2)
    )

    client = _OpenAI(api_key=api_key)
    corrections: list[str] = []
    narrative = ""
    last_issues: list[str] = []

    for _ in range(3):
        correction_block = ""
        if corrections:
            correction_block = "\n\nMANDATORY REVISION INSTRUCTIONS:\n- " + "\n- ".join(corrections)
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                temperature=0.2,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message + correction_block},
                ],
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"OpenAI API error: {exc}")

        narrative = response.choices[0].message.content or ""
        last_issues = _validate_narrative(narrative, stats_result)
        if not last_issues:
            break
        corrections = [f"Revise the narrative to fix this issue: {issue}" for issue in last_issues]

    if last_issues:
        raise HTTPException(
            status_code=502,
            detail="Narrative generation did not pass grounding validation: " + " ".join(last_issues),
        )

    return {"narrative": narrative}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    db_ok = db.DB_PATH.exists()
    api_key_ok = bool(os.environ.get("OPENAI_API_KEY"))
    return {
        "db": "ok" if db_ok else "missing",
        "openai_api_key": "set" if api_key_ok else "missing",
        "status": "ok" if (db_ok and api_key_ok) else "degraded",
    }
