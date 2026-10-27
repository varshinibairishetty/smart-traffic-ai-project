# ai-service/scenario_runner.py
#
# Smart Traffic AI — Test & Demo Scenario Runner for Live Viva Presentation.
#
# Allows presenters to easily simulate and showcase different traffic states in real-time:
#   • Scenario A: Normal Flow with low Rt score (~15, Low - Green markers)
#   • Scenario B: Moderate Traffic with medium Rt score (~45, Medium - Amber markers)
#   • Scenario C: Sudden Heavy Congestion in HITEC City with critical Rt score (~92, Critical - Red Alert)
#   • Scenario D: Multi-Vehicle Incident with lane obstruction (~72, High - Red/Orange)
#   • Automated Tour: Automatically sequences through scenarios with visual countdown
#
# USAGE:
#   # Interactive menu:
#   python scenario_runner.py
#
#   # Direct command-line toggles:
#   python scenario_runner.py --scenario normal
#   python scenario_runner.py --scenario moderate
#   python scenario_runner.py --scenario congestion
#   python scenario_runner.py --scenario incident
#   python scenario_runner.py --reset
#
#   # Automated Viva Presentation Tour:
#   python scenario_runner.py --demo

import argparse
import sys
import time
from typing import Optional

try:
    import requests
except ImportError:
    requests = None

try:
    import socketio
except ImportError:
    socketio = None

BACKEND_URL = "http://localhost:5000"

SCENARIOS = {
    "1": ("normal", "Scenario A: Normal Flow (Off-Peak) — Low Rt ~15 (Green)"),
    "2": ("moderate", "Scenario B: Moderate Traffic (Regular Commute) — Medium Rt ~45 (Amber)"),
    "3": ("congestion", "Scenario C: Sudden Heavy Congestion in HITEC City — Critical Rt ~92 (Red Alert)"),
    "4": ("incident", "Scenario D: Collision & Road Obstruction in Madhapur — High Rt ~72 (Red/Orange)"),
}


def trigger_scenario_via_http(scenario_id: str, backend_url: str = BACKEND_URL) -> bool:
    """Trigger scenario using REST API."""
    if requests is None:
        return False
    try:
        url = f"{backend_url}/api/demo/scenario"
        res = requests.post(url, json={"scenario": scenario_id}, timeout=3.0)
        if res.ok:
            data = res.json()
            print(f"  ✅ [REST] {data.get('message', 'Scenario triggered successfully')}")
            return True
        else:
            print(f"  ❌ [REST] Server responded with HTTP {res.status_code}")
            return False
    except Exception as exc:
        print(f"  ⚠️  [REST] Connection error: {exc}")
        return False


def trigger_scenario_via_socket(scenario_id: str, backend_url: str = BACKEND_URL) -> bool:
    """Trigger scenario using Socket.io client."""
    if socketio is None:
        return False
    sio = socketio.Client(reconnection=False)
    try:
        sio.connect(backend_url, transports=["websocket", "polling"])
        sio.emit("trigger_scenario", scenario_id)
        time.sleep(0.3)
        sio.disconnect()
        print(f"  ⚡ [Socket.io] Emitted 'trigger_scenario' -> '{scenario_id}'")
        return True
    except Exception as exc:
        print(f"  ⚠️  [Socket.io] Connection error: {exc}")
        return False


def trigger(scenario_id: str, backend_url: str = BACKEND_URL):
    """Attempt trigger via Socket.io first, then REST fallback."""
    print(f"\n📡 Triggering scenario '{scenario_id}' on {backend_url}...")
    success = trigger_scenario_via_socket(scenario_id, backend_url)
    if not success:
        success = trigger_scenario_via_http(scenario_id, backend_url)

    if success:
        print("🎉 Real-time update dispatched! Check the React dashboard and Live Map.\n")
    else:
        print(f"❌ Failed to reach backend at {backend_url}.")
        print("   Make sure the Express backend is running (`cd backend && npm start`).\n")


def run_automated_tour(backend_url: str = BACKEND_URL, step_duration: int = 8):
    """
    Automated presentation walkthrough tour that sequences through all scenarios.
    Perfect for running hands-free during a live college viva presentation.
    """
    print("\n" + "=" * 68)
    print("  🎬 Smart Traffic AI — Automated Viva Presentation Tour")
    print("  Walking through full operational cycle (Normal -> Congestion -> Recovery)")
    print("=" * 68)

    tour_steps = [
        ("normal", "STEP 1: Normal Off-Peak Traffic (Low Rt, Green Markers)"),
        ("moderate", "STEP 2: Midday Volume Buildup (Medium Rt, Amber Markers)"),
        ("congestion", "STEP 3: Sudden Bottleneck in HITEC City (Critical Rt, Red Alerts)"),
        ("incident", "STEP 4: Collision Incident Registered (Emergency Advisory)"),
        ("normal", "STEP 5: Incident Cleared & Traffic Recovery (System Normalizes)"),
    ]

    for idx, (sc_id, desc) in enumerate(tour_steps, 1):
        print(f"\n[{idx}/{len(tour_steps)}] {desc}")
        print("-" * 68)
        trigger(sc_id, backend_url)

        for remaining in range(step_duration, 0, -1):
            sys.stdout.write(f"\r  ⏱️  Observing real-time dashboard reaction... {remaining}s remaining ")
            sys.stdout.flush()
            time.sleep(1)
        print("\r  ⏱️  Step complete!                                        ")

    print("\n" + "=" * 68)
    print("  ✅ Automated Viva Tour Complete! All states showcased successfully.")
    print("=" * 68 + "\n")


def interactive_menu(backend_url: str = BACKEND_URL):
    """Interactive numeric console menu for live testing."""
    while True:
        print("\n" + "=" * 68)
        print("  🚦 Smart Traffic AI — Viva & Demo Scenario Runner")
        print("=" * 68)
        print("  Select a simulation scenario to trigger in real time:\n")
        print("  [1] Scenario A: Normal Flow               (Low Rt ~15 - Green)")
        print("  [2] Scenario B: Moderate Traffic          (Medium Rt ~45 - Amber)")
        print("  [3] Scenario C: Sudden Congestion (HITEC) (Critical Rt ~92 - Red Alert)")
        print("  [4] Scenario D: Multi-Vehicle Incident    (High Rt ~72 - Red/Orange)")
        print("  [5] 🎬 Automated Presentation Tour        (Sequences all 4 states)")
        print("  [0] Reset to Live Video Detection")
        print("  [q] Quit")
        print("=" * 68)

        choice = input("Enter choice (1-5, 0, q): ").strip().lower()

        if choice == "q":
            print("Exiting Scenario Runner. Goodbye!")
            break
        elif choice == "1":
            trigger("normal", backend_url)
        elif choice == "2":
            trigger("moderate", backend_url)
        elif choice == "3":
            trigger("congestion", backend_url)
        elif choice == "4":
            trigger("incident", backend_url)
        elif choice == "5":
            run_automated_tour(backend_url)
        elif choice == "0":
            trigger("reset", backend_url)
        else:
            print("Invalid selection. Please choose 1-5, 0, or q.")


def main():
    parser = argparse.ArgumentParser(description="Smart Traffic AI — Demo Scenario Runner")
    parser.add_argument(
        "--scenario",
        "-s",
        type=str,
        choices=["normal", "moderate", "congestion", "incident", "reset", "a", "b", "c", "d"],
        help="Trigger a specific demo scenario immediately",
    )
    parser.add_argument(
        "--demo",
        "--tour",
        action="store_true",
        help="Run the automated presentation sequence tour",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset to live video detection data",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=BACKEND_URL,
        help=f"Backend URL (default: {BACKEND_URL})",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=8,
        help="Duration in seconds per step in automated tour (default: 8s)",
    )

    args = parser.parse_args()

    # Normalize scenario aliases
    scenario_map = {"a": "normal", "b": "moderate", "c": "congestion", "d": "incident"}

    if args.reset:
        trigger("reset", args.url)
    elif args.demo:
        run_automated_tour(args.url, step_duration=args.duration)
    elif args.scenario:
        sc = scenario_map.get(args.scenario, args.scenario)
        trigger(sc, args.url)
    else:
        interactive_menu(args.url)


if __name__ == "__main__":
    main()
