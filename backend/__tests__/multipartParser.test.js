// backend/__tests__/multipartParser.test.js
// Unit tests for zero-dependency multipart video parser

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { parseVideoUpload } = require('../utils/multipartParser');

describe('Zero-Dependency Multipart Video Parser', () => {
  const tmpDir = path.resolve(__dirname, '../data/test_uploads');

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('parses a valid multipart video payload correctly', async () => {
    const boundary = '----WebKitFormBoundaryX9aZ8';
    const fakeVideoContent = Buffer.from('FAKE_MP4_HEADER_BINARY_DATA_TEST_12345');

    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="test_feed.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
      fakeVideoContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const req = new EventEmitter();
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`
    };

    const parsePromise = parseVideoUpload(req, tmpDir);

    // Emit data & end
    req.emit('data', bodyBuffer);
    req.emit('end');

    const result = await parsePromise;
    expect(result.filename).toBe('test_feed.mp4');
    expect(result.size).toBe(fakeVideoContent.length);
    expect(fs.existsSync(result.filepath)).toBe(true);

    const savedData = fs.readFileSync(result.filepath);
    expect(savedData.toString()).toBe('FAKE_MP4_HEADER_BINARY_DATA_TEST_12345');
  });

  test('rejects unsupported file formats', async () => {
    const boundary = '----WebKitFormBoundaryX9aZ8';
    const bodyBuffer = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="script.exe"\r\nContent-Type: application/x-msdownload\r\n\r\nEXEC` +
      `\r\n--${boundary}--\r\n`
    );

    const req = new EventEmitter();
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`
    };

    const parsePromise = parseVideoUpload(req, tmpDir);
    req.emit('data', bodyBuffer);
    req.emit('end');

    await expect(parsePromise).rejects.toThrow(/Unsupported video format/);
  });
});
