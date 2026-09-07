import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeSttLanguage, uploadToSarvam } from "./voice-stt";
import { LANG_CONFIG } from "./voice-languages";
import { supabase } from "./supabase";

describe("voice-stt & voice-languages", () => {
  describe("normalizeSttLanguage", () => {
    it("maps 'auto' to 'unknown' for Sarvam AI auto language detection", () => {
      expect(normalizeSttLanguage("auto")).toBe("unknown");
    });

    it("handles null, undefined, or empty values as 'unknown'", () => {
      expect(normalizeSttLanguage(null)).toBe("unknown");
      expect(normalizeSttLanguage(undefined)).toBe("unknown");
      expect(normalizeSttLanguage("")).toBe("unknown");
      expect(normalizeSttLanguage("   ")).toBe("unknown");
    });

    it("preserves 'unknown' as 'unknown'", () => {
      expect(normalizeSttLanguage("unknown")).toBe("unknown");
    });

    it("maps Urdu variants to 'ur-IN'", () => {
      expect(normalizeSttLanguage("ur-IN")).toBe("ur-IN");
      expect(normalizeSttLanguage("urdu")).toBe("ur-IN");
      expect(normalizeSttLanguage("ur")).toBe("ur-IN");
      expect(normalizeSttLanguage("ur-PK")).toBe("ur-IN");
      expect(normalizeSttLanguage("UR-PK")).toBe("ur-IN");
    });

    it("maps English variants to 'en-IN'", () => {
      expect(normalizeSttLanguage("en-IN")).toBe("en-IN");
      expect(normalizeSttLanguage("english")).toBe("en-IN");
      expect(normalizeSttLanguage("en")).toBe("en-IN");
      expect(normalizeSttLanguage("en-US")).toBe("en-IN");
      expect(normalizeSttLanguage("en-GB")).toBe("en-IN");
    });

    it("maps Punjabi variants to 'pa-IN'", () => {
      expect(normalizeSttLanguage("pa-IN")).toBe("pa-IN");
      expect(normalizeSttLanguage("punjabi")).toBe("pa-IN");
      expect(normalizeSttLanguage("pa")).toBe("pa-IN");
      expect(normalizeSttLanguage("pa-PK")).toBe("pa-IN");
    });

    it("passes through unknown valid BCP-47 codes", () => {
      expect(normalizeSttLanguage("hi-IN")).toBe("hi-IN");
      expect(normalizeSttLanguage("bn-IN")).toBe("bn-IN");
    });
  });

  describe("LANG_CONFIG", () => {
    it("configures 'auto' language with 'unknown' STT code for Sarvam compatibility", () => {
      expect(LANG_CONFIG.auto.stt).toBe("unknown");
      expect(LANG_CONFIG.auto.sttSupported).toBe(true);
      expect(LANG_CONFIG.auto.provider).toBe("sarvam");
    });

    it("configures regional languages with their correct BCP-47 codes", () => {
      expect(LANG_CONFIG.urdu.stt).toBe("ur-IN");
      expect(LANG_CONFIG.english.stt).toBe("en-IN");
      expect(LANG_CONFIG.punjabi.stt).toBe("pa-IN");
    });

    it("correctly identifies Saraiki STT as unsupported", () => {
      expect(LANG_CONFIG.saraiki.sttSupported).toBe(false);
      expect(LANG_CONFIG.saraiki.provider).toBe("none");
      expect(LANG_CONFIG.saraiki.note).toContain("not yet supported");
    });
  });

  describe("uploadToSarvam", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("sends normalized 'unknown' when language is 'auto'", async () => {
      let capturedFormData: FormData | null = null;
      const mockInvoke = vi.fn().mockImplementation(async (_fn: string, options?: { body?: unknown }) => {
        capturedFormData = options?.body as FormData;
        return {
          data: { transcript: "ہیلو", language_code: "ur-IN" },
          error: null,
        };
      });

      vi.spyOn(supabase, "functions", "get").mockReturnValue({
        invoke: mockInvoke,
      } as any);

      const fakeBlob = new Blob(["test-audio"], { type: "audio/wav" });
      const result = await uploadToSarvam(fakeBlob, "auto");

      expect(result.transcript).toBe("ہیلو");
      expect(result.languageCode).toBe("ur-IN");
      const fd1 = capturedFormData as FormData | null;
      expect(fd1).not.toBeNull();
      expect(fd1?.get("language_code")).toBe("unknown");
      expect(fd1?.get("model")).toBe("saaras:v3");
      expect(fd1?.get("mode")).toBe("transcribe");
    });

    it("sends 'ur-IN' when language is 'ur-IN'", async () => {
      let capturedFormData: FormData | null = null;
      const mockInvoke = vi.fn().mockImplementation(async (_fn: string, options?: { body?: unknown }) => {
        capturedFormData = options?.body as FormData;
        return {
          data: { transcript: "گندم میں پانی کب لگائیں؟", language_code: "ur-IN" },
          error: null,
        };
      });

      vi.spyOn(supabase, "functions", "get").mockReturnValue({
        invoke: mockInvoke,
      } as any);

      const fakeBlob = new Blob(["test-audio"], { type: "audio/wav" });
      const result = await uploadToSarvam(fakeBlob, "ur-IN");

      expect(result.transcript).toBe("گندم میں پانی کب لگائیں؟");
      const fd2 = capturedFormData as FormData | null;
      expect(fd2).not.toBeNull();
      expect(fd2?.get("language_code")).toBe("ur-IN");
    });

    it("propagates error messages from Edge Function response", async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { error: "Voice recognition for this language isn't available. You can type your question instead." },
        error: new Error("Edge Function returned a non-2xx status code"),
      });

      vi.spyOn(supabase, "functions", "get").mockReturnValue({
        invoke: mockInvoke,
      } as any);

      const fakeBlob = new Blob(["test-audio"], { type: "audio/wav" });
      await expect(uploadToSarvam(fakeBlob, "auto")).rejects.toThrow(
        "Voice recognition for this language isn't available. You can type your question instead."
      );
    });
  });
});
