/**
 * Production Deployment Script: Upload rendered video to AEM Assets
 * 
 * Usage: 
 *   export AEM_BASE_URL=https://author-p123-e456.adobeaemcloud.com
 *   export AEM_TOKEN=your_ims_token
 *   node scripts/upload-to-aem.js out/spotlight_16x9.mp4 /content/dam/spotlight/videos/hero_16x9.mp4
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const filePath = process.argv[2];
const aemDestPath = process.argv[3];

const baseUrl = process.env.AEM_BASE_URL;
const token = process.env.AEM_TOKEN;

if (!filePath || !aemDestPath || !baseUrl || !token) {
  console.error('Missing required arguments or environment variables.');
  console.log('Usage: node upload-to-aem.js <localPath> <aemPath>');
  process.exit(1);
}

async function uploadToAem() {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  const fileStream = fs.createReadStream(filePath);

  console.log(`🚀 Uploading ${fileName} (${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB) to AEM...`);

  // 1. Initiate upload (binary upload API)
  // Note: For AEM Cloud Service, the recommended way is to use the 'Direct Binary Access' API
  // but for a simple showcase, we use the standard asset creation API.
  
  const endpoint = `${baseUrl}/api/assets${aemDestPath}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'video/mp4',
        'Content-Length': fileSizeInBytes
      },
      body: fileStream
    });

    if (response.ok) {
      console.log(`✅ Successfully uploaded to: ${endpoint}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${response.status} ${response.statusText}`);
      console.error(errorText);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Network error during upload:', error);
    process.exit(1);
  }
}

uploadToAem();
