# AEM Integration Guide

This guide provides step-by-step instructions for connecting the Remotion AEM Showcase to live AEM as a Cloud Service environments.

## Table of Contents

1. [AEM Sandbox Options](#aem-sandbox-options)
2. [Quick Start with AEM Reference Demo](#quick-start-with-aem-reference-demo)
3. [Production Configuration](#production-configuration)
4. [Authentication Setup](#authentication-setup)
5. [Troubleshooting](#troubleshooting)

---

## AEM Sandbox Options

### Option 1: AEM as a Cloud Service Trial (Recommended)

Adobe provides a trial environment for AEM as a Cloud Service:

1. Visit [Adobe Experience Cloud](https://experience.adobe.com/)
2. Navigate to **AEM as a Cloud Service** → **Environments**
3. Request a trial or sandbox environment
4. Note your environment URL (format: `https://author-p{programId}-e{envId}.adobeaemcloud.com`)

### Option 2: AEM Reference Demo Add-on

The **WKND Reference Demo** is the fastest path to a working AEM environment with sample content:

1. In Cloud Manager, add the **Reference Demos Add-on** to your program
2. Create a new environment with the add-on enabled
3. Access pre-populated content fragments at `/content/dam/wknd`

### Option 3: Local AEM SDK (Development)

For local development without cloud connectivity:

```bash
# Download AEM SDK from Software Distribution
# https://experience.adobe.com/#/downloads/content/software-distribution/en/aemcloud.html

# Start local author instance
java -jar aem-sdk-quickstart-*.jar

# Access at http://localhost:4502
# Default credentials: admin / admin
```

---

## Quick Start with AEM Reference Demo

### Pre-configured Endpoint Examples

Once you have an AEM environment, use these example configurations:

#### WKND Demo Site (Most Common)

```bash
# .env configuration for WKND demo content
AEM_BASE_URL=https://publish-p12345-e67890.adobeaemcloud.com
AEM_TOKEN=your-ims-bearer-token
AEM_GRAPHQL_ENDPOINT=/content/_cq_graphql/wknd-shared/endpoint.json
AEM_CONTENT_FRAGMENT_PATH=/content/dam/wknd-shared/en/adventures/bali-surf-camp
USE_MOCK_AEM=false
```

#### Custom Spotlight Content Fragment

```bash
# .env for custom spotlight content
AEM_BASE_URL=https://publish-p12345-e67890.adobeaemcloud.com
AEM_TOKEN=your-ims-bearer-token
AEM_GRAPHQL_ENDPOINT=/content/graphql/global/endpoint
AEM_CONTENT_FRAGMENT_PATH=/content/dam/spotlight/campaigns/summer-2024
AEM_PERSISTED_QUERY=/spotlight/campaign-video
USE_MOCK_AEM=false
AEM_PUBLISH_TIER=true
```

#### Local SDK Development

```bash
# .env for local AEM SDK
AEM_BASE_URL=http://localhost:4502
AEM_TOKEN=admin:admin
AEM_GRAPHQL_ENDPOINT=/content/graphql/global/endpoint
AEM_CONTENT_FRAGMENT_PATH=/content/dam/spotlight/demo
USE_MOCK_AEM=false
AEM_PUBLISH_TIER=false
```

---

## Production Configuration

### Step 1: Create Content Fragment Model

Import the provided Content Fragment Model into your AEM instance:

```bash
# Using the AEM Package Manager or Cloud Manager
# Upload: aem-config/spotlight-cfm.json

# Or create manually via AEM UI:
# Tools → Assets → Content Fragment Models → Create
```

**Model Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | Single-line text | Yes | Scene headline |
| subtitle | Multi-line text | No | Supporting description |
| cta | Single-line text | No | Call-to-action text |
| brandColor | Single-line text | No | CSS color (hex/rgb) |
| image | Content Reference | Yes | Hero image asset |
| durationSeconds | Number | No | Scene duration (default: 4) |
| animationStyle | Enumeration | No | cinematic/energetic/minimal |
| renditionType | Enumeration | No | web/optimized/original |
| effectType | Enumeration | No | none/glow/glitch |
| effectIntensity | Number | No | 0.0 - 1.0 |
| lottieUrl | Single-line text | No | Lottie animation URL |
| svgOverlayUrl | Single-line text | No | SVG overlay URL |

### Step 2: Create Persisted Query (Recommended for Production)

Persisted queries enable CDN caching and improved performance:

```graphql
# Save as: /conf/spotlight/settings/graphql/persistedQueries/campaign-video

query SpotlightCampaign($path: String!) {
  contentFragmentByPath(_path: $path) {
    item {
      _path
      title
      subtitle
      cta
      brandColor
      image {
        _publishUrl
        _path
      }
      durationSeconds
      animationStyle
      renditionType
      effectType
      effectIntensity
      lottieUrl
      svgOverlayUrl
      items {
        ... on SpotlightSceneModel {
          _path
          title
          subtitle
          cta
          brandColor
          image {
            _publishUrl
          }
          durationSeconds
          animationStyle
          effectType
          effectIntensity
        }
      }
    }
  }
}
```

### Step 3: Configure CORS

Apply the CORS configuration for your Remotion rendering environment:

```json
// aem-config/CORSPolicyImpl~spotlight.cfg.json
{
  "alloworigin": [
    "http://localhost:3000",
    "https://your-render-server.com"
  ],
  "alloworiginregexp": [
    "https://.*\\.vercel\\.app"
  ],
  "allowedpaths": [
    "/content/graphql/.*",
    "/content/dam/.*"
  ],
  "supportedheaders": [
    "Authorization",
    "Content-Type"
  ],
  "supportedmethods": [
    "GET",
    "POST",
    "OPTIONS"
  ],
  "maxage": 86400
}
```

---

## Authentication Setup

### IMS Service Account (Production)

For production deployments, use an Adobe IMS Service Account:

1. **Create Service Account** in Adobe Developer Console:
   - Go to [Adobe Developer Console](https://developer.adobe.com/console)
   - Create new project → Add API → Experience Manager as a Cloud Service
   - Generate JWT credentials

2. **Configure Environment**:
   ```bash
   # JWT Authentication (for scripts/aem-auth.js)
   AEM_IMS_ORG=your-org-id@AdobeOrg
   AEM_IMS_CLIENT_ID=your-client-id
   AEM_IMS_CLIENT_SECRET=your-client-secret
   AEM_IMS_TECHNICAL_ACCOUNT_ID=your-tech-account@techacct.adobe.com
   AEM_IMS_PRIVATE_KEY_PATH=./private.key
   ```

3. **Exchange JWT for Bearer Token**:
   ```bash
   node scripts/aem-auth.js
   # Outputs: Bearer token for AEM_TOKEN
   ```

### Local Development Token

For development, generate a token from AEM:

1. Access AEM Author: `https://author-pXXX-eYYY.adobeaemcloud.com`
2. Navigate to **Tools** → **Security** → **Users**
3. Select your user → **Create Token**
4. Copy token to `AEM_TOKEN` environment variable

---

## Troubleshooting

### Common Issues

#### "AEM GraphQL request failed: 401"
- **Cause**: Invalid or expired authentication token
- **Fix**: Regenerate token or check IMS service account configuration

#### "No content fragment found in AEM response"
- **Cause**: Incorrect content fragment path
- **Fix**: Verify path exists in AEM DAM: `/content/dam/your-path`

#### "CORS error when fetching assets"
- **Cause**: Missing CORS configuration
- **Fix**: Apply CORS OSGi config to AEM (see aem-config folder)

#### "GraphQL endpoint not found"
- **Cause**: GraphQL endpoint not enabled
- **Fix**: Enable GraphQL in AEM: Tools → GraphQL → Endpoints

### Debug Mode

Enable verbose logging:

```bash
# Set strict mode to fail fast on AEM errors
AEM_STRICT_MODE=true

# Run with debug output
DEBUG=aem:* npm run start
```

### Verify Connection

Test your AEM connection before rendering:

```bash
# Quick connection test
curl -H "Authorization: Bearer $AEM_TOKEN" \
  "$AEM_BASE_URL/content/graphql/global/endpoint?query={__schema{types{name}}}"
```

---

## Example Workflows

### CI/CD Pipeline with Live AEM

```yaml
# .github/workflows/render.yml
jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Render with Live AEM
        env:
          AEM_BASE_URL: ${{ secrets.AEM_BASE_URL }}
          AEM_TOKEN: ${{ secrets.AEM_TOKEN }}
          AEM_CONTENT_FRAGMENT_PATH: /content/dam/spotlight/production
          USE_MOCK_AEM: false
        run: npm run render:all

      - name: Upload to AEM Assets
        env:
          AEM_BASE_URL: ${{ secrets.AEM_AUTHOR_URL }}
          AEM_TOKEN: ${{ secrets.AEM_TOKEN }}
        run: node scripts/upload-to-aem.js out/spotlight_16x9.mp4 /content/dam/videos/spotlight.mp4
```

### Multi-Environment Setup

```bash
# Create environment-specific .env files
.env.development    # USE_MOCK_AEM=true
.env.staging        # Points to staging AEM
.env.production     # Points to production AEM

# Run with specific environment
cp .env.staging .env && npm run render:all
```
