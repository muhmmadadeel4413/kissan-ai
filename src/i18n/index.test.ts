import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  translate,
  translations,
} from "./index";

/**
 * Unit tests for the i18n orchestrator (src/i18n/index.ts).
 *
 * Verifies:
 *  - All feature modules compose into the final `en` and `ur` dictionaries.
 *  - translate() resolves keys, falls back to English, then to the key itself.
 *  - Variable interpolation via `vars` works as documented.
 */

describe("i18n module exports", () => {
  it("exposes en and ur dictionaries with the same keys (minus known omissions)", () => {
    const enKeys = Object.keys(translations.en);
    const urKeys = Object.keys(translations.ur);
    // Every Urdu key must exist in English (English is the source of truth).
    for (const key of urKeys) {
      expect(enKeys).toContain(key);
    }
    // English must have a representative key from each feature module.
    expect(enKeys).toContain("brand.name"); // landing
    expect(enKeys).toContain("app.nav.dashboard"); // app
    expect(enKeys).toContain("auth.email"); // auth
  });

  it("defaults to English", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("offers English and Urdu as language options", () => {
    const values = LANGUAGE_OPTIONS.map((o) => o.value).sort();
    expect(values).toEqual(["en", "ur"]);
  });
});

describe("translate()", () => {
  it("returns the English value for a known key when lang=en", () => {
    expect(translate("en", "brand.name")).toBe("Kissan AI");
  });

  it("returns the Urdu value for a known key when lang=ur", () => {
    expect(translate("ur", "brand.name")).toBe("کسان اے آئی");
  });

  it("falls back to English when a key is missing in Urdu", () => {
    // Force a missing key in ur to exercise the fallback.
    const key = "brand.name";
    const backup = translations.ur[key];
    delete translations.ur[key];
    try {
      expect(translate("ur", key)).toBe("Kissan AI");
    } finally {
      if (backup !== undefined) translations.ur[key] = backup;
    }
  });

  it("falls back to the key itself when no language has the key", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("interpolates {var} placeholders", () => {
    // Inject a key with a known template.
    const backupEn = translations.en["test.hello"];
    const backupUr = translations.ur["test.hello"];
    translations.en["test.hello"] = "Hello, {name}! You have {count} tasks.";
    translations.ur["test.hello"] = "سلام {name}! آپ کے {count} کام ہیں۔";
    try {
      expect(translate("en", "test.hello", { name: "Adeel", count: 3 })).toBe(
        "Hello, Adeel! You have 3 tasks."
      );
      expect(translate("ur", "test.hello", { name: "Adeel", count: 3 })).toBe(
        "سلام Adeel! آپ کے 3 کام ہیں۔"
      );
    } finally {
      if (backupEn === undefined) delete translations.en["test.hello"];
      else translations.en["test.hello"] = backupEn;
      if (backupUr === undefined) delete translations.ur["test.hello"];
      else translations.ur["test.hello"] = backupUr;
    }
  });

  it("returns a key from every feature module in the composed dictionary", () => {
    const keys = Object.keys(translations.en);
    // landing
    expect(keys.some((k) => k.startsWith("hero."))).toBe(true);
    // app
    expect(keys.some((k) => k.startsWith("common."))).toBe(true);
    // farm
    expect(keys.some((k) => k.startsWith("farmSetup.") || k.startsWith("farm."))).toBe(true);
    // features
    expect(keys.some((k) => k.startsWith("cropRec.") || k.startsWith("irrigation.") || k.startsWith("recommend."))).toBe(true);
    // auth
    expect(keys.some((k) => k.startsWith("auth."))).toBe(true);
  });
});
