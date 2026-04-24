const { google } = require('googleapis');

/**
 * Get authenticated Google Drive client.
 * 
 * Uses OAuth2 with refresh token (for personal Google accounts).
 * Falls back to service account JSON if available.
 */
function getDriveClient(scope) {
    let auth;

    // Primary: OAuth2 with refresh token (works with personal Google accounts)
    if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });

        console.log('Drive auth: Using OAuth2 refresh token');
        auth = oauth2Client;
    }
    // Fallback: Service account JSON
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        let credentials;
        try {
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
            throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
        }

        auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.client_email,
                private_key: credentials.private_key,
            },
            scopes: [scope],
        });

        console.log('Drive auth: Using service account');
    } else {
        throw new Error('No Google Drive credentials configured. Set GOOGLE_REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON.');
    }

    return google.drive({ version: 'v3', auth });
}

module.exports = { getDriveClient };
