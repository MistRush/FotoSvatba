const { google } = require('googleapis');

/**
 * Starts the OAuth2 authorization flow.
 * Visit this URL once to authorize and get a refresh token.
 */
exports.handler = async (event) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `https://fotosvatba.netlify.app/.netlify/functions/oauth-callback`
    );

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive'],
    });

    return {
        statusCode: 302,
        headers: { Location: url },
        body: '',
    };
};
