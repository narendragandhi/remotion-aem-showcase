# Tutorial: My First AEM-Driven Video

Welcome to the AEM Remotion Showcase. This guide will take you from a fresh clone to a production-ready video pipeline in 10 minutes.

---

## Part 1: The Quick Win (3 Minutes)

First, let's get the engine running on your machine.

1.  **Install:**
    ```bash
    npm install
    ```
2.  **Start Preview:**
    ```bash
    npm start
    ```
    *Open [http://localhost:3000](http://localhost:3000) in your browser.*

**What you're seeing:** A multi-scene video sequence being generated in real-time from a mock AEM Content Fragment. Toggle between the **AEMSpotlight-16x9** and **AEMSpotlight-9x16** compositions in the sidebar to see the **Responsive Engine** automatically switch from a horizontal "Desktop" layout to a vertical "Mobile" layout.

---

## Part 2: The Author Experience (3 Minutes)

Now, let's act like a Content Author in AEM. We don't want to touch code; we just want to change the message.

1.  Open `src/mock/aem.json`.
2.  Find the first scene and change the `title` to `"Hello World!"`.
3.  Change the `brandColor` to `#FF0000` (Red).
4.  Save the file.

**Observe:** The Remotion preview updates instantly. You just "edited" a video without opening a single video editing tool. This is the **Value Prop** in action.

---

## Part 3: The Tech Moat (2 Minutes)

Let's look at the **WASM vs. JS fallback** logic.

1.  Open `src/wasm/spotlightEffects.ts`.
2.  Note the `calculatePulse` function. It tries to use the `.wasm` binary for the CTA glow effect.
3.  If you intentionally break the WASM loading (e.g., rename the `.wasm` file in `public/`), the console will log a warning, but the video **will not crash**.
4.  The `jsFallback` implementation takes over seamlessly. This is why this architecture is **Production Ready**.

---

## Part 4: The Production Leap (2 Minutes)

Ready to move away from mock data?

1.  **In AEM:** Import the Content Fragment Model from `aem-config/spotlight-cfm.json`.
2.  **In AEM:** Configure the CORS policy using `aem-config/CORSPolicyImpl~spotlight.cfg.json`.
3.  **In this Project:** Update `.env`:
    ```bash
    USE_MOCK_AEM=false
    AEM_BASE_URL=https://your-aem-publish-url.com
    AEM_TOKEN=your-bearer-token
    ```
4.  **Render:**
    ```bash
    npm run render
    ```

**The Result:** You now have a high-quality MP4 rendered from live AEM data, ready to be uploaded back to the DAM using `npm run deploy:aem`.

---

## Next Steps
- Explore `docs/bmad-spec.md` to understand the methodology.
- Check `.github/workflows/ci.yml` to see how to automate this in your CI/CD pipeline.

**Happy Rendering!** 🚀
