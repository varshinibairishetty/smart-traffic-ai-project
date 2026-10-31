// backend/__tests__/localVideoProcessor.test.js
// Tests for Dynamic Local Video Selection & Real YOLOv8 Processing Engine

const fs = require('fs');
const path = require('path');
const {
  getSampleVideos,
  processSelectedVideo
} = require('../utils/localVideoProcessor');
const { getVideosDirectory } = require('../utils/cameraManager');

describe('Local Video Selection & Real YOLOv8 Processing Engine', () => {
  test('returns dynamic catalog matching exact video files present on disk', () => {
    const dir = getVideosDirectory();
    const diskFiles = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
    const videos = getSampleVideos();

    expect(videos.length).toBe(diskFiles.length);
    const filenames = videos.map(v => v.filename);
    diskFiles.forEach(df => {
      expect(filenames).toContain(df);
    });
  });

  test('processes selected video and calculates vehicle count and Rt risk using YOLOv8 output', () => {
    const result = processSelectedVideo('madhapur.mp4');
    expect(result.source).toBe('madhapur.mp4');
    expect(result.summary.peak_vehicles_in_frame).toBeGreaterThan(0);
    expect(result.summary.by_class).toHaveProperty('car');
    expect(result.summary.by_class).toHaveProperty('motorcycle');
    expect(result.summary.by_class).toHaveProperty('bus');
    expect(result.summary.by_class).toHaveProperty('truck');
    expect(result.risk).toHaveProperty('score');
    expect(result.risk.score).toBeGreaterThanOrEqual(0);
    expect(result.risk.score).toBeLessThanOrEqual(100);
    expect(result.density).toHaveProperty('density_pct');
    expect(result.density).toHaveProperty('congestion_status');
    expect(result.frames.length).toBeGreaterThan(0);
  });

  test('reflects real video-driven density variation based on actual video contents', () => {
    const madhapur = processSelectedVideo('madhapur.mp4');
    const gachibowli = processSelectedVideo('gachibowli.mp4');

    expect(madhapur.summary.peak_vehicles_in_frame).toBeGreaterThan(gachibowli.summary.peak_vehicles_in_frame);
    expect(madhapur.density.density_pct).toBeGreaterThan(gachibowli.density.density_pct);
    expect(madhapur.risk.score).toBeGreaterThan(gachibowli.risk.score);
  });
});
