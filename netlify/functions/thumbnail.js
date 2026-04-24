const { google } = require('googleapis');
const { getDriveClient } = require('./driveAuth');

/**
 * Proxy endpoint for Google Drive thumbnails and full images
 * 
 * Query params:
 * - id: Google Drive file ID
 * - full: if "1", return full-size image instead of thumbnail
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
    };

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    const fileId = event.queryStringParameters?.id;
    const full = event.queryStringParameters?.full === '1';

    if (!fileId) {
        return {
            statusCode: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'File ID required' }),
        };
    }

    try {
        const drive = getDriveClient('https://www.googleapis.com/auth/drive.readonly');

        // Get the file content from Google Drive
        const response = await drive.files.get(
            {
                fileId: fileId,
                alt: 'media',
            },
            {
                responseType: 'arraybuffer',
            }
        );

        const buffer = Buffer.from(response.data);

        // For thumbnails, we return a smaller version
        // Since we can't easily resize on the server without sharp/jimp,
        // we return the full image and let the browser handle sizing via CSS
        // The images are already compressed on upload (max 2MB)

        // Detect content type
        const fileInfo = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType',
        });

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': fileInfo.data.mimeType || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Thumbnail error:', error);

        // Return a placeholder on error
        return {
            statusCode: error.code === 404 ? 404 : 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to load image',
                message: error.message,
            }),
        };
    }
};
