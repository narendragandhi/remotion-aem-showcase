/**
 * Custom error classes for the AEM Spotlight application.
 * These provide typed errors for better error handling and debugging.
 */

/**
 * Base error class for all AEM Spotlight errors.
 */
export class SpotlightError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = "SpotlightError";
    Object.setPrototypeOf(this, SpotlightError.prototype);
  }
}

/**
 * Error thrown when AEM GraphQL fetch fails.
 */
export class AemFetchError extends SpotlightError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string
  ) {
    super(
      message,
      "AEM_FETCH_ERROR",
      true // Recoverable - can fallback to mock data
    );
    this.name = "AemFetchError";
    Object.setPrototypeOf(this, AemFetchError.prototype);
  }
}

/**
 * Error thrown when AEM GraphQL response validation fails.
 */
export class AemValidationError extends SpotlightError {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(
      message,
      "AEM_VALIDATION_ERROR",
      true // Recoverable - can fallback to defaults
    );
    this.name = "AemValidationError";
    Object.setPrototypeOf(this, AemValidationError.prototype);
  }
}

/**
 * Error thrown when WASM module fails to load.
 */
export class WasmLoadError extends SpotlightError {
  constructor(message: string) {
    super(
      message,
      "WASM_LOAD_ERROR",
      true // Recoverable - JS fallback available
    );
    this.name = "WasmLoadError";
    Object.setPrototypeOf(this, WasmLoadError.prototype);
  }
}

/**
 * Error thrown when asset loading fails (images, Lottie, SVG).
 */
export class AssetLoadError extends SpotlightError {
  constructor(
    message: string,
    public readonly assetUrl: string,
    public readonly assetType: "image" | "lottie" | "svg"
  ) {
    super(
      message,
      "ASSET_LOAD_ERROR",
      true // Recoverable - can show placeholder
    );
    this.name = "AssetLoadError";
    Object.setPrototypeOf(this, AssetLoadError.prototype);
  }
}

/**
 * Error thrown when required configuration is missing.
 */
export class ConfigurationError extends SpotlightError {
  constructor(
    message: string,
    public readonly missingKeys: string[]
  ) {
    super(
      message,
      "CONFIGURATION_ERROR",
      false // Not recoverable without config
    );
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Type guard for SpotlightError
 */
export const isSpotlightError = (error: unknown): error is SpotlightError => {
  return error instanceof SpotlightError;
};

/**
 * Extracts a user-friendly message from any error.
 */
export const getErrorMessage = (error: unknown): string => {
  if (isSpotlightError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
