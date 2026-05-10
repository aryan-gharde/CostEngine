import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.flat_plan_engine import _choose_plan_area, _demo_rooms, _dxf_dimension_evidence, _extract_dimension_evidence, _fit_component_to_label, _geometry_takeoff


def _ft_label(value):
    feet = int(value)
    inches = round((value - feet) * 12)
    return f"{feet}'-{inches}\"" if inches else f"{feet}'"


def _dimension_box(value, edge, axis):
    if edge in {"top", "bottom"}:
        return {
            "text": _ft_label(value),
            "token": _ft_label(value),
            "value_ft": value,
            "confidence": 90,
            "edge": edge,
            "cx": axis,
            "cy": 3 if edge == "top" else 89,
        }
    return {
        "text": _ft_label(value),
        "token": _ft_label(value),
        "value_ft": value,
        "confidence": 90,
        "edge": edge,
        "cx": 3 if edge == "left" else 122,
        "cy": axis,
    }


def run_regression(seed=42, cases=100):
    random.seed(seed)
    failures = []
    for index in range(cases):
        width = random.uniform(24, 62)
        depth = random.uniform(18, 48)
        area = width * depth
        top_segments = [width * random.uniform(0.18, 0.34), width * random.uniform(0.18, 0.34)]
        top_segments.append(width - sum(top_segments))
        left_segments = [depth * random.uniform(0.25, 0.45), depth * random.uniform(0.18, 0.35)]
        left_segments.append(depth - sum(left_segments))
        boxes = []
        axis = 15
        for value in top_segments:
            boxes.append(_dimension_box(round(value, 2), "top", axis))
            axis += 30
        axis = 18
        for value in left_segments:
            boxes.append(_dimension_box(round(value, 2), "left", axis))
            axis += 24
        text = " ".join(box["text"] for box in boxes) + f" {round(area)} SQ FT"
        evidence = _extract_dimension_evidence(text, area, boxes)
        takeoff = _geometry_takeoff([], area, area * 0.78, 0.5, evidence)
        width_error = abs(takeoff["external_width_ft"] - width) / width
        depth_error = abs(takeoff["external_depth_ft"] - depth) / depth
        wall_error = abs(takeoff["external_wall_length_ft"] - 2 * (width + depth)) / (2 * (width + depth))
        if width_error > 0.08 or depth_error > 0.08 or wall_error > 0.08 or evidence["confidence"] < 70:
            failures.append(
                {
                    "case": index,
                    "width_error": round(width_error, 3),
                    "depth_error": round(depth_error, 3),
                    "wall_error": round(wall_error, 3),
                    "confidence": evidence["confidence"],
                    "source": takeoff["dimension_source"],
                }
            )
    return {"cases": cases, "passed": cases - len(failures), "failed": len(failures), "failures": failures[:10]}


def run_partial_dimension_regression():
    rooms = _demo_rooms(1250)
    top_only = [_dimension_box(31.0, "top", 24), _dimension_box(10.0, "top", 56)]
    left_only = [_dimension_box(18.0, "left", 18), _dimension_box(22.0, "left", 50)]

    top_evidence = _extract_dimension_evidence("31' 10' 1250 SQ FT", 1250, top_only)
    left_evidence = _extract_dimension_evidence("18' 22' 1250 SQ FT", 1250, left_only)

    top_takeoff = _geometry_takeoff(rooms, 1250, 975, 0.5, top_evidence)
    left_takeoff = _geometry_takeoff(rooms, 1250, 975, 0.5, left_evidence)

    failures = []
    if top_takeoff["dimension_source"] != "ocr-width-wall-graph":
        failures.append({"case": "top-only-source", "source": top_takeoff["dimension_source"]})
    if left_takeoff["dimension_source"] != "ocr-depth-wall-graph":
        failures.append({"case": "left-only-source", "source": left_takeoff["dimension_source"]})
    if top_takeoff["shared_wall_length_ft"] <= 0 or left_takeoff["shared_wall_length_ft"] <= 0:
        failures.append({"case": "shared-wall-length", "top": top_takeoff["shared_wall_length_ft"], "left": left_takeoff["shared_wall_length_ft"]})
    return {"cases": 3, "passed": 3 - len(failures), "failed": len(failures), "failures": failures}


def run_dxf_geometry_regression():
    dxf_meta = {
        "total_area": 330,
        "room_area_sum_sqft": 1120,
        "largest_room_area_sqft": 330,
        "bedrooms": 2,
        "bathrooms": 2,
        "kitchens": 1,
        "halls": 1,
        "line_count": 96,
        "geometry_bounds": {"width_units": 84, "height_units": 63},
        "text_dimension_evidence": {"dimension_count": 0, "confidence": 0},
    }
    label_hints = {"named_zone_count": 7, "total_area": 330}
    base_area = _choose_plan_area(dxf_meta, label_hints, {}, 1250)
    evidence = _dxf_dimension_evidence(dxf_meta, base_area)
    takeoff = _geometry_takeoff(_demo_rooms(base_area), base_area, base_area * 0.78, 0.45, evidence)

    failures = []
    if abs(base_area - 1250) > 0.1:
        failures.append({"case": "base-area", "base_area": base_area})
    if takeoff["dimension_source"] != "dxf-envelope-area-calibrated":
        failures.append({"case": "dimension-source", "source": takeoff["dimension_source"]})
    if evidence.get("confidence", 0) < 45:
        failures.append({"case": "dimension-confidence", "confidence": evidence.get("confidence", 0)})
    return {"cases": 3, "passed": 3 - len(failures), "failed": len(failures), "failures": failures}


def run_anchor_component_regression():
    lines = {
        "vertical": [0, 14, 30, 48, 72, 96, 124],
        "horizontal": [0, 12, 28, 44, 60, 76, 91],
    }
    label = {"type": "bathroom", "cx": 40, "cy": 22, "text": "Bathroom 1 48 sq ft"}
    oversized_component = {"bbox": (6, 6, 92, 72), "pixels": 5700, "source": "component"}
    fitted = _fit_component_to_label(label, oversized_component, lines, 125, 92)

    failures = []
    if not fitted:
        failures.append({"case": "missing-fit"})
    else:
        if fitted.get("bbox") == oversized_component["bbox"]:
            failures.append({"case": "bbox-not-shrunk", "bbox": fitted.get("bbox")})
        if fitted.get("pixels", oversized_component["pixels"]) >= oversized_component["pixels"]:
            failures.append({"case": "pixels-not-reduced", "pixels": fitted.get("pixels")})
        if fitted.get("source") not in {"wall-line-snap", "label-fallback-fit"}:
            failures.append({"case": "unexpected-source", "source": fitted.get("source")})
    return {"cases": 3, "passed": 3 - len(failures), "failed": len(failures), "failures": failures}


if __name__ == "__main__":
    random_result = run_regression()
    partial_result = run_partial_dimension_regression()
    dxf_result = run_dxf_geometry_regression()
    anchor_result = run_anchor_component_regression()
    result = {
        "randomized": random_result,
        "partial_dimension": partial_result,
        "dxf_geometry": dxf_result,
        "anchor_component": anchor_result,
        "failed": random_result["failed"] + partial_result["failed"] + dxf_result["failed"] + anchor_result["failed"],
    }
    print(result)
    raise SystemExit(0 if result["failed"] == 0 else 1)
