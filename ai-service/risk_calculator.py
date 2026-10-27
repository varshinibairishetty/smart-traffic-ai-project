"""
ai-service/risk_calculator.py

Python reference implementation of the rule-based accident risk calculator.
Mirrors the mathematical formulation defined in docs/feats/dataset-review-and-limitations.md.

Formulation:
    R_t = min(100, 0.55 * D_t + 0.20 * V_trend + 0.15 * M_t + 0.10 * P_t)
"""

from typing import Dict, Any, List


def get_risk_category(score: int) -> str:
    """
    Map numerical risk score to 4 standardized categories.
    """
    if score < 35:
        return "Low"
    elif score < 67:
        return "Medium"
    elif score < 85:
        return "High"
    return "Critical"


def calculate_risk_score(detection_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate deterministic rule-based risk score from YOLO detections.
    """
    summary = detection_data.get("summary", {})
    frames = detection_data.get("frames", [])
    latest_frame = frames[-1] if frames else {}

    current_count = latest_frame.get("vehicle_count", summary.get("avg_vehicles_per_frame", 0))

    # 1. Density Factor D_t (nominal capacity K_sat = 25)
    K_SAT = 25
    density_pct = min(int(round((current_count / K_SAT) * 100)), 100)

    # 2. Volume Trend Factor V_trend
    avg_count = summary.get("avg_vehicles_per_frame", current_count)
    volume_trend = min(int(round(avg_count * 4)), 100)

    # 3. Fleet Mix Penalty M_t (trucks, buses, motorcycles)
    n_trucks = 0
    n_buses = 0
    n_motorcycles = 0

    if "vehicles" in latest_frame:
        for v in latest_frame.get("vehicles", []):
            cls_name = v.get("vehicle_class", "").lower()
            if cls_name == "truck":
                n_trucks += 1
            elif cls_name == "bus":
                n_buses += 1
            elif cls_name == "motorcycle":
                n_motorcycles += 1
    elif "by_class" in summary:
        by_cls = summary.get("by_class", {})
        n_trucks = by_cls.get("truck", 0)
        n_buses = by_cls.get("bus", 0)
        n_motorcycles = by_cls.get("motorcycle", 0)

    eff_count = max(current_count, 1)
    fleet_mix = min(
        int(round(((n_trucks * 2.0 + n_buses * 1.5 + n_motorcycles * 1.2) / eff_count) * 100)),
        100,
    )

    # 4. Congestion Penalty P_t (triggers above 70% density)
    congestion_penalty = (
        min(int(round(((density_pct - 70) / 30) * 100)), 100)
        if density_pct >= 70
        else 0
    )

    # 5. Composite Score
    W_D = 0.55
    W_V = 0.20
    W_M = 0.15
    W_P = 0.10

    raw_score = (
        (W_D * density_pct)
        + (W_V * volume_trend)
        + (W_M * fleet_mix)
        + (W_P * congestion_penalty)
    )

    score = min(max(int(round(raw_score)), 0), 100)
    category = get_risk_category(score)

    return {
        "score": score,
        "category": category,
        "details": {
            "density_factor": density_pct,
            "volume_trend_factor": volume_trend,
            "fleet_mix_penalty": fleet_mix,
            "congestion_penalty": congestion_penalty,
            "formula": "min(100, 0.55*D + 0.20*V + 0.15*M + 0.10*P)",
            "model_type": "Rule-Based Deterministic Heuristic (Demo Indicator)",
        },
    }


if __name__ == "__main__":
    test_data = {
        "summary": {"avg_vehicles_per_frame": 15.0, "by_class": {"car": 141, "truck": 8, "bus": 1}},
        "frames": [{"vehicle_count": 16, "vehicles": [{"vehicle_class": "truck"}]}],
    }
    result = calculate_risk_score(test_data)
    print("AI Service Risk Score Test:", result)
