"""
stats.py — All statistical analyses required by the paper.

Tests run on GET /api/stats (recomputed each call, cached in memory).
Handles N < 24 (partial data) gracefully — returns null for tests that
require minimum sample sizes.
"""

from __future__ import annotations

import warnings
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as sp_stats

try:
    import pingouin as pg
    _HAS_PINGOUIN = True
except ImportError:
    _HAS_PINGOUIN = False

TOOLS = ["KG", "LLM", "DOC"]
SCENARIOS = ["P1", "P2", "P3"]
MIN_SUBJECTS = 3  # Minimum N for any inferential test


def _safe(fn, *args, **kwargs) -> Any:
    """Run fn; return None on any exception or convergence warning."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            return fn(*args, **kwargs)
        except Exception:
            return None


def _series_per_tool(df: pd.DataFrame, col: str) -> dict[str, list[float]]:
    return {
        t: df.loc[df["tool_assigned"] == t, col].dropna().tolist()
        for t in TOOLS
    }


def _pivot_within(df: pd.DataFrame, col: str) -> pd.DataFrame | None:
    """
    Pivot to wide form (one row per subject, one column per tool).
    Keeps only subjects that have exactly one valid value per tool.
    Returns None if fewer than MIN_SUBJECTS complete cases.
    """
    pivot = (
        df.pivot_table(index="session_id", columns="tool_assigned", values=col, aggfunc="mean")
        .reindex(columns=TOOLS)
        .dropna()
    )
    if len(pivot) < MIN_SUBJECTS:
        return None
    return pivot


def _friedman(pivot: pd.DataFrame) -> dict[str, Any] | None:
    if pivot is None or len(pivot) < MIN_SUBJECTS:
        return None
    result = _safe(sp_stats.friedmanchisquare, *[pivot[t].values for t in TOOLS])
    if result is None:
        return None
    stat, p = result.statistic, result.pvalue
    # Kendall's W = chi2 / (N * (k-1))
    n, k = len(pivot), len(TOOLS)
    w = stat / (n * (k - 1)) if n * (k - 1) > 0 else None
    return {"chi2": round(float(stat), 4), "df": k - 1, "p": round(float(p), 4), "kendall_w": round(float(w), 4) if w is not None else None}


def _friedman_for_columns(pivot: pd.DataFrame, columns: list[str]) -> dict[str, Any] | None:
    if pivot is None or len(pivot) < MIN_SUBJECTS:
        return None
    result = _safe(sp_stats.friedmanchisquare, *[pivot[column].values for column in columns])
    if result is None:
        return None
    stat, p = result.statistic, result.pvalue
    n, k = len(pivot), len(columns)
    w = stat / (n * (k - 1)) if n * (k - 1) > 0 else None
    return {
        "chi2": round(float(stat), 4),
        "df": k - 1,
        "p": round(float(p), 4),
        "kendall_w": round(float(w), 4) if w is not None else None,
    }


def _wilcoxon_posthoc(pivot: pd.DataFrame) -> list[dict[str, Any]]:
    if pivot is None:
        return []
    pairs = [("KG", "LLM"), ("KG", "DOC"), ("LLM", "DOC")]
    alpha_adj = 0.05 / len(pairs)  # Bonferroni
    results = []
    for a, b in pairs:
        vals_a = pivot[a].values
        vals_b = pivot[b].values
        res = _safe(sp_stats.wilcoxon, vals_a, vals_b)
        if res is None:
            results.append({"pair": f"{a}–{b}", "statistic": None, "p_raw": None, "p_adj": None, "effect_size_r": None, "significant": None})
            continue
        stat, p_raw = res.statistic, res.pvalue
        p_adj = min(p_raw * len(pairs), 1.0)
        n = len(vals_a)
        # Rank-biserial r for Wilcoxon
        r = _safe(lambda: 1 - (2 * stat) / (n * (n + 1) / 2))
        results.append({
            "pair": f"{a}–{b}",
            "statistic": round(float(stat), 4),
            "p_raw": round(float(p_raw), 4),
            "p_adj": round(float(p_adj), 4),
            "effect_size_r": round(float(r), 4) if r is not None else None,
            "significant": bool(p_adj < alpha_adj),
        })
    return results


def _wilcoxon_posthoc_pairs(pivot: pd.DataFrame, pairs: list[tuple[str, str]]) -> list[dict[str, Any]]:
    if pivot is None:
        return []
    alpha_adj = 0.05 / len(pairs)
    results = []
    for a, b in pairs:
        vals_a = pivot[a].values
        vals_b = pivot[b].values
        res = _safe(sp_stats.wilcoxon, vals_a, vals_b)
        if res is None:
            results.append(
                {"pair": f"{a}–{b}", "statistic": None, "p_raw": None, "p_adj": None, "effect_size_r": None, "significant": None}
            )
            continue
        stat, p_raw = res.statistic, res.pvalue
        p_adj = min(p_raw * len(pairs), 1.0)
        n = len(vals_a)
        r = _safe(lambda: 1 - (2 * stat) / (n * (n + 1) / 2))
        results.append({
            "pair": f"{a}–{b}",
            "statistic": round(float(stat), 4),
            "p_raw": round(float(p_raw), 4),
            "p_adj": round(float(p_adj), 4),
            "effect_size_r": round(float(r), 4) if r is not None else None,
            "significant": bool(p_adj < alpha_adj),
        })
    return results


def _paired_t_posthoc(pivot: pd.DataFrame) -> list[dict[str, Any]]:
    if pivot is None:
        return []
    pairs = [("KG", "LLM"), ("KG", "DOC"), ("LLM", "DOC")]
    results = []
    for a, b in pairs:
        res = _safe(sp_stats.ttest_rel, pivot[a].values, pivot[b].values)
        if res is None:
            results.append({"pair": f"{a}–{b}", "t": None, "p_raw": None, "p_adj": None})
            continue
        t, p_raw = res.statistic, res.pvalue
        p_adj = min(p_raw * len(pairs), 1.0)
        results.append({
            "pair": f"{a}–{b}",
            "t": round(float(t), 4),
            "p_raw": round(float(p_raw), 4),
            "p_adj": round(float(p_adj), 4),
            "significant": bool(p_adj < 0.05 / len(pairs)),
        })
    return results


def _rm_anova(df: pd.DataFrame, col: str) -> dict[str, Any] | None:
    if not _HAS_PINGOUIN:
        return None
    pivot = _pivot_within(df, col)
    if pivot is None:
        return None
    long = pivot.reset_index().melt(id_vars="session_id", var_name="tool", value_name=col)
    res = _safe(pg.rm_anova, data=long, dv=col, within="tool", subject="session_id", correction=True)
    if res is None or res.empty:
        return None
    row = res.iloc[0]
    return {
        "F": round(float(row.get("F", np.nan)), 4),
        "df": int(row.get("ddof1", 0)),
        "df_err": int(row.get("ddof2", 0)),
        "p": round(float(row.get("p-unc", np.nan)), 4),
        "p_GG": round(float(row.get("p-GG-corr", np.nan)), 4) if "p-GG-corr" in row else None,
        "eta_sq_partial": round(float(row.get("ng2", np.nan)), 4),
        "sphericity_corrected": "p-GG-corr" in row,
    }


def _cronbach(df: pd.DataFrame, tool: str) -> float | None:
    sub = df.loc[df["tool_assigned"] == tool, ["trust_t1", "trust_t2", "trust_t3"]].dropna()
    if len(sub) < 3:
        return None
    item_variances = sub.var(axis=0, ddof=1)
    total_scores = sub.sum(axis=1)
    total_variance = total_scores.var(ddof=1)
    if pd.isna(total_variance) or total_variance <= 0:
        return None
    k = sub.shape[1]
    alpha = (k / (k - 1)) * (1 - (item_variances.sum() / total_variance))
    if pd.isna(alpha):
        return None
    return round(float(alpha), 4)


def _spearman(df: pd.DataFrame, tool: str) -> dict[str, Any] | None:
    sub = df.loc[df["tool_assigned"] == tool, ["confidence_score", "accuracy"]].dropna()
    if len(sub) < 4:
        return None
    res = _safe(sp_stats.spearmanr, sub["confidence_score"].values, sub["accuracy"].values)
    if res is None:
        return None
    return {
        "r": round(float(res.statistic), 4),
        "p": round(float(res.pvalue), 4),
        "n": int(len(sub)),
    }


def _one_sample_wilcoxon(values: list[float]) -> dict[str, Any] | None:
    if len(values) < 4:
        return None
    res = _safe(sp_stats.wilcoxon, values)
    if res is None:
        return None
    return {
        "statistic": round(float(res.statistic), 4),
        "p": round(float(res.pvalue), 4),
        "significant": bool(res.pvalue < 0.05),
    }


def _sphericity(df: pd.DataFrame, col: str) -> dict[str, Any] | None:
    if not _HAS_PINGOUIN:
        return None
    pivot = _pivot_within(df, col)
    if pivot is None:
        return None
    res = _safe(pg.sphericity, pivot)
    if res is None:
        return None
    try:
        spher, w, chi2, dof, p = res
    except (TypeError, ValueError):
        return None
    return {
        "W": round(float(w), 4),
        "chi2": round(float(chi2), 4),
        "df": int(dof),
        "p": round(float(p), 4),
        "sphericity_assumed": bool(spher),
    }


def _value_counts(series: pd.Series) -> dict[str, int]:
    cleaned = series.dropna().astype(str).str.strip()
    cleaned = cleaned[cleaned != ""]
    counts = cleaned.value_counts()
    return {str(index): int(value) for index, value in counts.items()}


def compute_stats(rows: list[dict]) -> dict[str, Any]:
    """
    Given merged data rows from db.fetch_merged_data(), compute all required tests.
    Returns the stats JSON blob served by GET /api/stats.
    """
    if not rows:
        return {"error": "No data available"}

    df = pd.DataFrame(rows)
    session_count = int(df["session_id"].nunique()) if "session_id" in df.columns else 0
    session_df = df.drop_duplicates("session_id").copy()

    # Ensure numeric types
    for col in ["trust_t1", "trust_t2", "trust_t3", "confidence_score", "accuracy",
                "time_spent_seconds", "conf_troubleshooting", "fam_manufacturing"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["trust_score"] = df[["trust_t1", "trust_t2", "trust_t3"]].mean(axis=1)
    df["calibration_index"] = (df["trust_score"] / 7.0) - df["accuracy"]

    # ---------- RQ1: Diagnostic Accuracy ----------
    acc_pivot = _pivot_within(df, "accuracy")
    accuracy_stats: dict[str, Any] = {
        "friedman": _friedman(acc_pivot),
        "posthoc": _wilcoxon_posthoc(acc_pivot),
        "descriptive": {
            t: {
                "mean": round(float(df.loc[df["tool_assigned"] == t, "accuracy"].mean()), 4)
                        if not df.loc[df["tool_assigned"] == t, "accuracy"].isna().all() else None,
                "median": round(float(df.loc[df["tool_assigned"] == t, "accuracy"].median()), 4)
                          if not df.loc[df["tool_assigned"] == t, "accuracy"].isna().all() else None,
                "sd": round(float(df.loc[df["tool_assigned"] == t, "accuracy"].std()), 4)
                      if not df.loc[df["tool_assigned"] == t, "accuracy"].isna().all() else None,
                "n": int(df.loc[(df["tool_assigned"] == t) & df["accuracy"].notna()].shape[0]),
            }
            for t in TOOLS
        },
    }

    # ---------- RQ2: Resolution Time ----------
    time_pivot = _pivot_within(df, "time_spent_seconds")
    shapiro: dict[str, Any] = {}
    for t in TOOLS:
        vals = df.loc[df["tool_assigned"] == t, "time_spent_seconds"].dropna().values
        if len(vals) >= 3:
            res = _safe(sp_stats.shapiro, vals)
            shapiro[t] = {"W": round(float(res.statistic), 4), "p": round(float(res.pvalue), 4), "normal": bool(res.pvalue > 0.05)} if res else None
        else:
            shapiro[t] = None

    all_normal = all(
        shapiro.get(t) and shapiro[t]["normal"]
        for t in TOOLS
        if shapiro.get(t) is not None
    )
    time_stats: dict[str, Any] = {
        "shapiro": shapiro,
        "sphericity": _sphericity(df, "time_spent_seconds") if all_normal else None,
        "rm_anova": _rm_anova(df, "time_spent_seconds") if all_normal else None,
        "friedman": _friedman(time_pivot) if not all_normal else None,
        "posthoc": _paired_t_posthoc(time_pivot) if all_normal else _wilcoxon_posthoc(time_pivot),
        "descriptive": {
            t: {
                "mean": round(float(df.loc[df["tool_assigned"] == t, "time_spent_seconds"].mean()), 1)
                        if not df.loc[df["tool_assigned"] == t, "time_spent_seconds"].isna().all() else None,
                "sd": round(float(df.loc[df["tool_assigned"] == t, "time_spent_seconds"].std()), 1)
                      if not df.loc[df["tool_assigned"] == t, "time_spent_seconds"].isna().all() else None,
                "timeout_rate_percent": round(
                    float(df.loc[df["tool_assigned"] == t, "timed_out"].fillna(False).astype(float).mean() * 100),
                    4,
                ) if not df.loc[df["tool_assigned"] == t].empty else None,
            }
            for t in TOOLS
        },
    }

    # ---------- RQ3: Perceived Trust ----------
    trust_pivot = _pivot_within(df, "trust_score")
    trust_stats: dict[str, Any] = {
        "friedman": _friedman(trust_pivot),
        "posthoc": _wilcoxon_posthoc(trust_pivot),
        "descriptive": {
            t: {
                "mean": round(float(df.loc[df["tool_assigned"] == t, "trust_score"].mean()), 4)
                        if not df.loc[df["tool_assigned"] == t, "trust_score"].isna().all() else None,
                "sd": round(float(df.loc[df["tool_assigned"] == t, "trust_score"].std()), 4)
                      if not df.loc[df["tool_assigned"] == t, "trust_score"].isna().all() else None,
            }
            for t in TOOLS
        },
    }

    # ---------- RQ4: Trust Calibration ----------
    calib_pivot = _pivot_within(df, "calibration_index")
    calib_stats: dict[str, Any] = {
        "friedman": _friedman(calib_pivot),
        "one_sample_wilcoxon": {
            t: _one_sample_wilcoxon(df.loc[df["tool_assigned"] == t, "calibration_index"].dropna().tolist())
            for t in TOOLS
        },
        "descriptive": {
            t: {
                "mean": round(float(df.loc[df["tool_assigned"] == t, "calibration_index"].mean()), 4)
                        if not df.loc[df["tool_assigned"] == t, "calibration_index"].isna().all() else None,
            }
            for t in TOOLS
        },
    }

    # ---------- RQ5: Preference Ranking ----------
    # Convert rank positions to Borda points: rank_1=3, rank_2=2, rank_3=1
    pref_rows = df.drop_duplicates("session_id")[["session_id", "rank_1", "rank_2", "rank_3"]].dropna()
    borda: dict[str, list[int]] = {t: [] for t in TOOLS}
    first_choice: dict[str, int] = {t: 0 for t in TOOLS}

    for _, row in pref_rows.iterrows():
        for points, rank_col in [(3, "rank_1"), (2, "rank_2"), (1, "rank_3")]:
            tool = str(row[rank_col]).upper()
            if tool in borda:
                borda[tool].append(points)
        first = str(row["rank_1"]).upper()
        if first in first_choice:
            first_choice[first] += 1

    borda_pivot_data = {t: borda[t] for t in TOOLS if borda[t]}
    borda_df: pd.DataFrame | None = None
    if len(pref_rows) >= MIN_SUBJECTS:
        borda_df = pd.DataFrame(borda).reindex(columns=TOOLS).dropna()

    pref_stats: dict[str, Any] = {
        "friedman": _friedman(borda_df),
        "first_choice_counts": first_choice,
        "first_choice_percentages": {
            t: round((first_choice[t] / len(pref_rows)) * 100, 4) if len(pref_rows) else None
            for t in TOOLS
        },
        "borda_means": {
            t: round(float(np.mean(borda[t])), 4) if borda[t] else None
            for t in TOOLS
        },
    }

    scenario_accuracy_pivot = (
        df.pivot_table(index="session_id", columns="scenario_id", values="accuracy", aggfunc="mean")
        .reindex(columns=SCENARIOS)
        .dropna()
    )
    if len(scenario_accuracy_pivot) < MIN_SUBJECTS:
        scenario_accuracy_pivot = None

    scenario_effects = {
        "accuracy_by_scenario": {
            "friedman": _friedman_for_columns(scenario_accuracy_pivot, SCENARIOS) if scenario_accuracy_pivot is not None else None,
            "posthoc": _wilcoxon_posthoc_pairs(
                scenario_accuracy_pivot,
                [("P1", "P2"), ("P1", "P3"), ("P2", "P3")],
            ) if scenario_accuracy_pivot is not None else [],
            "descriptive": {
                scenario: {
                    "mean": round(float(df.loc[df["scenario_id"] == scenario, "accuracy"].mean()), 4)
                    if not df.loc[df["scenario_id"] == scenario, "accuracy"].isna().all() else None,
                    "sd": round(float(df.loc[df["scenario_id"] == scenario, "accuracy"].std()), 4)
                    if not df.loc[df["scenario_id"] == scenario, "accuracy"].isna().all() else None,
                    "n": int(df.loc[(df["scenario_id"] == scenario) & df["accuracy"].notna()].shape[0]),
                }
                for scenario in SCENARIOS
            },
        }
    }

    participants_summary = {
        "n": session_count,
        "age_range": (
            {
                "min": int(session_df["age"].min()),
                "max": int(session_df["age"].max()),
            }
            if "age" in session_df.columns and not session_df["age"].isna().all()
            else None
        ),
        "age_collected": "age" in session_df.columns and not session_df["age"].isna().all(),
        "gender_counts": _value_counts(session_df["gender"]) if "gender" in session_df.columns else {},
        "study_profile_counts": _value_counts(session_df["study_profile"]) if "study_profile" in session_df.columns else {},
        "prior_3d_printing_experience_counts": _value_counts(session_df["exp_3d_printing"]) if "exp_3d_printing" in session_df.columns else {},
        "troubleshooting_confidence": {
            "mean": round(float(session_df["conf_troubleshooting"].mean()), 4)
            if "conf_troubleshooting" in session_df.columns and not session_df["conf_troubleshooting"].isna().all() else None,
            "sd": round(float(session_df["conf_troubleshooting"].std()), 4)
            if "conf_troubleshooting" in session_df.columns and not session_df["conf_troubleshooting"].isna().all() else None,
            "min": int(session_df["conf_troubleshooting"].min())
            if "conf_troubleshooting" in session_df.columns and not session_df["conf_troubleshooting"].isna().all() else None,
            "max": int(session_df["conf_troubleshooting"].max())
            if "conf_troubleshooting" in session_df.columns and not session_df["conf_troubleshooting"].isna().all() else None,
            "n": int(session_df["conf_troubleshooting"].notna().sum())
            if "conf_troubleshooting" in session_df.columns else 0,
        },
    }

    data_availability = {
        "participants_age_range": participants_summary["age_collected"],
        "cognitive_load_nasa_tlx": False,
        "machine_type_factor": False,
        "arburg_scenarios_present": False,
    }

    results_summary_table = {
        "Accuracy (0--1)": {
            "KG": accuracy_stats["descriptive"]["KG"]["mean"],
            "LLM": accuracy_stats["descriptive"]["LLM"]["mean"],
            "DOC": accuracy_stats["descriptive"]["DOC"]["mean"],
            "KG_sd": accuracy_stats["descriptive"]["KG"]["sd"],
            "LLM_sd": accuracy_stats["descriptive"]["LLM"]["sd"],
            "DOC_sd": accuracy_stats["descriptive"]["DOC"]["sd"],
            "p": accuracy_stats["friedman"]["p"] if accuracy_stats["friedman"] else None,
        },
        "Time (s)": {
            "KG": time_stats["descriptive"]["KG"]["mean"],
            "LLM": time_stats["descriptive"]["LLM"]["mean"],
            "DOC": time_stats["descriptive"]["DOC"]["mean"],
            "KG_sd": time_stats["descriptive"]["KG"]["sd"],
            "LLM_sd": time_stats["descriptive"]["LLM"]["sd"],
            "DOC_sd": time_stats["descriptive"]["DOC"]["sd"],
            "p": time_stats["rm_anova"]["p"] if time_stats["rm_anova"] else time_stats["friedman"]["p"] if time_stats["friedman"] else None,
        },
        "Trust (1--7)": {
            "KG": trust_stats["descriptive"]["KG"]["mean"],
            "LLM": trust_stats["descriptive"]["LLM"]["mean"],
            "DOC": trust_stats["descriptive"]["DOC"]["mean"],
            "KG_sd": trust_stats["descriptive"]["KG"]["sd"],
            "LLM_sd": trust_stats["descriptive"]["LLM"]["sd"],
            "DOC_sd": trust_stats["descriptive"]["DOC"]["sd"],
            "p": trust_stats["friedman"]["p"] if trust_stats["friedman"] else None,
        },
        "Calibration index": {
            "KG": calib_stats["descriptive"]["KG"]["mean"],
            "LLM": calib_stats["descriptive"]["LLM"]["mean"],
            "DOC": calib_stats["descriptive"]["DOC"]["mean"],
            "KG_sd": None,
            "LLM_sd": None,
            "DOC_sd": None,
            "p": calib_stats["friedman"]["p"] if calib_stats["friedman"] else None,
        },
    }

    # ---------- RQ6: Confidence vs Accuracy ----------
    corr_stats: dict[str, Any] = {
        t: _spearman(df, t)
        for t in TOOLS
    }

    # ---------- Cronbach's α ----------
    cronbach_stats: dict[str, Any] = {
        t: _cronbach(df, t)
        for t in TOOLS
    }

    return {
        "sample": {
            "sessions_n": session_count,
            "task_rows_n": int(len(df)),
            "preference_sessions_n": int(len(pref_rows)),
            "complete_cases": {
                "accuracy": int(len(acc_pivot)) if acc_pivot is not None else 0,
                "time": int(len(time_pivot)) if time_pivot is not None else 0,
                "trust": int(len(trust_pivot)) if trust_pivot is not None else 0,
                "calibration": int(len(calib_pivot)) if calib_pivot is not None else 0,
            },
        },
        "participants": participants_summary,
        "data_availability": data_availability,
        "results_summary_table": results_summary_table,
        "accuracy": accuracy_stats,
        "time": time_stats,
        "trust": trust_stats,
        "calibration": calib_stats,
        "preference": pref_stats,
        "correlation_confidence_accuracy": corr_stats,
        "cronbach_alpha": cronbach_stats,
        "scenario_effects": scenario_effects,
    }
