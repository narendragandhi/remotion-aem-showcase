/**
 * Principal-Grade Production Deployment: AEM Cloud Service Direct Binary Upload
 * 
 * Handles the 3-step handshake required by AEM CS for large assets:
 * 1. Initiate (GET upload URLs)
 * 2. Upload (PUT chunks directly to blob storage)
 * 3. Complete (POST to AEM to finalize metadata and processing)
 * 
 * Usage:
 *   export AEM_BASE_URL=https://author-p123-e456.adobeaemcloud.com
 *   export AEM_TOKEN=your_ims_token
 *   node scripts/upload-to-aem.js out/spotlight_final.mp4 /content/dam/spotlight/videos/hero.mp4
 */

import fs from 'fs';
import path from 'path';
// fetch is available globally in Node 18+ (project requires node >=18.0.0)

const filePath = process.argv[2];
const aemDestPath = process.argv[3];
const baseUrl = process.env.AEM_BASE_URL;
const token = process.env.AEM_TOKEN;

if (!filePath || !aemDestPath || !baseUrl || !token) {
  console.error('Missing required arguments or env vars (AEM_BASE_URL, AEM_TOKEN).');
  process.exit(1);
}

async function uploadToAemCS() {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  
  console.log(`🚀 Starting Principal-Grade Upload for ${fileName} (${(fileSize/1024/1024).toFixed(2)} MB)`);

  try {
    // STEP 1: Initiate Upload
    const initiateUrl = `${baseUrl}/api/assets${path.dirname(aemDestPath)}.initiateUpload.json`;
    console.log(`[1/3] Initiating upload at ${initiateUrl}...`);
    
    const authHeader = (token.startsWith('Basic ') || token.startsWith('Bearer ')) ? token : `Bearer ${token}`;

    const initRes = await fetch(initiateUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'fileName': fileName,
        'fileSize': fileSize.toString()
      })
    });

    if (!initRes.ok) throw new Error(`Initiate failed: ${initRes.status} ${await initRes.text()}`);
    
    const initData = await initRes.json();
    const { files } = initData;
    const uploadFile = files?.[0];
    if (!uploadFile?.uploadUrls?.length) {
      throw new Error('Initiate response did not contain upload URLs');
    }
    const { uploadToken, uploadUrls, mimeType } = uploadFile;

    // STEP 2: Upload Binary to Blob Storage
    console.log(`[2/3] Uploading binary to ${uploadUrls.length} part(s)...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const partSize = Math.ceil(fileBuffer.length / uploadUrls.length);

    for (let index = 0; index < uploadUrls.length; index += 1) {
      const start = index * partSize;
      const end = Math.min(start + partSize, fileBuffer.length);
      const uploadRes = await fetch(uploadUrls[index], {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'Content-Length': String(end - start),
        },
        body: fileBuffer.subarray(start, end),
      });

      if (!uploadRes.ok) {
        throw new Error(`Blob upload failed for part ${index + 1}: ${uploadRes.status}`);
      }
    }

    // STEP 3: Complete Upload
    console.log(`[3/3] Finalizing upload in AEM DAM...`);
    const completeUrl = `${baseUrl}/api/assets${path.dirname(aemDestPath)}.completeUpload.json`;
    
    const authHeader = (token.startsWith('Basic ') || token.startsWith('Bearer ')) ? token : `Bearer ${token}`;

    const completeRes = await fetch(completeUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'fileName': fileName,
        'uploadToken': uploadToken,
        'mimeType': mimeType
      })
    });

    if (completeRes.ok) {
      console.log(`✅ MISSION SUCCESS: Asset finalized at ${aemDestPath}`);
    } else {
      throw new Error(`Complete failed: ${await completeRes.text()}`);
    }

  } catch (error) {
    console.error('❌ Principal-Grade Upload FAILED:', error.message);
    process.exit(1);
  }
}

uploadToAemCS();
