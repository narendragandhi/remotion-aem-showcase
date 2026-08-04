# AEM Remotion Showcase: Use Case Examples

This repository demonstrates a fictitious product brand, **Northstar Goods**, across
launch, commerce, loyalty, localization, and seasonal campaigns. Each example is
structured like an AEM Content Fragment delivery and uses the same governed motion
system, so contributors can compare how one brand scales across content scenarios.

Northstar Goods makes thoughtful everyday objects: lighting, carry goods, and small
ritual products. The examples are intentionally fictional and use stock image URLs
only as visual placeholders.

### Northstar brand system

- **Voice:** quiet confidence, useful detail, no hype.
- **Palette:** midnight navy, forest, mint signal, amber attention, violet craft.
- **Motion:** cinematic for product meaning, energetic for launches/offers, minimal
  for proof and conversion.
- **Content fields:** each scene exercises eyebrow, title, subtitle, CTA, metrics,
  brand/accent colors, image, duration, animation, and effect configuration.

---

## Northstar product examples

### 1. Luma One product launch
**Scenario:** A hero launch for Northstar’s adaptive desk light.
- **Mock data:** `src/mock/examples/northstar_luma_one_launch.json`
- **Exercises:** three-scene product narrative, feature metrics, launch CTA,
  cinematic-to-minimal motion progression.

### 2. Field Kit product story
**Scenario:** A durable weekend carry system positioned through use and detail.
- **Mock data:** `src/mock/examples/northstar_field_kit.json`
- **Exercises:** product bundle, outdoor imagery, warranty proof, mixed pacing.

### 3. Member year-in-review
**Scenario:** A personalized Northstar member recap that turns usage data into a
  warm retention moment.
- **Mock data:** `src/mock/examples/northstar_members_year.json`
- **Exercises:** personalized metrics, loyalty CTA, customer-specific content.

### 4. Localized France launch
**Scenario:** The Luma One launch localized for France while preserving the same
  template and brand motion system.
- **Mock data:** `src/mock/examples/northstar_fr_launch.json`
- **Exercises:** localized copy, accents, longer text, regional campaign path.

### 5. Seasonal retail offer
**Scenario:** A short commerce campaign for a time-bound summer collection offer.
- **Mock data:** `src/mock/examples/northstar_retail_offer.json`
- **Exercises:** urgency, limited drop messaging, conversion CTA, restrained glitch.

---

## Generic integration examples

---

### 1. Personalized "Year-in-Review" (Loyalty)
**The Scenario:** A travel agency generates a unique video for each customer summarizing their yearly travel stats.
- **Mock Data:** `src/mock/examples/loyalty_year_in_review.json`
- **Moat:** Scales from 1 to 1,000,000 unique videos with zero incremental editing cost.
- **Key Feature:** Cinematic transitions and personalized data injection (e.g., "5 Countries Visited").

### 2. Automated Product "Spotlights" (E-Commerce)
**The Scenario:** An online retailer automatically generates 16:9 and 9:16 videos for every new product in their DAM.
- **Mock Data:** `src/mock/examples/ecommerce_product_spotlight.json`
- **Moat:** "Content to Video" in seconds. When the product price or image changes in AEM, the video updates.
- **Key Feature:** Minimalist branding and high-fidelity image renditions.

### 3. Real-Time "Localized News" (Social)
**The Scenario:** A news organization publishes instant social media alerts for local events or financial updates.
- **Mock Data:** `src/mock/examples/social_localized_news.json`
- **Moat:** Outperforms manual video teams on speed-to-market.
- **Key Feature:** High-energy "Glitch" effects (WASM) for visual urgency.

### 4. Multi-Language Global Campaigns
**The Scenario:** A global brand launches a product across multiple regions, requiring localized text and localized background assets.
- **Mock Data:** `src/mock/examples/global_campaign_multilang.json`
- **Moat:** Centralized layout logic with localized Content Fragments. No need for 20 different After Effects projects.
- **Key Feature:** Supports regional fonts and localized CTAs (e.g., "Commander" instead of "Order").

---

## How to Preview Examples

To see these examples in the Remotion Preview, update the import in `src/index.tsx` or use the following temporary swap:

1.  Open `src/index.tsx`.
2.  Change the mock import:
    ```typescript
    // Replace: import mockSpotlight from "./mock/aem.json";
    // With one of these:
    import mockSpotlight from "./mock/examples/loyalty_year_in_review.json";
    // import mockSpotlight from "./mock/examples/ecommerce_product_spotlight.json";
    // import mockSpotlight from "./mock/examples/social_localized_news.json";
    // import mockSpotlight from "./mock/examples/global_campaign_multilang.json";
    ```
3.  Run `npm start`.
