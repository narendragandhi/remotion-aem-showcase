import { describe, expect, it } from "vitest";
import defaultMock from "../mock/aem.json";
import {
  SPOTLIGHT_TEMPLATE,
  validateSpotlightForTemplate,
  VideoTemplateSchema
} from "./spotlightTemplate";

describe("spotlight template contract", () => {
  it("has a valid versioned template definition", () => {
    expect(VideoTemplateSchema.parse(SPOTLIGHT_TEMPLATE)).toEqual(SPOTLIGHT_TEMPLATE);
  });

  it("accepts valid content for a supported ratio", () => {
    expect(validateSpotlightForTemplate(defaultMock, "16x9")).toEqual([]);
  });

  it("reports missing assets before rendering", () => {
    const content = {
      ...defaultMock,
      scenes: [{ ...defaultMock.scenes[0], imageUrl: "" }]
    };

    expect(validateSpotlightForTemplate(content, "16x9")).toMatchObject([
      { severity: "error", field: "scenes.0.imageUrl" }
    ]);
  });

  it("reports text that may overflow the template", () => {
    const content = {
      ...defaultMock,
      scenes: [
        {
          ...defaultMock.scenes[0],
          title:
            "A title that is intentionally much longer than the supported safe area width for the template"
        }
      ]
    };

    expect(validateSpotlightForTemplate(content, "16x9")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning", field: "scenes.0.title" })
      ])
    );
  });
});
