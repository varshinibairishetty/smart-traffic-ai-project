// backend/utils/multipartParser.js
//
// Zero-dependency streaming multipart/form-data parser for Node.js Express.
// Extracts uploaded video files without requiring external binary packages (e.g., multer).

const fs = require('fs');
const path = require('path');

/**
 * Parses a single file from multipart/form-data request stream.
 * @param {import('express').Request} req
 * @param {string} destinationDir
 * @returns {Promise<{ filename: string, filepath: string, size: number, mimetype: string }>}
 */
function parseVideoUpload(req, destinationDir) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return reject(new Error('Invalid content type. Expected multipart/form-data.'));
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return reject(new Error('Multipart boundary not found in request headers.'));
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', err => reject(err));

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const boundaryBuffer = Buffer.from(`--${boundary}`);

        // Find boundary positions
        let startIndex = buffer.indexOf(boundaryBuffer);
        if (startIndex === -1) {
          return reject(new Error('Could not find multipart boundary in payload.'));
        }

        // Header end is marked by \r\n\r\n (or \n\n)
        const headerEndPattern = Buffer.from('\r\n\r\n');
        const headerEnd = buffer.indexOf(headerEndPattern, startIndex);
        if (headerEnd === -1) {
          return reject(new Error('Invalid multipart body format.'));
        }

        const headerText = buffer.slice(startIndex, headerEnd).toString('utf8');
        const filenameMatch = headerText.match(/filename="([^"]+)"/i);
        const rawFilename = filenameMatch ? filenameMatch[1] : `upload_${Date.now()}.mp4`;

        // Sanitize filename and validate extension
        const cleanFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(cleanFilename).toLowerCase();
        const ALLOWED_EXTS = ['.mp4', '.avi', '.mov', '.mkv'];

        if (!ALLOWED_EXTS.includes(ext)) {
          return reject(new Error(`Unsupported video format '${ext}'. Allowed: ${ALLOWED_EXTS.join(', ')}`));
        }

        const mimetypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        const mimetype = mimetypeMatch ? mimetypeMatch[1].trim() : 'video/mp4';

        // File binary starts after \r\n\r\n
        const fileContentStart = headerEnd + 4;

        // End boundary is \r\n--boundary
        const endBoundaryPattern = Buffer.from(`\r\n--${boundary}`);
        let fileContentEnd = buffer.indexOf(endBoundaryPattern, fileContentStart);
        if (fileContentEnd === -1) {
          fileContentEnd = buffer.lastIndexOf(boundaryBuffer);
          if (fileContentEnd > 2 && buffer[fileContentEnd - 2] === 0x0d && buffer[fileContentEnd - 1] === 0x0a) {
            fileContentEnd -= 2;
          }
        }

        if (fileContentStart >= fileContentEnd) {
          return reject(new Error('Uploaded video file is empty.'));
        }

        const fileData = buffer.slice(fileContentStart, fileContentEnd);
        const uniquePrefix = Date.now();
        const savedFilename = `${uniquePrefix}_${cleanFilename}`;
        const targetPath = path.join(destinationDir, savedFilename);

        fs.writeFileSync(targetPath, fileData);

        // Parse any additional text form fields (e.g. location_id, recorded_at)
        const fields = {};
        const fieldMatches = buffer.toString('binary').split(`--${boundary}`);
        for (const part of fieldMatches) {
          if (!part || part.trim() === '--' || part.includes('filename="')) continue;
          const nameMatch = part.match(/name="([^"]+)"/);
          if (nameMatch) {
            const fieldName = nameMatch[1];
            const bodyIdx = part.indexOf('\r\n\r\n');
            if (bodyIdx !== -1) {
              const val = part.substring(bodyIdx + 4).replace(/\r\n$/, '').trim();
              fields[fieldName] = val;
            }
          }
        }

        resolve({
          filename: cleanFilename,
          savedAs: savedFilename,
          filepath: targetPath,
          size: fileData.length,
          mimetype,
          fields
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  parseVideoUpload
};
