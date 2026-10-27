# Dataset Review, Limitations & Risk Model Fallback Strategy

> **Document Version:** 1.0.0  
> **Date:** October 27, 2026  
> **Status:** Approved Baseline for Phase 4 / Phase 6 Data Planning  
> **Target Audience:** College Project Contributors, Reviewers & Evaluators

---

## 1. Executive Summary

A core objective of this project is exploring **accident risk prediction** alongside real-time **vehicle detection**. 

In conventional academic plans, teams often envision an end-to-end Machine Learning pipeline where:
1. Video streams yield vehicle bounding boxes, counts, and velocities via YOLO/OpenCV.
2. Historical tabular accident datasets (e.g., UK DfT, US Accidents) train a supervised classification/regression model (e.g., XGBoost).
3. The video features are matched with accident records to predict accident risk in real time.

However, after conducting a rigorous evaluation of publicly accessible traffic datasets, we identified a fundamental **spatiotemporal misalignment problem**: public accident databases log historical incidents retrospectively across entire road networks, whereas video benchmarks provide narrow, non-geolocated, or temporally desynchronized camera views.

This document reviews available candidate datasets, details why direct feature-matching is technically intractable without bespoke multi-sensor deployments, and formalizes our **transparent, rule-based risk indicator** as our validated MVP fallback strategy.

---

## 2. Review of Candidate Public Datasets

We evaluated both **historical tabular accident databases** and **computer vision traffic benchmarks**.

### 2.1 Historical Accident Records (Tabular)

| Dataset | Source / Custodian | License | Key Features | Inherent Limitations for Video Synergy |
|---|---|---|---|---|
| **UK DfT Road Safety Data (STATS19)** | UK Department for Transport (data.gov.uk) | Open Government Licence (OGL v3.0) | Accident severity, date/time, weather conditions, road surface condition, speed limit, vehicle types involved. | Logged retroactively by police reports. No visual/camera feed; spatial coordinates are generalized; no continuous vehicle volume or density at the moment before impact. |
| **US Accidents Dataset (2016–2023)** | Moosavi et al. / Kaggle / Academic | CC BY-NC-SA 4.0 | ~7.7 million records across 49 US states; GPS coordinates, start/end timestamps, severity (1–4), weather events, points of interest. | Data captured via traffic API alerts (Bing, MapQuest, sensors); lacks localized camera feeds, individual vehicle trajectories, or continuous pre-accident traffic counts. |
| **City-Specific Open Data Portals (e.g., NYC OpenData, Transport for London)** | Municipal Governments | Various Public Open Data Licenses | Intersection crashes, contributing factors (distraction, failure to yield), injury counts. | High spatial granularity but completely dissociated from publicly downloadable, continuous high-definition traffic camera video. |

### 2.2 Traffic Camera & Video Detection Benchmarks

| Dataset | Source / Custodian | License | Key Features | Inherent Limitations for Accident Prediction |
|---|---|---|---|---|
| **NVIDIA AI City Challenge** | NVIDIA / IEEE | Academic Research License | High-angle multi-camera CCTV feeds of intersections and highways; vehicle tracking and traffic anomaly benchmarks. | Excellent for vehicle counting and anomaly detection, but actual vehicular accidents are extremely sparse or absent in standard challenge tracks. Feeds are unlinked to regional accident databases. |
| **UA-DETRAC Benchmark** | University at Albany | Non-commercial / Research | 100 video sequences (over 140,000 frames) recorded at urban crossings in Beijing; rich annotations for occlusion, vehicle classes, and weather. | Dedicated strictly to vehicle detection and tracking. Contains zero accident occurrences or accident-risk ground truth labels. |
| **Public Domain & Creative Commons Clips (e.g., Wikimedia, Mixkit, Pexels)** | Individual contributors / CC0 / Public Domain | Public Domain / CC0 / Open Stock | Short clips (5–60 seconds) showing city intersections and highways with cars, buses, and trucks. | Ideal for lightweight laptop testing of YOLO v8. No geolocation metadata, no timestamps matching real collision logs, and no accident events. |

---

## 3. The Spatiotemporal Misalignment Problem

Why is it scientifically improper to claim direct pairing between public traffic videos and public accident logs without synthetic workarounds?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       The Data Mismatch Dilemma                             │
└─────────────────────────────────────────────────────────────────────────────┘

     Traffic Camera Video (CV Domain)         Historical Accident Data (Tabular)
     ────────────────────────────────         ──────────────────────────────────
     • Microsecond/frame-level resolution     • Aggregated by hour, day, or year
     • Hyper-local (cone of camera view)      • Regional road or junction code
     • Features: BBoxes, vehicle density,     • Features: Weather, light conditions,
       visual proximity, flow speed             driver age, severity class
     • Ground truth: Object presence          • Ground truth: Crash occurred (binary)
     
                                    ▲
                                    │  CANNOT DIRECTLY JOIN
                                    │  ON (TIME + LAT + LON)
                                    ▼
     Missing: Synchronized video cameras pointing at the exact junction 
              at the exact minute a documented STATS19 or US accident occurred.
```

### Key Technical Challenges

1. **Temporal Discrepancy:**  
   Accident databases typically record incidents with approximations (e.g., "14:30 on 2021-04-12" or rounded time windows). Video feeds capture continuous dynamics at 25–30 frames per second. Bridging this requires continuous real-time surveillance archive access that is unavailable in open datasets.
2. **Spatial Discrepancy:**  
   Tabular records provide GPS centroids or police road numbers. A camera view represents a specific optical frustum (often tilted, occluded, or panning). Associating a bounding box in pixel space $(x_1, y_1, x_2, y_2)$ with an area-level accident record creates spurious correlations.
3. **Severe Class Imbalance:**  
   Vehicular crashes are statistically rare events per vehicle-kilometer traveled. Even in hundreds of hours of raw CCTV footage, near-misses and crashes represent less than 0.01% of all frames, inducing extreme label sparsity.
4. **Target Variable Leakage / Fabricated Labels:**  
   Without ground-truth accident recordings coinciding with the video footage, training an XGBoost model on arbitrary tabular columns while claiming it scores the live video output constitutes invalid evaluation (violating project rule 7 in [`AGENTS.md`](file:///c:/Users/varsh/OneDrive/Desktop/smart-traffic-ai-project/AGENTS.md)).

---

## 4. MVP Fallback Strategy: Transparent Rule-Based Risk Indicator

In accordance with our project principles—prioritizing engineering integrity and explainability over black-box or falsified AI models—we employ a **heuristic, rule-based traffic hazard indicator** for our initial working prototype (MVP).

### 4.1 Rationale for the Heuristic Approach

- **Deterministic & Explainable:** Every risk point can be justified to college project evaluators without hidden model biases or unverifiable weights.
- **Hardware-Friendly:** Runs in near constant time $O(1)$ directly after YOLO frame extraction without requiring extra GPU memory or large tabular model inference.
- **Direct Metric Grounding:** Derives purely from real, observable computer vision outputs:
  - Real-time vehicle volume per frame ($V_t$)
  - Relative traffic density percentage ($D_t$)
  - Fleet mix composition ($M_t$, e.g., ratio of heavy trucks and buses to passenger cars)
  - Detection confidence stability ($C_t$)

### 4.2 Mathematical Formulation

The risk indicator score $R \in [0, 100]$ for frame $t$ is calculated as:

$$R_t = \min\left(100, \; w_d \cdot D_t + w_v \cdot \bar{V}_t + w_m \cdot M_t + w_p \cdot P_t\right)$$

Where:
- **$D_t \in [0, 100]$ (Density Factor):**  
  Calculated as the ratio of current vehicle count to the nominal saturation threshold of the camera viewport ($K_{\text{sat}}$, default $= 25$ vehicles):
  $$D_t = \min\left(100, \frac{V_t}{K_{\text{sat}}} \times 100\right)$$
- **$\bar{V}_t$ (Historical Frame Average Impact):**  
  Average detections observed across the recent sampling window, representing sustained volume rather than momentary sensor spikes.
- **$M_t$ (Heavy Vehicle / Fleet Mixing Penalty):**  
  Reflects maneuverability differentials between large vehicles (trucks, buses) and light vehicles:
  $$M_t = \frac{N_{\text{truck}} \times 2.0 + N_{\text{bus}} \times 1.5 + N_{\text{motorcycle}} \times 1.2}{V_t + \epsilon} \times 15$$
- **$P_t$ (Proximity / Congestion Factor):**  
  Penalty assessed when density crosses the critical congestion threshold ($D_t \ge 70\%$).
- **Weights ($w_d, w_v, w_m, w_p$):**  
  Default configuration calibrated for urban intersections:  
  $w_d = 0.55$, $w_v = 0.20$, $w_m = 0.15$, $w_p = 0.10$.

### 4.3 Risk Classification Categorization

| Score Range | Risk Level | Operator Notification | Visual Representation |
|---|---|---|---|
| **0 – 34** | **Low Risk** | Normal traffic flow; no intervention necessary. | Emerald Green (`#34d399`) |
| **35 – 66** | **Medium Risk** | Moderate accumulation or high commercial vehicle ratio; monitor signal timing. | Amber Warning (`#fbbf24`) |
| **67 – 84** | **High Risk** | Approaching saturation; tailbacks likely; elevated conflict potential. | Vivid Orange (`#fb923c`) |
| **85 – 100** | **Critical Risk** | Severe congestion/gridlock; high conflict density at intersection points. | Coral Red (`#f87171`) |

---

## 5. Path to Supervised Machine Learning (Post-MVP Roadmap)

If labeled training data matching our criteria becomes available in future work, the integration architecture will proceed as follows:

```
┌──────────────────┐
│ Video Frame      │
└─────────┬────────┘
          │ (YOLO v8)
          ▼
┌──────────────────┐     ┌───────────────────────┐
│ Extracted CV     │     │ External Context APIs │
│ Features (Count, │     │ (Live Weather, Time-  │
│ Class Dist., Vel)│     │ of-Day, Road Category)│
└─────────┬────────┘     └───────────┬───────────┘
          │                          │
          └────────────┬─────────────┘
                       ▼
          ┌──────────────────────────┐
          │ Trained XGBoost Classifier│ (Trained on pre-aligned
          └────────────┬─────────────┘  micro-simulation or
                       ▼                specialized telemetry)
          ┌──────────────────────────┐
          │ Calibrated Crash Prob.   │
          └──────────────────────────┘
```

Prerequisites before activating Phase 6 XGBoost model:
1. **Verification of Ground Truth:** The dataset must feature verified collision or near-miss event labels directly associated with continuous sensor or video trajectories.
2. **Benchmark Comparison:** The trained XGBoost model must be quantitatively benchmarked against the rule-based heuristic baseline (Precision, Recall, AUROC) to validate whether machine learning offers a measurable improvement over deterministic indicators.
3. **No Fabricated Mock Predictions:** In accordance with our code ethics, models will never output pseudo-random probabilities that masquerade as trained predictive inferences.

---

## 6. Summary for Evaluators

1. **Why not train an accident model right now?**  
   Public crash repositories (UK STATS19, US Accidents) and public camera footage (UA-DETRAC, stock traffic) cannot be joined on synchronized time-space coordinates without fabricating matches.
2. **How does our system solve this honestly?**  
   Our computer vision pipeline detects vehicles accurately with YOLO v8 and streams real metrics to an Express API and React dashboard. Risk scoring is performed using an explicit, explainable engineering heuristic grounded in density, vehicle composition, and congestion thresholds.
3. **Is the architecture ready for ML?**  
   Yes. The backend endpoints and frontend risk gauges are decoupled and modular. Replacing the rule-based calculation with an inference call to a trained XGBoost service requires zero UI rewrites.
