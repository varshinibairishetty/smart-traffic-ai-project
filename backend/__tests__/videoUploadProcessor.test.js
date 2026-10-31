// backend/__tests__/videoUploadProcessor.test.js
// Unit tests for real video upload processing engine

const fs = require('fs');
const path = require('path');
const { processUploadedVideo } = require('../utils/videoUploadProcessor');

describe('Real Video Upload & Processing Engine', () => {
  const tmpUploadFile = path.resolve(__dirname, '../data/test_upload_video.mp4');

  beforeAll(() => {
    fs.writeFileSync(tmpUploadFile, Buffer.alloc(1024 * 1024 * 3)); // 3MB mock video file
  });

  afterAll(() => {
    if (fs.existsSync(tmpUploadFile)) {
      fs.unlinkSync(tmpUploadFile);
    }
  });

  test('processes an uploaded video file and returns structured YOLOv8 detection metrics', async () => {
    const mockYoloResponse = {
      frames: [
        {
          frame_index: 0,
          timestamp_sec: 0,
          vehicle_count: 5,
          by_class: { car: 4, motorcycle: 1, bus: 0, truck: 0 },
          vehicles: [
            { vehicle_class: 'car', confidence: 0.91, bbox: { x1: 10, y1: 20, x2: 100, y2: 80 } }
          ]
        }
      ],
      vehicle_count: 5,
      peak_vehicles_in_frame: 5,
      avg_vehicles_per_frame: 5,
      by_class: { car: 4, motorcycle: 1, bus: 0, truck: 0 }
    };

    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockYoloResponse)
      })
    );

    const fileInfo = {
      filename: 'test_cctv_feed.mp4',
      filepath: tmpUploadFile,
      size: 1024 * 1024 * 3,
      mimetype: 'video/mp4'
    };

    const result = await processUploadedVideo(fileInfo);

    expect(result.source).toBe('test_cctv_feed.mp4');
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

    global.fetch.mockRestore();
  });
});
