import os
from textwrap import dedent

import requests

API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-3-70B-Instruct"


def fallback_answer(estimate, question):
    total = estimate.get("total_cost", 0)
    cpsf = estimate.get("cost_per_sqft", 0)
    categories = estimate.get("categories", [])
    largest = max(categories, key=lambda item: item.get("value", 0)) if categories else {"name": "Structure", "value": 0}
    return dedent(
        f"""
        Estimated total is Rs. {total:,.0f}, or about Rs. {cpsf:,.0f} per sqft.
        The largest cost driver is {largest['name']} at Rs. {largest['value']:,.0f}.
        To reduce cost, start with finish specifications, value-engineer MEP fixtures, lock steel and cement rates early, and keep a 10-20% risk buffer.
        For timing, begin procurement once drawings are frozen and compare market prices for two to three weeks before major purchases.
        """
    ).strip()


def query_llama(prompt):
    api_key = os.getenv("LLAMA_API_KEY")
    if not api_key:
        return None
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": 420, "temperature": 0.35, "return_full_text": False},
    }
    response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    if isinstance(data, list) and data:
        return data[0].get("generated_text", "").strip()
    if isinstance(data, dict):
        return data.get("generated_text") or data.get("error")
    return str(data)


def explain_estimate(estimate, question):
    prompt = dedent(
        f"""
        You are a senior construction cost consultant in India.
        Answer in concise, human-readable language.

        User question: {question}

        Current estimate:
        {estimate}

        Include major cost drivers, risk buffer rationale, and practical recommendations.
        """
    )
    try:
        answer = query_llama(prompt)
        if answer:
            return {"answer": answer, "source": "huggingface-llama-3"}
    except Exception as exc:
        return {"answer": fallback_answer(estimate, question), "source": f"local-fallback: {exc}"}
    return {"answer": fallback_answer(estimate, question), "source": "local-fallback"}

