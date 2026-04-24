const { google } = require('googleapis');
const { getDriveClient } = require('./driveAuth');

/**
 * List all photos in the Google Drive folder
 * Returns file IDs, names, and guest names (parsed from filename)
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
    };

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const drive = getDriveClient('https://www.googleapis.com/auth/drive.readonly');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        // List all image files in the folder
        let allFiles = [];
        let pageToken = null;

        do {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
                fields: 'nextPageToken, files(id, name, createdTime, mimeType)',
                orderBy: 'createdTime desc',
                pageSize: 100,
                pageToken: pageToken,
            });

            allFiles = allFiles.concat(response.data.files || []);
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        // Parse guest names from filenames (format: guestName_timestamp.ext)
        const files = allFiles.map(file => {
            const nameParts = file.name.split('_');
            // Remove the last part (timestamp.ext) to get guest name
            let guestName = '';
            if (nameParts.length > 1) {
                // Everything before the timestamp portion
                // Timestamp format: YYYY-MM-DDTHH-MM-SS-SSSZ.ext
                // Find the part that looks like a date
                const dateIndex = nameParts.findIndex(p => /^\d{4}-\d{2}-\d{2}/.test(p));
                if (dateIndex > 0) {
                    guestName = nameParts.slice(0, dateIndex).join(' ');
                } else {
                    guestName = nameParts[0];
                }
            }

            return {
                id: file.id,
                name: file.name,
                guestName: guestName || null,
                createdTime: file.createdTime,
                mimeType: file.mimeType,
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                files,
                total: files.length,
            }),
        };
    } catch (error) {
        console.error('Gallery error:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to load gallery',
                message: error.message,
            }),
        };
    }
};
