const { google } = require('googleapis');

/**
 * Get authenticated Google Drive client.
 * 
 * Supports two modes:
 * 1. GOOGLE_SERVICE_ACCOUNT_JSON - entire JSON key file as one env var (recommended)
 * 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY - separate env vars
 */
function getDriveClient(scope) {
    let credentials;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        // Parse the entire JSON key file
        try {
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
            throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
        }
    } else {
        // Fallback to separate env vars
        let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
        
        // Handle JSON-wrapped strings
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            try { privateKey = JSON.parse(privateKey); } catch (e) { /* use as-is */ }
        }
        // Replace literal \n with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        credentials = {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey,
        };
    }

    console.log('Drive auth:', {
        hasEmail: !!credentials.client_email,
        emailPrefix: credentials.client_email ? credentials.client_email.split('@')[0] : 'MISSING',
        hasKey: !!credentials.private_key,
        keyLength: credentials.private_key ? credentials.private_key.length : 0,
        keyStart: credentials.private_key ? credentials.private_key.substring(0, 27) : 'MISSING',
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'MISSING',
    });

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
        scopes: [scope],
    });

    return google.drive({ version: 'v3', auth });
}

module.exports = { getDriveClient };
