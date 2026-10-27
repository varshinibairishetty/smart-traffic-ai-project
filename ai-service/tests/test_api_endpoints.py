"""
ai-service/tests/test_api_endpoints.py

FastAPI endpoint integration tests using TestClient.
Verifies service metadata, production container healthcheck, and schema structure.
"""

import pytest
import sys
import os
from fastapi.testclient import TestClient

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app


@pytest.fixture(scope="module")
def client():
    # Use TestClient with lifespan disabled/mocked for fast unit testing
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "version" in data
    assert "routes" in data


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "healthy", "degraded"]
    assert "model_loaded" in data
    assert "checks" in data
    assert "filesystem" in data["checks"]
    assert "model" in data["checks"]


def test_health_checks_structure(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    checks = data.get("checks", {})
    assert "model" in checks
    assert "name" in checks["model"]
    assert "sample_video_accessible" in checks["filesystem"]
