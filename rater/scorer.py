"""
scorer.py — OpenAI-based automated scoring of participant task responses.
Model: gpt-4o, temperature=0, response_format JSON.
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openai import OpenAI

import db

SYSTEM_PROMPT_PATH = Path(__file__).parent / "prompts" / "system.txt"
GOLD_STANDARD_PATH = Path(__file__).parent / "gold_standard.json"

MODEL = "gpt-4o"
TEMPERATURE = 0

_system_prompt: str | None = None
_gold_standard: dict[str, Any] | None = None
_client: OpenAI | None = None

_total_prompt_tokens: int = 0
_total_completion_tokens: int = 0


def load_assets() -> None:
    global _system_prompt, _gold_standard, _client

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set. Add it to your root .env.local file.")

    _client = OpenAI(api_key=api_key)

    if not SYSTEM_PROMPT_PATH.exists():
        raise FileNotFoundError(f"System prompt not found at {SYSTEM_PROMPT_PATH}")
    _system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()

    if not GOLD_STANDARD_PATH.exists():
        raise FileNotFoundError(f"gold_standard.json not found at {GOLD_STANDARD_PATH}")
    with open(GOLD_STANDARD_PATH, encoding="utf-8") as f:
        _gold_standard = json.load(f)


def _get_gold(scenario_id: str) -> dict[str, Any]:
    if _gold_standard is None:
        raise RuntimeError("Gold standard not loaded. Call load_assets() first.")
    gs = _gold_standard.get(scenario_id)
    if gs is None:
        raise ValueError(f"No gold standard entry for scenario_id '{scenario_id}'")
    return gs


def _apply_fatal_penalty(scenario_id: str, weighted_score: float, element_scores: dict[str, int]) -> float:
    """
    Fatal error zeroes out action sub-scores only, preserving diagnosis sub-scores.
    """
    gs = _get_gold(scenario_id)
    elements = gs["elements"]
    diagnosis_score = sum(
        e["weight"] * element_scores.get(e["id"], 0)
        for e in elements
        if "_diag" in e["id"]
    )
    return round(diagnosis_score, 4)


def _build_user_prompt(task: dict[str, Any], gs: dict[str, Any]) -> str:
    elements = gs["elements"]
    fatal_errors = gs.get("fatal_errors", [])
    return (
        f"Scenario ID: {task['scenario_id']}\n\n"
        f"PARTICIPANT RESPONSE:\n"
        f"--- Diagnosis ---\n{task.get('diagnosis_text') or '(empty)'}\n\n"
        f"--- Corrective Action ---\n{task.get('corrective_action_text') or '(empty)'}\n\n"
        f"RUBRIC:\n{json.dumps(elements, indent=2)}\n\n"
        f"FATAL ERRORS TO DETECT:\n{json.dumps(fatal_errors, indent=2)}"
    )


def _call_api(user_prompt: str) -> dict[str, Any]:
    global _total_prompt_tokens, _total_completion_tokens
    if _client is None or _system_prompt is None:
        raise RuntimeError("Scorer not initialised. Call load_assets() first.")

    response = _client.chat.completions.create(
        model=MODEL,
        temperature=TEMPERATURE,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    usage = response.usage
    if usage:
        _total_prompt_tokens += usage.prompt_tokens
        _total_completion_tokens += usage.completion_tokens

    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def _call_api_with_retry(user_prompt: str) -> dict[str, Any] | None:
    """Try once, then retry with explicit correction prompt if JSON is malformed."""
    try:
        return _call_api(user_prompt)
    except (json.JSONDecodeError, KeyError):
        correction = user_prompt + "\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object, no other text."
        try:
            return _call_api(correction)
        except (json.JSONDecodeError, KeyError):
            return None


def score_task(task: dict[str, Any]) -> dict[str, Any]:
    """
    Score a single task row. Returns a dict ready for db.upsert_task_score().
    Handles empty responses and API errors without raising.
    """
    scenario_id = task["scenario_id"]
    diagnosis = (task.get("diagnosis_text") or "").strip()
    action = (task.get("corrective_action_text") or "").strip()
    timed_out = bool(task.get("timed_out"))
    now_iso = datetime.now(timezone.utc).isoformat()

    # Empty response shortcut — no API call
    if not diagnosis and not action:
        return {
            "task_id": task["task_id"],
            "accuracy": 0.0,
            "element_scores": "{}",
            "fatal_error": False,
            "rater_notes": "Empty response — scored 0.0 without API call." + (" (timed out)" if timed_out else ""),
            "scored_at": now_iso,
            "model_used": "none",
        }

    gs = _get_gold(scenario_id)
    user_prompt = _build_user_prompt(task, gs)

    try:
        result = _call_api_with_retry(user_prompt)
    except Exception as exc:
        return {
            "task_id": task["task_id"],
            "accuracy": None,
            "element_scores": "{}",
            "fatal_error": False,
            "rater_notes": f"API error: {exc}",
            "scored_at": now_iso,
            "model_used": MODEL,
        }

    if result is None:
        return {
            "task_id": task["task_id"],
            "accuracy": None,
            "element_scores": "{}",
            "fatal_error": False,
            "rater_notes": "Malformed JSON from LLM after retry — score set to null.",
            "scored_at": now_iso,
            "model_used": MODEL,
        }

    element_scores: dict[str, int] = result.get("element_scores", {})
    fatal_error_detected: bool = bool(result.get("fatal_error_detected", False))
    fatal_error_description: str = result.get("fatal_error_description", "")
    rater_notes: str = result.get("rater_notes", "")

    elements = gs["elements"]
    weighted_score = sum(
        e["weight"] * element_scores.get(e["id"], 0)
        for e in elements
    )

    if fatal_error_detected:
        weighted_score = _apply_fatal_penalty(scenario_id, weighted_score, element_scores)

    final_accuracy = round(weighted_score, 4)

    notes_parts = []
    if rater_notes:
        notes_parts.append(rater_notes)
    if fatal_error_detected and fatal_error_description:
        notes_parts.append(f"Fatal error: {fatal_error_description}")

    return {
        "task_id": task["task_id"],
        "accuracy": final_accuracy,
        "element_scores": json.dumps(element_scores),
        "fatal_error": fatal_error_detected,
        "rater_notes": " | ".join(notes_parts),
        "scored_at": now_iso,
        "model_used": MODEL,
    }


def score_batch(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Score a list of tasks, writing each result to DB immediately.
    Returns a summary dict.
    """
    global _total_prompt_tokens, _total_completion_tokens
    _total_prompt_tokens = 0
    _total_completion_tokens = 0

    scored = 0
    skipped_empty = 0
    errors: list[str] = []

    for task in tasks:
        result = score_task(task)
        db.upsert_task_score(
            task_id=result["task_id"],
            accuracy=result["accuracy"],
            element_scores=result["element_scores"],
            fatal_error=bool(result["fatal_error"]),
            rater_notes=result["rater_notes"],
            scored_at=result["scored_at"],
            model_used=result["model_used"],
        )

        if result["model_used"] == "none":
            skipped_empty += 1
        elif result["accuracy"] is None:
            errors.append(f"task_id={result['task_id']}: {result['rater_notes']}")
        else:
            scored += 1

    total_tokens = _total_prompt_tokens + _total_completion_tokens
    print(
        f"[scorer] Done. prompt_tokens={_total_prompt_tokens} "
        f"completion_tokens={_total_completion_tokens} "
        f"total={total_tokens} "
        f"(approx ${total_tokens / 1_000_000 * 5:.4f} at $5/Mtok)"
    )

    return {
        "scored": scored,
        "skipped_empty": skipped_empty,
        "errors": errors,
    }


def get_token_usage() -> dict[str, int]:
    return {
        "prompt_tokens": _total_prompt_tokens,
        "completion_tokens": _total_completion_tokens,
        "total_tokens": _total_prompt_tokens + _total_completion_tokens,
    }
