const { google } = require('googleapis');

/**
 * Get authenticated Google Drive client using service account credentials
 */
function getDriveClient() {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    
    // Handle different formats of private key from env vars
    // Could be: literal \n strings, real newlines, or JSON-escaped
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = JSON.parse(privateKey);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    console.log('Auth config:', {
        hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasKey: !!privateKey,
        keyLength: privateKey.length,
        hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    });
    
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    return google.drive({ version: 'v3', auth });
}

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
        const drive = getDriveClient();
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
