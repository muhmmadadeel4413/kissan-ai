import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  ImageOff,
  Loader2,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useI18n } from "../context/PreferencesContext";

type CameraState = "starting" | "ready" | "captured" | "error";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

/**
 * Camera capture dialog — opens the device camera, shows a live preview,
 * captures a single frame, and returns it as a File (JPEG) that plugs
 * straight into the existing Crop Doctor image pipeline.
 *
 * Camera tracks are stopped whenever the dialog closes (any reason) and
 * on component unmount.  Camera is never activated unless the dialog is
 * explicitly opened by the user.
 */
export default function CameraCapture({
  open,
  onOpenChange,
  onCapture,
}: CameraCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Detach the video element so it doesn't hold a stale srcObject.
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cleanupCapture = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
  }, [capturedUrl]);

  const resetAll = useCallback(() => {
    cleanupCapture();
    stopStream();
    setCameraState("starting");
    setError(null);
  }, [cleanupCapture, stopStream]);

  /* ------------------------------------------------------------------ */
  /* Start camera when the dialog opens                                  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    let disposed = false;
    setCameraState("starting");
    setError(null);
    cleanupCapture();

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("camera.unsupported"));
        setCameraState("error");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Prefer rear / environment camera on mobile; fall back gracefully.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        // If the component unmounted while awaiting permission, stop tracks
        // immediately and bail out — never set state on an unmounted component.
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for the first playable frame before showing the preview.
          await new Promise<void>((resolve) => {
            const v = videoRef.current;
            if (!v) {
              resolve();
              return;
            }
            if (v.readyState >= 2) {
              resolve();
            } else {
              v.onloadedmetadata = () => resolve();
            }
          });
          if (disposed) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          await videoRef.current?.play();
        }

        if (!disposed) setCameraState("ready");
      } catch (err) {
        if (disposed) return;
        const name = err instanceof Error ? err.name : "";

        if (name === "NotAllowedError" || name === "SecurityError") {
          setError(t("camera.denied"));
        } else if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError"
        ) {
          setError(t("camera.noDevice"));
        } else if (
          name === "NotReadableError" ||
          name === "TrackStartError"
        ) {
          setError(t("camera.inUse"));
        } else if (name === "OverconstrainedError") {
          // Rear camera constraint couldn't be satisfied — retry without it.
          try {
            const fallback = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            if (disposed) {
              fallback.getTracks().forEach((t) => t.stop());
              return;
            }
            streamRef.current = fallback;
            if (videoRef.current) {
              videoRef.current.srcObject = fallback;
              await new Promise<void>((resolve) => {
                const v = videoRef.current;
                if (!v) { resolve(); return; }
                if (v.readyState >= 2) resolve();
                else v.onloadedmetadata = () => resolve();
              });
              if (disposed) { fallback.getTracks().forEach((t) => t.stop()); return; }
              await videoRef.current?.play();
            }
            if (!disposed) setCameraState("ready");
            return;
          } catch {
            if (disposed) return;
            setError(t("camera.fallbackError"));
          }
        } else {
          setError(t("camera.genericError"));
        }

        setCameraState("error");
      }
    }

    void startCamera();

    return () => {
      disposed = true;
      // Stop the stream that was set during this effect's lifecycle.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Also stop the stream when the dialog closes (covers Radix's own X button,
  // overlay click, and Escape key which bypass our explicit cleanup).
  useEffect(() => {
    if (!open) stopStream();
  }, [open, stopStream]);

  // Global safety net: stop camera tracks on component unmount.
  useEffect(() => () => stopStream(), [stopStream]);

  /* ------------------------------------------------------------------ */
  /* Capture / Retake / Confirm                                          */
  /* ------------------------------------------------------------------ */

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError(t("camera.captureError"));
      setCameraState("error");
      return;
    }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(t("camera.captureFailed"));
          setCameraState("error");
          return;
        }
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
        setCameraState("captured");
      },
      "image/jpeg",
      0.95,
    );
  }

  function retake() {
    cleanupCapture();
    // The live stream is still attached to the video element — just flip state.
    setCameraState("ready");
  }

  function confirm() {
    if (!capturedBlob) return;
    const file = new File(
      [capturedBlob],
      `crop-photo-${Date.now()}.jpg`,
      { type: "image/jpeg" },
    );
    onCapture(file);
    handleClose();
  }

  function handleClose() {
    resetAll();
    onOpenChange(false);
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent
        className="max-w-lg p-0 sm:max-w-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("camera.title")}
          </DialogTitle>
          <DialogDescription>
            {t("camera.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden bg-black sm:mx-5 sm:rounded-xl">
          {/* Live camera feed (visible when state is "starting" or "ready"). */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`aspect-video w-full object-cover ${
              cameraState === "captured" ? "hidden" : ""
            }`}
            aria-label={t("camera.livePreviewAria")}
          />

          {/* Captured still frame (replaces video after capture). */}
          {capturedUrl && cameraState === "captured" ? (
            <img
              src={capturedUrl}
              alt={t("camera.capturedAlt")}
              className="aspect-video w-full object-cover"
            />
          ) : null}

          {/* Starting overlay */}
          {cameraState === "starting" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              <p className="text-sm font-medium">{t("camera.starting")}</p>
            </div>
          ) : null}

          {/* Error overlay */}
          {cameraState === "error" ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
              <CameraOff className="h-10 w-10 text-red-400" aria-hidden="true" />
              <p className="max-w-xs text-sm leading-relaxed">{error}</p>
            </div>
          ) : null}
        </div>

        {/* Hidden canvas used for frame capture. */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-3">
          {/* Left — Close / Cancel */}
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            {cameraState === "captured" ? t("camera.cancel") : t("camera.close")}
          </Button>

          {/* Right — contextual action */}
          <div className="flex items-center gap-2">
            {cameraState === "ready" ? (
              <Button onClick={captureFrame}>
                <Video className="h-4 w-4" aria-hidden="true" />
                {t("camera.capture")}
              </Button>
            ) : null}

            {cameraState === "captured" ? (
              <>
                <Button variant="outline" onClick={retake}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t("camera.retake")}
                </Button>
                <Button onClick={confirm}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("camera.usePhoto")}
                </Button>
              </>
            ) : null}

            {cameraState === "error" ? (
              <Button variant="outline" onClick={handleClose}>
                <ImageOff className="h-4 w-4" aria-hidden="true" />
                {t("camera.close")}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
