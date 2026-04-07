"""
db.py — SQLite connection and query helpers for the rater.
Reads from ../prisma/study.db (shared with the Next.js app).
Writes only to the TaskScore table (never touches Session, Task, PostSession).
"""

import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent.parent / "prisma" / "study.db"

TASK_SCORE_DDL = """
CREATE TABLE IF NOT EXISTS TaskScore (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         INTEGER UNIQUE,
  accuracy        REAL,
  element_scores  TEXT,
  fatal_error     INTEGER,
  rater_notes     TEXT,
  scored_at       TEXT,
  model_used      TEXT
);
"""

QUERY_ALL_COMPLETED_TASKS = """
SELECT
  s.id            AS session_id,
  s.participant_id,
  s.group_id,
  s.first_name,
  s.age,
  s.gender,
  s.study_profile,
  s.exp_3d_printing,
  s.conf_troubleshooting,
  s.fam_manufacturing,
  t.id            AS task_id,
  t.task_order,
  t.scenario_id,
  t.tool_assigned,
  t.start_time,
  t.end_time,
  t.time_spent_seconds,
  t.diagnosis_text,
  t.corrective_action_text,
  t.confidence_score,
  t.trust_t1,
  t.trust_t2,
  t.trust_t3,
  t.timed_out,
  ps.rank_1,
  ps.rank_2,
  ps.rank_3,
  ps.rank_justification,
  ps.open_comment
FROM Task t
JOIN Session s ON t.session_id = s.id
LEFT JOIN PostSession ps ON ps.session_id = s.id
WHERE t.end_time IS NOT NULL
ORDER BY s.id, t.task_order
"""

QUERY_MERGED_WITH_SCORES = """
SELECT
  s.id            AS session_id,
  s.participant_id,
  s.group_id,
  s.first_name,
  s.age,
  s.gender,
  s.study_profile,
  s.exp_3d_printing,
  s.conf_troubleshooting,
  s.fam_manufacturing,
  t.id            AS task_id,
  t.task_order,
  t.scenario_id,
  t.tool_assigned,
  t.start_time,
  t.end_time,
  t.time_spent_seconds,
  t.diagnosis_text,
  t.corrective_action_text,
  t.confidence_score,
  t.trust_t1,
  t.trust_t2,
  t.trust_t3,
  t.timed_out,
  ps.rank_1,
  ps.rank_2,
  ps.rank_3,
  ps.rank_justification,
  ps.open_comment,
  ts.accuracy,
  ts.element_scores,
  ts.fatal_error,
  ts.rater_notes  AS score_notes,
  ts.scored_at,
  ts.model_used
FROM Task t
JOIN Session s ON t.session_id = s.id
LEFT JOIN PostSession ps ON ps.session_id = s.id
LEFT JOIN TaskScore ts ON ts.task_id = t.id
WHERE t.end_time IS NOT NULL
ORDER BY s.id, t.task_order
"""


def get_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"study.db not found at {DB_PATH}. Run the main app first."
        )
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_task_score_table() -> None:
    with get_connection() as conn:
        conn.execute(TASK_SCORE_DDL)
        conn.commit()


def fetch_completed_tasks() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(QUERY_ALL_COMPLETED_TASKS).fetchall()
    return [dict(r) for r in rows]


def fetch_unscored_tasks() -> list[dict[str, Any]]:
    """Return completed tasks that have no TaskScore entry yet."""
    sql = """
    SELECT t.id AS task_id, t.scenario_id, t.tool_assigned,
           t.diagnosis_text, t.corrective_action_text, t.timed_out
    FROM Task t
    WHERE t.end_time IS NOT NULL
      AND t.id NOT IN (SELECT task_id FROM TaskScore WHERE task_id IS NOT NULL)
    """
    with get_connection() as conn:
        rows = conn.execute(sql).fetchall()
    return [dict(r) for r in rows]


def fetch_all_tasks_for_scoring() -> list[dict[str, Any]]:
    """Return ALL completed tasks (used for force rescore)."""
    sql = """
    SELECT t.id AS task_id, t.scenario_id, t.tool_assigned,
           t.diagnosis_text, t.corrective_action_text, t.timed_out
    FROM Task t
    WHERE t.end_time IS NOT NULL
    """
    with get_connection() as conn:
        rows = conn.execute(sql).fetchall()
    return [dict(r) for r in rows]


def fetch_merged_data() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(QUERY_MERGED_WITH_SCORES).fetchall()
    return [dict(r) for r in rows]


def upsert_task_score(
    task_id: int,
    accuracy: float | None,
    element_scores: str,
    fatal_error: bool,
    rater_notes: str,
    scored_at: str,
    model_used: str,
) -> None:
    sql = """
    INSERT INTO TaskScore (task_id, accuracy, element_scores, fatal_error, rater_notes, scored_at, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      accuracy       = excluded.accuracy,
      element_scores = excluded.element_scores,
      fatal_error    = excluded.fatal_error,
      rater_notes    = excluded.rater_notes,
      scored_at      = excluded.scored_at,
      model_used     = excluded.model_used
    """
    with get_connection() as conn:
        conn.execute(
            sql,
            (task_id, accuracy, element_scores, int(fatal_error), rater_notes, scored_at, model_used),
        )
        conn.commit()


def patch_task_score(task_id: int, accuracy: float, rater_notes: str, scored_at: str) -> bool:
    """Manual override — updates only accuracy and notes for an existing row."""
    sql = """
    UPDATE TaskScore
    SET accuracy = ?, rater_notes = ?, scored_at = ?
    WHERE task_id = ?
    """
    with get_connection() as conn:
        cur = conn.execute(sql, (accuracy, rater_notes, scored_at, task_id))
        conn.commit()
        return cur.rowcount > 0


def delete_all_scores() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM TaskScore")
        conn.commit()
