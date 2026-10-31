# ai-service/tracker.py
#
# Multi-Object Vehicle Tracking (MOT) & Line-Crossing Counting Engine.
#
# Plain-English walkthrough:
#   1. Raw YOLOv8 detections provide bounding boxes for a single isolated frame.
#   2. Without tracking, a vehicle present across 10 frames would be counted 10 times.
#   3. This module implements an IoU (Intersection over Union) + Centroid association
#      tracker (SORT baseline) to associate detections between consecutive frames.
#   4. Each persistent vehicle is assigned a stable integer `track_id` (1, 2, 3...).
#   5. A virtual "tripwire" counting line monitors vehicle centroids crossing a defined
#      boundary (e.g., intersection entry line) to calculate true throughput flow (Q)
#      without repeated counts.

import math
from typing import Dict, List, Optional, Tuple


def compute_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    """
    Computes Intersection over Union (IoU) between two bounding boxes: (x1, y1, x2, y2).
    Returns a score between 0.0 (no overlap) and 1.0 (identical boxes).
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interWidth = max(0, xB - xA)
    interHeight = max(0, yB - yA)
    interArea = interWidth * interHeight

    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])

    unionArea = float(boxAArea + boxBArea - interArea)
    if unionArea <= 0:
        return 0.0

    return interArea / unionArea


class VehicleTrack:
    """
    Represents an individual vehicle tracked across multiple consecutive video frames.
    """
    def __init__(self, track_id: int, bbox: Tuple[int, int, int, int], vehicle_class: str, confidence: float):
        self.track_id: int = track_id
        self.bbox: Tuple[int, int, int, int] = bbox
        self.vehicle_class: str = vehicle_class
        self.confidence: float = confidence
        self.history: List[Tuple[int, int]] = []  # trajectory of centroids (x, y)
        self.missed_frames: int = 0
        self.hits: int = 1
        self.crossed_line: bool = False
        self.direction: str = "stationary"  # "inbound" (moving down) or "outbound" (moving up)

        # Record initial centroid
        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        self.centroid: Tuple[int, int] = (cx, cy)
        self.history.append((cx, cy))

    def update(self, bbox: Tuple[int, int, int, int], vehicle_class: str, confidence: float):
        """Update track state with a newly associated detection."""
        self.bbox = bbox
        self.vehicle_class = vehicle_class
        self.confidence = confidence
        self.hits += 1
        self.missed_frames = 0

        cx = int((bbox[0] + bbox[2]) / 2)
        cy = int((bbox[1] + bbox[3]) / 2)
        prev_cx, prev_cy = self.centroid
        self.centroid = (cx, cy)
        self.history.append((cx, cy))

        # Estimate direction of travel along vertical axis
        if cy - prev_cy > 3:
            self.direction = "inbound"
        elif prev_cy - cy > 3:
            self.direction = "outbound"

    def mark_missed(self):
        """Increment missed frame counter when vehicle is not detected in current frame."""
        self.missed_frames += 1


class VehicleTracker:
    """
    Multi-Object Vehicle Tracker with virtual tripwire line-crossing flow counting.
    """
    def __init__(
        self,
        iou_threshold: float = 0.25,
        max_missed_frames: int = 4,
        tripwire_y_ratio: float = 0.55,
    ):
        """
        Args:
            iou_threshold: Minimum IoU required to associate a detection with an existing track.
            max_missed_frames: Maximum frames to retain a track without new detections before terminating it.
            tripwire_y_ratio: Normalized vertical coordinate (0.0 - 1.0) of the virtual counting tripwire.
        """
        self.iou_threshold = iou_threshold
        self.max_missed_frames = max_missed_frames
        self.tripwire_y_ratio = tripwire_y_ratio

        self.next_track_id: int = 1
        self.tracks: Dict[int, VehicleTrack] = {}

        # Cumulative telemetry metrics
        self.total_unique_vehicles: int = 0
        self.line_crossing_inbound: int = 0
        self.line_crossing_outbound: int = 0
        self.total_line_crossings: int = 0

    def update(
        self,
        detections: List[dict],
        frame_height: int = 720,
    ) -> List[dict]:
        """
        Process a list of per-frame detections, update tracking states, and evaluate line crossings.

        Args:
            detections: List of dicts, each with keys 'bbox' [x1, y1, x2, y2], 'vehicle_class', 'confidence'.
            frame_height: Height of video frame in pixels for tripwire boundary calculation.

        Returns:
            List of updated detection dicts with 'track_id', 'centroid', 'direction', and 'is_counted'.
        """
        tripwire_y = int(frame_height * self.tripwire_y_ratio)

        # Match existing tracks with new detections using Greedy IoU matching
        detection_boxes = [
            (d["bbox"]["x1"], d["bbox"]["y1"], d["bbox"]["x2"], d["bbox"]["y2"])
            for d in detections
        ]

        assigned_tracks = set()
        assigned_detections = set()
        matched_pairs = []

        # Find best IoU matches
        for d_idx, d_box in enumerate(detection_boxes):
            best_iou = self.iou_threshold
            best_track_id = None

            for t_id, track in self.tracks.items():
                if t_id in assigned_tracks:
                    continue
                iou = compute_iou(d_box, track.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_track_id = t_id

            if best_track_id is not None:
                assigned_tracks.add(best_track_id)
                assigned_detections.add(d_idx)
                matched_pairs.append((best_track_id, d_idx))

        # 1. Update matched tracks
        for t_id, d_idx in matched_pairs:
            det = detections[d_idx]
            box = detection_boxes[d_idx]
            track = self.tracks[t_id]
            prev_y = track.centroid[1]
            track.update(box, det["vehicle_class"], det["confidence"])
            curr_y = track.centroid[1]

            # Evaluate Tripwire Line Crossing
            if not track.crossed_line:
                if (prev_y < tripwire_y <= curr_y):
                    track.crossed_line = True
                    self.line_crossing_inbound += 1
                    self.total_line_crossings += 1
                elif (prev_y > tripwire_y >= curr_y):
                    track.crossed_line = True
                    self.line_crossing_outbound += 1
                    self.total_line_crossings += 1

        # 2. Handle unmatched existing tracks
        unmatched_track_ids = [t_id for t_id in self.tracks.keys() if t_id not in assigned_tracks]
        for t_id in unmatched_track_ids:
            self.tracks[t_id].mark_missed()

        # Remove dead tracks that exceeded max_missed_frames
        dead_track_ids = [
            t_id for t_id, track in self.tracks.items()
            if track.missed_frames > self.max_missed_frames
        ]
        for t_id in dead_track_ids:
            del self.tracks[t_id]

        # 3. Create new tracks for unmatched detections
        for d_idx, det in enumerate(detections):
            if d_idx not in assigned_detections:
                box = detection_boxes[d_idx]
                new_track = VehicleTrack(
                    track_id=self.next_track_id,
                    bbox=box,
                    vehicle_class=det["vehicle_class"],
                    confidence=det["confidence"],
                )
                self.tracks[self.next_track_id] = new_track
                self.next_track_id += 1
                self.total_unique_vehicles += 1

        # 4. Attach tracking metadata to output detections
        tracked_results = []
        for d_idx, det in enumerate(detections):
            # Find matching track
            box = detection_boxes[d_idx]
            matched_track = None
            for track in self.tracks.values():
                if track.bbox == box:
                    matched_track = track
                    break

            t_id = matched_track.track_id if matched_track else 0
            direction = matched_track.direction if matched_track else "stationary"
            crossed = matched_track.crossed_line if matched_track else False
            centroid = matched_track.centroid if matched_track else (0, 0)

            det_copy = dict(det)
            det_copy["track_id"] = t_id
            det_copy["direction"] = direction
            det_copy["centroid"] = {"x": centroid[0], "y": centroid[1]}
            det_copy["crossed_tripwire"] = crossed
            tracked_results.append(det_copy)

        return tracked_results

    def get_summary(self) -> dict:
        """Return cumulative tracking and flow analytics."""
        return {
            "active_tracks_count": len(self.tracks),
            "total_unique_vehicles": self.total_unique_vehicles,
            "line_crossing_inbound": self.line_crossing_inbound,
            "line_crossing_outbound": self.line_crossing_outbound,
            "total_line_crossings": self.total_line_crossings,
            "tripwire_y_ratio": self.tripwire_y_ratio,
        }
