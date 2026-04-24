const { google } = require('googleapis');

/**
 * OAuth2 callback - exchanges auth code for tokens.
 * Displays the refresh token so you can save it as an env var.
 * This function is used ONCE during setup, then can be removed.
 */
exports.handler = async (event) => {
    const code = event.queryStringParameters?.code;
    const error = event.queryStringParameters?.error;

    if (error) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html' },
            body: `<h1>Authorization failed</h1><p>Error: ${error}</p>`,
        };
    }

    if (!code) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>No authorization code received</h1>',
        };
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `https://fotosvatba.netlify.app/.netlify/functions/oauth-callback`
        );

        const { tokens } = await oauth2Client.getToken(code);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
<!DOCTYPE html>
<html>
<head><title>OAuth Setup Complete</title>
<style>
    body { font-family: sans-serif; max-width: 600px; margin: 50px auto; background: #1a1a2e; color: #eee; padding: 20px; }
    h1 { color: #c9a96e; }
    .token { background: #2a2a4a; padding: 15px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0; }
    .step { background: #2a2a4a; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .warning { color: #ff6b6b; font-weight: bold; }
</style>
</head>
<body>
    <h1>✅ Autorizace úspěšná!</h1>
    
    <h2>Refresh Token:</h2>
    <div class="token">${tokens.refresh_token || 'CHYBA: Žádný refresh token. Zkus znovu s prompt=consent.'}</div>
    
    <h2>Co teď:</h2>
    <div class="step">
        <p>1. Zkopíruj <strong>Refresh Token</strong> výše</p>
        <p>2. Jdi do Netlify → Project configuration → Environment variables</p>
        <p>3. Přidej proměnnou: <strong>GOOGLE_REFRESH_TOKEN</strong> = (vlož token)</p>
        <p>4. Udělej re-deploy</p>
    </div>
    
    <p class="warning">⚠️ Tuto stránku zavři a nikomu neukazuj token!</p>
</body>
</html>`,
        };
    } catch (err) {
        console.error('OAuth callback error:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html' },
            body: `<h1>Error</h1><p>${err.message}</p>`,
        };
    }
};
