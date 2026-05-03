from copy import deepcopy

RATES = {"Medium": 2000, "High": 3200}
CATEGORY_SPLIT = {
    "Structure": 0.40,
    "Finishing": 0.30,
    "MEP": 0.20,
    "Labour": 0.10,
}


def _default_rows(category: str, category_total: float, area: float):
    row_templates = {
        "Structure": [("RCC frame", 0.46), ("Steel reinforcement", 0.26), ("Masonry", 0.18), ("Waterproofing", 0.10)],
        "Finishing": [("Flooring", 0.28), ("Paint and putty", 0.18), ("Doors and windows", 0.24), ("Fixtures", 0.30)],
        "MEP": [("Electrical", 0.36), ("Plumbing", 0.30), ("Fire and safety", 0.14), ("HVAC provisions", 0.20)],
        "Labour": [("Civil labour", 0.55), ("Skilled trades", 0.28), ("Site supervision", 0.17)],
    }
    rows = []
    for idx, (name, share) in enumerate(row_templates[category], start=1):
        quantity = round(max(area * share / 10, 1), 2)
        amount = round(category_total * share)
        price = round(amount / quantity, 2)
        rows.append(
            {
                "id": f"{category.lower()}-{idx}",
                "name": name,
                "category": category,
                "quantity": quantity,
                "unit": "lot" if name in {"Site supervision", "Fire and safety"} else "unit",
                "price": price,
                "amount": amount,
            }
        )
    return rows


def calculate_estimate(project, line_items=None, risk_buffer=None, material_prices=None):
    quality = project.quality_tier if hasattr(project, "quality_tier") else project.get("quality_tier", "Medium")
    area = float(project.area if hasattr(project, "area") else project.get("area", 0))
    floors = int(project.floors if hasattr(project, "floors") else project.get("floors", 1))
    finish_level = project.finish_level if hasattr(project, "finish_level") else project.get("finish_level", "Standard")
    preferences = project.material_preferences if hasattr(project, "material_preferences") else project.get("material_preferences", [])

    custom_rate = project.custom_rate_per_sqft if hasattr(project, "custom_rate_per_sqft") else project.get("custom_rate_per_sqft")
    rate = float(custom_rate) if custom_rate else RATES.get(quality, RATES["Medium"])
    finish_multiplier = {"Basic": 0.94, "Standard": 1.0, "Premium": 1.12, "Luxury": 1.22}.get(finish_level, 1.0)
    floor_complexity = 1 + max(floors - 1, 0) * 0.015
    material_multiplier = 1 + min(len(preferences), 5) * 0.01
    base_cost = area * rate * finish_multiplier * floor_complexity * material_multiplier

    if risk_buffer is None:
        risk_buffer = 0.12 if quality == "Medium" else 0.16
    risk_buffer = max(0.10, min(float(risk_buffer), 0.20))

    if line_items:
        rows = deepcopy(line_items)
        for row in rows:
            row["amount"] = round(float(row.get("quantity", 0)) * float(row.get("price", 0)))
    else:
        rows = []
        for category, share in CATEGORY_SPLIT.items():
            rows.extend(_default_rows(category, base_cost * share, area))

    subtotal = round(sum(row["amount"] for row in rows))
    risk_amount = round(subtotal * risk_buffer)
    total = subtotal + risk_amount
    categories = []
    for category in CATEGORY_SPLIT:
        total_for_category = round(sum(row["amount"] for row in rows if row["category"] == category))
        categories.append({"name": category, "value": total_for_category})

    return {
        "project": {
            "name": project.name if hasattr(project, "name") else project.get("name"),
            "location": project.location if hasattr(project, "location") else project.get("location"),
            "area": area,
            "floors": floors,
            "quality_tier": quality,
            "finish_level": finish_level,
            "material_preferences": preferences,
            "custom_rate_per_sqft": custom_rate,
        },
        "rate": rate,
        "subtotal": subtotal,
        "risk_buffer": risk_buffer,
        "risk_amount": risk_amount,
        "total_cost": total,
        "cost_per_sqft": round(total / area, 2) if area else 0,
        "min_cost": round(total * 0.92),
        "expected_cost": total,
        "max_cost": round(total * 1.14),
        "categories": categories,
        "line_items": rows,
        "material_prices": material_prices or {},
    }


def run_scenario(estimate, delay_months=0, quality_tier="Medium"):
    updated = deepcopy(estimate)
    current_quality = estimate.get("project", {}).get("quality_tier", "Medium")
    old_rate = RATES.get(current_quality, RATES["Medium"])
    new_rate = RATES.get(quality_tier, old_rate)
    quality_factor = new_rate / old_rate if old_rate else 1
    delay_factor = 1 + (int(delay_months) * 0.012)
    factor = quality_factor * delay_factor

    for row in updated.get("line_items", []):
        row["price"] = round(float(row["price"]) * factor, 2)
        row["amount"] = round(float(row["quantity"]) * float(row["price"]))

    updated["project"]["quality_tier"] = quality_tier
    updated["subtotal"] = round(sum(row["amount"] for row in updated.get("line_items", [])))
    updated["risk_amount"] = round(updated["subtotal"] * float(updated.get("risk_buffer", 0.12)))
    updated["total_cost"] = updated["subtotal"] + updated["risk_amount"]
    area = updated.get("project", {}).get("area", 1)
    updated["cost_per_sqft"] = round(updated["total_cost"] / area, 2)
    updated["min_cost"] = round(updated["total_cost"] * 0.92)
    updated["expected_cost"] = updated["total_cost"]
    updated["max_cost"] = round(updated["total_cost"] * 1.14)
    updated["categories"] = [
        {"name": category, "value": round(sum(row["amount"] for row in updated["line_items"] if row["category"] == category))}
        for category in CATEGORY_SPLIT
    ]
    updated["scenario"] = {
        "delay_months": delay_months,
        "quality_tier": quality_tier,
        "inflation_factor": round(delay_factor, 4),
        "quality_factor": round(quality_factor, 4),
    }
    return updated
