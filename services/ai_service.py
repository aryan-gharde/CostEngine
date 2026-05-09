"""
CostEngine/services/ai_explainer.py
-------------------------------------
AI-powered construction cost explanation using HuggingFace LLaMA-3.

Improvements in this version (fully backward-compatible)
---------------------------------------------------------
* build_prompt()      — NEW helper; structures estimate data before LLM injection
* query_llama()       — retry logic (2 attempts), timeout handling, no crash on failure
* fallback_answer()   — location-aware, natural language, mirrors LLM output style
* explain_estimate()  — delegates to build_prompt(); same return shape
"""

from __future__ import annotations

import logging
import os
import time
from textwrap import dedent
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

# HuggingFace endpoint
API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-3-70B-Instruct"

# Retry / timeout settings
_MAX_RETRIES: int = 2
_RETRY_DELAY: float = 1.5   # seconds between attempts
_REQUEST_TIMEOUT: int = 30  # seconds per attempt

# LLM generation parameters
_LLM_PARAMS: Dict[str, Any] = {
    "max_new_tokens": 420,
    "temperature": 0.35,
    "return_full_text": False,
}

# NEW helper: build_prompt

def build_prompt(estimate: Dict[str, Any], question: str) -> str:
    """
    Construct a structured, context-rich prompt from a cost estimate dict.

    Pulls out:
      - Total cost / cost-per-sqft
      - Top 3 cost-driving categories
      - Project location (when available)
      - Line-item count as a proxy for scope detail

    Returns a single formatted string ready for LLM injection.
    """
    #  Project context 
    project: Dict[str, Any] = estimate.get("project", {})
    location: Optional[str] = project.get("location")
    quality_tier: str = project.get("quality_tier", "Medium")
    finish_level: str = project.get("finish_level", "Standard")
    area: float = float(project.get("area", 0))
    floors: int = int(project.get("floors", 1))

    #  Financial figures 
    total_cost: float = estimate.get("total_cost", 0)
    cost_per_sqft: float = estimate.get("cost_per_sqft", 0)
    min_cost: float = estimate.get("min_cost", 0)
    max_cost: float = estimate.get("max_cost", 0)
    risk_buffer_pct: float = round(estimate.get("risk_buffer", 0) * 100, 1)

    #  Top-3 cost drivers 
    categories: list = estimate.get("categories", [])
    top_categories = sorted(categories, key=lambda x: x.get("value", 0), reverse=True)[:3]
    drivers_block: str = (
        "\n".join(
            f"  - {cat['name']}: ₹{cat['value']:,.0f}"
            for cat in top_categories
        )
        if top_categories
        else "  - No category breakdown available"
    )

    #  Line-item count 
    line_item_count: int = len(estimate.get("line_items", []))

    # Location line (omitted when absent) 
    location_line: str = f"Project Location : {location}" if location else ""

    # Assembled prompt 
    prompt = dedent(f"""
        You are a senior construction cost consultant in India.
        Your answers are concise (120-150 words max), builder-friendly, and free of filler phrases.

        ── PROJECT SUMMARY ──────────────────────────────────────────────
        {location_line}
        Quality Tier     : {quality_tier}
        Finish Level     : {finish_level}
        Built-up Area    : {area:,.0f} sqft across {floors} floor(s)

        ── COST SUMMARY ─────────────────────────────────────────────────
        Total Cost       : ₹{total_cost:,.0f}
        Cost per Sqft    : ₹{cost_per_sqft:,.0f}
        Expected Range   : ₹{min_cost:,.0f} – ₹{max_cost:,.0f}
        Risk Buffer      : {risk_buffer_pct}%
        Line Items       : {line_item_count}

        ── TOP COST DRIVERS ─────────────────────────────────────────────
        {drivers_block}

        ── USER QUESTION ────────────────────────────────────────────────
        {question}

        ── YOUR TASK ────────────────────────────────────────────────────
        Answer the question above using the data provided. Your response must:
        1. Explain WHY the top categories cost what they do.
        2. Suggest two or three concrete cost-reduction strategies.
        3. Flag key risks (material inflation, labour shortages, delays).
        4. Keep language plain — the reader is a builder, not a finance analyst.
        5. Stay under 150 words. Do NOT repeat the question or add a preamble.
    """).strip()

    return prompt

# query_llama with retry + graceful failure

def query_llama(prompt: str) -> Optional[str]:
    """
    Call the HuggingFace LLaMA-3 inference endpoint.

    Improvements
    ------------
    * Retries up to _MAX_RETRIES times on transient failures (5xx, timeout).
    * Returns None (never raises) on permanent failure so callers can fall back.
    * Logs warnings on each failed attempt for observability.
    """
    api_key: Optional[str] = os.getenv("LLAMA_API_KEY")
    if not api_key:
        logger.warning("query_llama: LLAMA_API_KEY not set — skipping LLM call.")
        return None

    headers: Dict[str, str] = {"Authorization": f"Bearer {api_key}"}
    payload: Dict[str, Any] = {"inputs": prompt, "parameters": _LLM_PARAMS}

    last_exc: Optional[Exception] = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = requests.post(
                API_URL,
                headers=headers,
                json=payload,
                timeout=_REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()

            # HuggingFace returns either a list or a dict depending on the model
            if isinstance(data, list) and data:
                text = data[0].get("generated_text", "").strip()
                return text or None
            if isinstance(data, dict):
                return (
                    data.get("generated_text")
                    or data.get("error")          # surface API-level errors
                    or None
                )
            return str(data) or None

        except requests.exceptions.Timeout as exc:
            last_exc = exc
            logger.warning("query_llama: attempt %d/%d timed out.", attempt, _MAX_RETRIES)
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "?"
            last_exc = exc
            # Don't retry on client-side errors (4xx) — they won't self-heal
            if exc.response is not None and exc.response.status_code < 500:
                logger.warning("query_llama: HTTP %s — not retrying.", status)
                return None
            logger.warning("query_llama: attempt %d/%d — HTTP %s.", attempt, _MAX_RETRIES, status)
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            logger.warning("query_llama: attempt %d/%d — %s.", attempt, _MAX_RETRIES, exc)

        # Back off before the next attempt (no sleep after the last one)
        if attempt < _MAX_RETRIES:
            time.sleep(_RETRY_DELAY)

    logger.error("query_llama: all %d attempts failed. Last error: %s", _MAX_RETRIES, last_exc)
    return None

# fallback_answer — location-aware, natural language

def fallback_answer(estimate: Dict[str, Any], question: str) -> str:
    """
    Generate a deterministic, human-readable cost summary without the LLM.

    Used when the API is unavailable or returns nothing usable.

    Improvements
    ------------
    * Includes project location when available.
    * Surfaces top-3 drivers instead of just the largest one.
    * Mirrors the tone and structure of the LLM-generated answers.
    * Handles empty or missing data safely.
    """
    # Figures 
    total: float = estimate.get("total_cost", 0)
    cpsf: float = estimate.get("cost_per_sqft", 0)
    min_cost: float = estimate.get("min_cost", 0)
    max_cost: float = estimate.get("max_cost", 0)
    risk_pct: float = round(estimate.get("risk_buffer", 0) * 100, 1)

    #  Location 
    project: Dict[str, Any] = estimate.get("project", {})
    location: Optional[str] = project.get("location")
    location_phrase: str = f" for the {location} project" if location else ""

    # Cost drivers 
    categories: list = estimate.get("categories", [])
    top: list = sorted(categories, key=lambda x: x.get("value", 0), reverse=True)[:3]

    if top:
        driver_lines = "  • " + "\n  • ".join(
            f"{cat['name']}: ₹{cat['value']:,.0f}"
            for cat in top
        )
    else:
        driver_lines = "  • Structure (breakdown unavailable)"

    # Assembled response 
    return dedent(f"""
        Cost summary{location_phrase}:
        Total estimate is ₹{total:,.0f} (₹{cpsf:,.0f}/sqft).
        Expected range: ₹{min_cost:,.0f} – ₹{max_cost:,.0f}, with a {risk_pct}% risk buffer included.

        Top cost drivers:
        {driver_lines}

        To reduce costs: review finish specifications first (Finishing is often 20-30% reducible),
        value-engineer MEP fixtures, and lock steel and cement rates before procurement.
        Keep 10–20% contingency for labour shortages, material price spikes, and schedule delays.
        Begin procurement once drawings are frozen; compare at least two or three vendor quotes
        before any major purchase.
    """).strip()
# explain_estimate  unchanged signature, improved internals

def explain_estimate(estimate: Dict[str, Any], question: str) -> Dict[str, str]:
    """
    Return an AI-generated (or fallback) explanation of a cost estimate.

    Parameters
    ----------
    estimate : dict
        Output of calculate_estimate() from cost_engine.py.
    question : str
        Free-text question from the user.

    Returns
    -------
    dict
        {"answer": str, "source": "huggingface-llama-3" | "local-fallback"}

    Notes
    -----
    * Delegates prompt construction to build_prompt() for clean separation.
    * query_llama() never raises — failures yield None and trigger fallback.
    * source includes exception detail on unexpected errors for debuggability.
    """
    # Guard against a completely missing estimate
    if not estimate:
        return {
            "answer": "No estimate data was provided. Please run calculate_estimate() first.",
            "source": "local-fallback",
        }

    try:
        prompt: str = build_prompt(estimate, question)
        answer: Optional[str] = query_llama(prompt)

        if answer:
            return {"answer": answer, "source": "huggingface-llama-3"}

    except Exception as exc:
        # Unexpected error in prompt building — log and fall through to fallback
        logger.exception("explain_estimate: unexpected error — %s", exc)
        return {
            "answer": fallback_answer(estimate, question),
            "source": f"local-fallback: {exc}",
        }

    # query_llama returned None (API unavailable, no key, all retries exhausted)
    return {"answer": fallback_answer(estimate, question), "source": "local-fallback"}
