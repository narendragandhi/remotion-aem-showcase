# AEM Remotion Showcase: Use Case Examples

This repository demonstrates four enterprise-grade use cases for automated, data-driven video production. Each example uses specialized mock data to simulate real-world AEM Content Fragment delivery.

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
