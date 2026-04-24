const { google } = require('googleapis');
const { getDriveClient } = require('./driveAuth');

/**
 * Upload photo to Google Drive
 * 
 * Accepts JSON body with:
 * - image: base64 encoded image data
 * - fileName: original file name
 * - mimeType: image MIME type
 * - guestName: name of the guest uploading
 */
exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { image, fileName, mimeType, guestName } = body;

        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No image data provided' }),
            };
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(image, 'base64');

        // Check size (safety net – should already be compressed on client)
        const sizeMB = buffer.length / (1024 * 1024);
        if (sizeMB > 5) {
            return {
                statusCode: 413,
                headers,
                body: JSON.stringify({ error: 'File too large. Max 5 MB.' }),
            };
        }

        // Build filename: guestName_timestamp.ext
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = (guestName || 'anonym')
            .replace(/[^a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s_-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
        const ext = getExtension(mimeType, fileName);
        const driveFileName = `${safeName}_${timestamp}.${ext}`;

        // Upload to Google Drive
        // Use full drive scope - service accounts need it for shared folders
        const drive = getDriveClient('https://www.googleapis.com/auth/drive');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        const { Readable } = require('stream');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        const response = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId],
                description: `Nahráno: ${guestName || 'Anonym'} | ${new Date().toLocaleString('cs-CZ')}`,
            },
            media: {
                mimeType: mimeType || 'image/jpeg',
                body: stream,
            },
            fields: 'id, name',
            supportsAllDrives: true,
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                fileId: response.data.id,
                fileName: response.data.name,
            }),
        };
    } catch (error) {
        console.error('Upload error:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Upload failed',
                message: error.message,
            }),
        };
    }
};

function getExtension(mimeType, fileName) {
    const mimeMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
    };

    if (mimeMap[mimeType]) return mimeMap[mimeType];

    // Try from filename
    if (fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) return ext;
    }

    return 'jpg';
}
