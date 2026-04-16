/**
 * AEM Principal-Grade Auth: Exchange JWT for IMS Access Token
 * 
 * Automates the service account handshake. 
 * Requires a technical account configuration from Adobe Admin Console.
 * 
 * Usage:
 *   export IMS_ORG_ID=...
 *   export IMS_CLIENT_ID=...
 *   export IMS_SERVICE_ACCOUNT=...
 *   export PRIVATE_KEY_PATH=...
 *   node scripts/aem-auth.js
 */

import fs from 'fs';
import jwt from 'jsonwebtoken';
// fetch is available globally in Node 18+ (project requires node >=18.0.0)

const {
  IMS_ORG_ID,
  IMS_CLIENT_ID,
  IMS_SERVICE_ACCOUNT,
  PRIVATE_KEY_PATH,
  IMS_ENDPOINT = 'https://ims-na1.adobelogin.com/ims/exchange/jwt'
} = process.env;

if (!IMS_ORG_ID || !IMS_CLIENT_ID || !IMS_SERVICE_ACCOUNT || !PRIVATE_KEY_PATH) {
  console.error('Missing IMS configuration environment variables.');
  process.exit(1);
}

async function getAccessToken() {
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH);
  
  const payload = {
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iss: IMS_ORG_ID,
    sub: IMS_SERVICE_ACCOUNT,
    aud: `https://ims-na1.adobelogin.com/ims/c/${IMS_CLIENT_ID}`,
    [`https://ims-na1.adobelogin.com/s/ent_aem_cloud_sdk`]: true
  };

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  console.log('🚀 Exchanging JWT for Access Token...');

  const res = await fetch(IMS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: IMS_CLIENT_ID,
      client_secret: process.env.IMS_CLIENT_SECRET || '',
      jwt_token: token
    })
  });

  if (res.ok) {
    const data = await res.json();
    console.log('✅ Token received. Use this for AEM_TOKEN:');
    console.log(data.access_token);
  } else {
    console.error('❌ Auth failed:', await res.text());
    process.exit(1);
  }
}

getAccessToken();
