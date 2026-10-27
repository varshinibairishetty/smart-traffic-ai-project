"""
ai-service/tests/test_risk_calculator.py

Unit tests for Python reference implementation of rule-based accident risk calculation.
Verifies Rt formula, bounded scores, heavy vehicle weighting, and congestion penalties.
"""

import pytest
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from risk_calculator import calculate_risk_score, get_risk_category


class TestRiskCategoryMapping:
    def test_low_risk_category(self):
        assert get_risk_category(0) == "Low"
        assert get_risk_category(20) == "Low"
        assert get_risk_category(34) == "Low"

    def test_medium_risk_category(self):
        assert get_risk_category(35) == "Medium"
        assert get_risk_category(50) == "Medium"
        assert get_risk_category(66) == "Medium"

    def test_high_risk_category(self):
        assert get_risk_category(67) == "High"
        assert get_risk_category(75) == "High"
        assert get_risk_category(84) == "High"

    def test_critical_risk_category(self):
        assert get_risk_category(85) == "Critical"
        assert get_risk_category(95) == "Critical"
        assert get_risk_category(100) == "Critical"


class TestCalculateRiskScore:
    def test_empty_detections(self):
        empty_data = {
            "summary": {"avg_vehicles_per_frame": 0, "by_class": {}},
            "frames": [{"vehicle_count": 0, "vehicles": []}]
        }
        res = calculate_risk_score(empty_data)
        assert 0 <= res["score"] <= 34
        assert res["category"] == "Low"
        assert "details" in res

    def test_score_bounds_capped_at_100(self):
        extreme_data = {
            "summary": {"avg_vehicles_per_frame": 80, "by_class": {"truck": 40, "bus": 40}},
            "frames": [{"vehicle_count": 80, "vehicles": [{"vehicle_class": "truck"}] * 80}]
        }
        res = calculate_risk_score(extreme_data)
        assert res["score"] <= 100
        assert res["category"] == "Critical"

    def test_fleet_mix_penalty_increases_score(self):
        cars_only = {
            "summary": {"avg_vehicles_per_frame": 12, "by_class": {"car": 12}},
            "frames": [{"vehicle_count": 12, "vehicles": [{"vehicle_class": "car"}] * 12}]
        }
        heavy_fleet = {
            "summary": {"avg_vehicles_per_frame": 12, "by_class": {"truck": 6, "bus": 6}},
            "frames": [{"vehicle_count": 12, "vehicles": [{"vehicle_class": "truck"}] * 6 + [{"vehicle_class": "bus"}] * 6}]
        }
        res_cars = calculate_risk_score(cars_only)["score"]
        res_heavy = calculate_risk_score(heavy_fleet)["score"]
        assert res_heavy > res_cars

    def test_deterministic_consistency(self):
        data = {
            "summary": {"avg_vehicles_per_frame": 16, "by_class": {"car": 10, "bus": 4, "motorcycle": 2}},
            "frames": [{"vehicle_count": 16}]
        }
        score1 = calculate_risk_score(data)
        score2 = calculate_risk_score(data)
        assert score1["score"] == score2["score"]
        assert score1["category"] == score2["category"]
