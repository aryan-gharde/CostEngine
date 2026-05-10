from copy import deepcopy

RATES = {"Medium": 2000, "High": 3200}
CATEGORY_SPLIT = {
    "Structure": 0.40,
    "Finishing": 0.30,
    "MEP": 0.20,
    "Labour": 0.10,
}
FINISH_FACTORS = {"Basic": 0.94, "Standard": 1.0, "Premium": 1.12, "Luxury": 1.22}
MARKET_BASELINE = {
    "steel": 62500,
    "cement": 410,
    "sand": 72,
    "tiles": 105,
    "paint": 18,
}
MARKET_WEIGHTS = {
    "steel": 0.34,
    "cement": 0.24,
    "sand": 0.16,
    "tiles": 0.16,
    "paint": 0.10,
}
DEFAULT_WASTE_BY_CATEGORY = {
    "Structure": 0.04,
    "Finishing": 0.10,
    "MEP": 0.05,
    "Labour": 0.00,
}


def _height_factor(floors: int):
    if floors <= 4:
        return 1.0
    if floors <= 12:
        return 1.15
    return 1.40


def _market_multiplier(material_prices=None):
    if not material_prices:
        return 1.0
    multiplier = 0
    applied_weight = 0
    for material, baseline in MARKET_BASELINE.items():
        price = material_prices.get(material) if isinstance(material_prices, dict) else None
        if not price or baseline <= 0:
            continue
        weight = MARKET_WEIGHTS.get(material, 0)
        multiplier += (float(price) / baseline) * weight
        applied_weight += weight
    if not applied_weight:
        return 1.0
    normalized = multiplier + (1 - applied_weight)
    return round(max(0.88, min(normalized, 1.30)), 4)


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
        waste_percent = DEFAULT_WASTE_BY_CATEGORY.get(category, 0.03)
        effective_quantity = quantity * (1 + waste_percent)
        price = round(amount / effective_quantity, 2)
        rows.append(
            {
                "id": f"{category.lower()}-{idx}",
                "name": name,
                "category": category,
                "quantity": quantity,
                "waste_percent": waste_percent,
                "effective_quantity": round(effective_quantity, 2),
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
    finish_multiplier = FINISH_FACTORS.get(finish_level, 1.0)
    height_factor = _height_factor(floors)
    material_multiplier = 1 + min(len(preferences), 5) * 0.01
    market_multiplier = _market_multiplier(material_prices)
    effective_area = area
    adjusted_rate = rate * height_factor
    base_cost = effective_area * adjusted_rate * finish_multiplier * material_multiplier
    market_cost = base_cost * market_multiplier

    if risk_buffer is None:
        risk_buffer = 0.12 if quality == "Medium" else 0.16
    risk_buffer = max(0.10, min(float(risk_buffer), 0.20))

    if line_items:
        rows = deepcopy(line_items)
        for row in rows:
            waste_percent = max(0, min(float(row.get("waste_percent", 0) or 0), 0.25))
            effective_quantity = float(row.get("quantity", 0)) * (1 + waste_percent)
            row["waste_percent"] = waste_percent
            row["effective_quantity"] = round(effective_quantity, 2)
            row["amount"] = round(effective_quantity * float(row.get("price", 0)))
    else:
        rows = []
        for category, share in CATEGORY_SPLIT.items():
            rows.extend(_default_rows(category, market_cost * share, effective_area))

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
        "adjusted_rate": round(adjusted_rate, 2),
        "effective_area": effective_area,
        "base_cost": round(base_cost),
        "market_multiplier": market_multiplier,
        "market_adjusted_cost": round(market_cost),
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
        "formula_trace": {
            "source": "construction_estimation_formulas.pdf",
            "base": "C_base = Area x Regional Rate x Finish Factor x Height Factor",
            "market": "C_market = C_base x Market Multiplier",
            "risk": "C_final = C_market x (1 + Risk Buffer)",
            "effective_area_note": "Project area is treated as effective built-up area unless common/refuge/service areas are supplied.",
            "finish_factor": finish_multiplier,
            "height_factor": height_factor,
            "material_preference_factor": round(material_multiplier, 4),
        },
    }


def run_scenario(estimate, delay_months=0, quality_tier="Medium"):
    updated = deepcopy(estimate)
    current_quality = estimate.get("project", {}).get("quality_tier", "Medium")
    old_rate = RATES.get(current_quality, RATES["Medium"])
    new_rate = RATES.get(quality_tier, old_rate)
    quality_factor = new_rate / old_rate if old_rate else 1
    monthly_inflation = float(estimate.get("monthly_inflation_rate", 0.012))
    delay_factor = 1 + (int(delay_months) * monthly_inflation)
    completed_ratio = max(0, min(float(estimate.get("completion_percent", 0)) / 100, 1))
    remaining_ratio = 1 - completed_ratio

    for row in updated.get("line_items", []):
        original_amount = float(row.get("amount", 0)) or float(row.get("quantity", 0)) * float(row.get("price", 0))
        affected_amount = original_amount * completed_ratio + original_amount * remaining_ratio * delay_factor
        adjusted_amount = affected_amount * quality_factor
        quantity = max(float(row.get("quantity", 0)), 0.0001)
        row["price"] = round(adjusted_amount / quantity, 2)
        row["amount"] = round(adjusted_amount)

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
        "remaining_work_factor": round(remaining_ratio, 4),
        "formula": "C_affected = Remaining Cost x Inflation; completed work is not inflated.",
    }
    return updated
