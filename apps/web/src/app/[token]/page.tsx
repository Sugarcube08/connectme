"use client";

import React, { useState, useEffect, use, useRef } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  UploadCloud,
  Send,
  Lock,
  Sparkles,
  SwitchCamera,
  RotateCcw,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { PhoneInput } from "@/components/PhoneInput";

interface PublicPageProps {
  params: Promise<{ token: string }>;
}

export default function PublicContactPage({ params }: PublicPageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    status: string;
    brandName?: string;
    requiresSmsNotice?: boolean;
    smsNotice?: string;
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  // Live Camera states & refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // SMS Gateway Heartbeat States
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [smsStartupHeartbeatUrl, setSmsStartupHeartbeatUrl] = useState<string | null>(null);
  const [smsServiceReady, setSmsServiceReady] = useState<boolean | null>(null);
  const firstHeartbeatSentRef = useRef(false);
  const secondHeartbeatSentRef = useRef(false);

  const sendHeartbeat = async (url: string, isConfirmation = false) => {
    try {
      // 1. Direct browser fetch to wake up Render (mode: "no-cors" handles missing CORS headers safely)
      fetch(url, { method: "GET", mode: "no-cors" }).catch(() => {});

      // 2. Server-verified heartbeat to inspect real readiness status
      const res = await apiClient.sendStartupHeartbeat(token);
      if (res.success && res.data) {
        if (res.data.ready) {
          setSmsServiceReady(true);
          return true;
        } else if (isConfirmation) {
          setSmsServiceReady(false);
          return false;
        }
      } else if (isConfirmation) {
        setSmsServiceReady(false);
      }
    } catch {
      if (isConfirmation) {
        setSmsServiceReady(false);
      }
    }
    return false;
  };

  useEffect(() => {
    async function checkToken() {
      try {
        setLoading(true);
        const res = await apiClient.verifyCode(token);
        if (res.success && res.data) {
          setEligibility({
            eligible: res.data.eligible,
            status: res.data.codeStatus,
            brandName: res.data.brandName,
            requiresSmsNotice: res.data.requiresSmsNotice,
            smsNotice: res.data.smsNotice,
          });

          if (res.data.smsConfigured && res.data.smsStartupHeartbeatUrl) {
            setSmsConfigured(true);
            setSmsStartupHeartbeatUrl(res.data.smsStartupHeartbeatUrl);

            // Heartbeat 1: Instantly send heartbeat as soon as redeem code form opens
            if (!firstHeartbeatSentRef.current) {
              firstHeartbeatSentRef.current = true;
              sendHeartbeat(res.data.smsStartupHeartbeatUrl, false);
            }
          }
        } else {
          setEligibility({
            eligible: false,
            status: "INVALID",
          });
        }
      } catch {
        setEligibility({
          eligible: false,
          status: "NETWORK_ERROR",
        });
      } finally {
        setLoading(false);
      }
    }

    checkToken();
  }, [token]);

  // Heartbeat 2: Triggered as user completes mandatory fields
  const mandatoryFieldsFilled = Boolean(fullName.trim().length >= 1 && phoneNumber.trim().length >= 5);

  useEffect(() => {
    if (mandatoryFieldsFilled && smsConfigured && smsStartupHeartbeatUrl) {
      if (!secondHeartbeatSentRef.current) {
        secondHeartbeatSentRef.current = true;
        sendHeartbeat(smsStartupHeartbeatUrl, true);
      }
    }
  }, [mandatoryFieldsFilled, smsConfigured, smsStartupHeartbeatUrl]);

  const handleMandatoryFieldBlur = () => {
    if (fullName.trim().length >= 1 && phoneNumber.trim().length >= 5) {
      if (smsConfigured && smsStartupHeartbeatUrl && !secondHeartbeatSentRef.current) {
        secondHeartbeatSentRef.current = true;
        sendHeartbeat(smsStartupHeartbeatUrl, true);
      }
    }
  };

  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const compressImageToLimit = async (file: File, maxBytes = MAX_IMAGE_SIZE_BYTES): Promise<File> => {
    if (file.size <= maxBytes) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Cap extreme camera resolutions (e.g. 48MP/108MP) to 2560px max dimension
          // which preserves crisp retina clarity while drastically reducing memory/filesize
          const maxDimension = 2560;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Output WebP if supported/uploaded, else high-quality JPEG
          const outputMime = file.type === "image/webp" ? "image/webp" : "image/jpeg";
          let quality = 0.92;

          const toBlobAsync = (q: number): Promise<Blob | null> =>
            new Promise((res) => canvas.toBlob(res, outputMime, q));

          let blob = await toBlobAsync(quality);

          // If still above limit, gradually reduce compression quality while keeping visual fidelity
          while (blob && blob.size > maxBytes && quality > 0.65) {
            quality -= 0.07;
            blob = await toBlobAsync(quality);
          }

          // If still over 5MB, scale down canvas resolution progressively
          while (blob && blob.size > maxBytes && (canvas.width > 1200 || canvas.height > 1200)) {
            canvas.width = Math.round(canvas.width * 0.85);
            canvas.height = Math.round(canvas.height * 0.85);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            blob = await toBlobAsync(quality);
          }

          if (!blob) {
            resolve(file);
            return;
          }

          const extension = outputMime === "image/webp" ? ".webp" : ".jpg";
          const newFileName = file.name.replace(/\.[^.]+$/, "") + extension;
          const compressedFile = new File([blob], newFileName, {
            type: outputMime,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image for compression."));
      };

      img.src = objectUrl;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Please upload a JPEG, PNG, or WebP picture.");
      return;
    }

    try {
      let processedFile = file;
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setCompressing(true);
        processedFile = await compressImageToLimit(file, MAX_IMAGE_SIZE_BYTES);
      }

      if (processedFile.size > MAX_IMAGE_SIZE_BYTES) {
        setImageError("Image could not be compressed below 5 MB. Please select a different photo.");
        return;
      }

      setSelectedFile(processedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const objectUrl = URL.createObjectURL(processedFile);
      setPreviewUrl(objectUrl);
    } catch {
      setImageError("Could not process this image. Please try another photo.");
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setImageError(null);
  };

  // Camera handling functions
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const startCamera = async (facing: "user" | "environment" = cameraFacing) => {
    setCameraError(null);
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
      setCapturedPhotoUrl(null);
    }
    setCapturedBlob(null);

    stopCameraStream();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Direct camera streaming is not supported on this browser or requires HTTPS. You can choose a photo from your files or use native camera capture."
      );
      setIsCameraActive(true);
      return;
    }

    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      stopCameraStream();
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError(
          "Camera access permission was denied. Please allow camera permissions in your browser or select an existing photo."
        );
      } else {
        setCameraError("Could not access camera. Please select a photo from your device.");
      }
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(nextFacing);
    await startCamera(nextFacing);
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Front-facing camera: mirror horizontally so selfie matches what user sees
    if (cameraFacing === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
        const preview = URL.createObjectURL(blob);
        setCapturedPhotoUrl(preview);
        setCapturedBlob(blob);
      },
      "image/jpeg",
      0.95
    );
  };

  const retakePhoto = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
      setCapturedPhotoUrl(null);
    }
    setCapturedBlob(null);
  };

  const confirmCapturedPhoto = async () => {
    if (!capturedBlob) return;
    try {
      const capturedFile = new File([capturedBlob], `camera-photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      let processed = capturedFile;
      if (capturedFile.size > MAX_IMAGE_SIZE_BYTES) {
        setCompressing(true);
        processed = await compressImageToLimit(capturedFile, MAX_IMAGE_SIZE_BYTES);
      }

      setSelectedFile(processed);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(processed));
      setImageError(null);
      closeCamera();
    } catch {
      setImageError("Failed to process captured photo.");
    } finally {
      setCompressing(false);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
      setCapturedPhotoUrl(null);
    }
    setCapturedBlob(null);
    setIsCameraActive(false);
    setCameraError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!phoneNumber.trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    // If SMS configured, ensure second confirmation heartbeat was dispatched
    if (smsConfigured && smsStartupHeartbeatUrl && !secondHeartbeatSentRef.current) {
      secondHeartbeatSentRef.current = true;
      sendHeartbeat(smsStartupHeartbeatUrl, true).catch(() => {});
    }

    try {
      setSubmitting(true);
      const res = await apiClient.redeemCode(
        token,
        {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || undefined,
          organization: organization.trim() || undefined,
          role: role.trim() || undefined,
          profileUrl: profileUrl.trim() || undefined,
          discussionNotes: discussionNotes.trim() || undefined,
        },
        selectedFile || undefined
      );

      if (!res.success) {
        setFormError(res.error?.message || "Submission failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
          <p className="text-sm font-medium text-slate-light">Verifying access link...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-royal backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-royalViolet/20 text-royalViolet-hover">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <h2 className="mb-3 text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            You&apos;re on my radar.
          </h2>

          <p className="mb-6 text-sm leading-relaxed text-warmIvory/85 sm:text-base">
            Thanks for sharing your details. I&apos;ll reach out if there&apos;s an opportunity for us to connect.
          </p>

          <div className="rounded-xl border border-obsidian-border/80 bg-obsidian-elevated/50 p-4">
            <p className="text-xs font-medium text-metallicGold tracking-wide italic">
              &ldquo;Good people. Interesting conversations. Unexpected opportunities.&rdquo;
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate">
            <Lock className="h-3.5 w-3.5" />
            <span>Connection secured &bull; Connect Me</span>
          </div>
        </div>
      </div>
    );
  }

  if (eligibility?.status === "CONSUMED") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-lg backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-dark/30 text-metallicGold">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-warmIvory">Code Already Used</h2>
          <p className="mb-6 text-sm text-slate-light leading-relaxed">
            This single-use access code has already been redeemed. If you&apos;ve already shared your details, you&apos;re on my radar.
          </p>
          <div className="text-xs text-slate">Connect Me &bull; Devcon</div>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-lg backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-dark/40 text-slate-light">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-warmIvory">Link Unavailable</h2>
          <p className="mb-6 text-sm text-slate-light leading-relaxed">
            This invitation link is expired or no longer available.
          </p>
          <div className="text-xs text-slate">Connect Me &bull; Devcon</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-royalViolet/40 bg-royalViolet/10 px-3.5 py-1 text-xs font-semibold text-warmIvory backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-metallicGold" />
            <span>PERSONALLY PROFESSIONAL CONNECTION</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-warmIvory sm:text-3xl">
            CONNECT <span className="text-royalViolet">ME</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-light italic">
            &ldquo;You share. We connect.&rdquo;
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/95 p-6 shadow-royal sm:p-8 backdrop-blur-xl">
          {formError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Full Name <span className="text-royalViolet">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={handleMandatoryFieldBlur}
                placeholder="e.g. Satoshi Nakamoto"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Phone Number <span className="text-royalViolet">*</span>
              </label>
              <PhoneInput
                value={phoneNumber}
                onChange={(normalizedVal) => {
                  setPhoneNumber(normalizedVal);
                }}
                onBlur={handleMandatoryFieldBlur}
                placeholder="62603 29127"
              />
              {eligibility?.requiresSmsNotice && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      {eligibility.smsNotice ||
                        "be sure to enter correct number, because it's not editable and you'll receive my contact on the given number via sms only"}
                    </span>
                  </div>

                  {smsServiceReady === true && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>SMS Service confirmed ready • Automatic dispatch active</span>
                    </div>
                  )}

                  {smsServiceReady === false && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span>Service warmup in progress • Details captured securely</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                Email Address <span className="text-slate font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. satoshi@example.org"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                  Organization <span className="text-slate font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Ethereum Protocol"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                  Role <span className="text-slate font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Core Dev, Founder"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                LinkedIn / GitHub / X Profile <span className="text-slate font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                What would you like to discuss? <span className="text-slate font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={discussionNotes}
                onChange={(e) => setDiscussionNotes(e.target.value)}
                placeholder="Mention what we chatted about at Devcon or shared ideas..."
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            {/* Profile Picture Upload */}
            <div className="rounded-xl border border-deepIndigo/80 bg-deepIndigo/20 p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-lg bg-royalViolet/20 p-2 text-royalViolet-hover">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-metallicGold">
                    Profile Picture
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-warmIvory/90">
                    &ldquo;I&apos;m bad at remembering names. Mind sharing a picture? It helps me put a face to the name when we connect later.&rdquo;
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-light italic">
                    Totally optional, of course.
                  </p>
                </div>
              </div>

              {isCameraActive ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-royalViolet bg-black p-3 shadow-royal">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-obsidian-surface flex items-center justify-center">
                    {capturedPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={capturedPhotoUrl}
                        alt="Captured frame"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`h-full w-full object-cover ${cameraFacing === "user" ? "-scale-x-100" : ""}`}
                        />
                        <div className="pointer-events-none absolute inset-4 rounded-xl border border-white/20" />
                      </>
                    )}

                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center">
                        <AlertCircle className="mb-2 h-6 w-6 text-red-400" />
                        <p className="text-xs text-red-200">{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            closeCamera();
                            fileInputRef.current?.click();
                          }}
                          className="mt-3 rounded-lg bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white hover:bg-royalViolet-hover"
                        >
                          Choose from files instead
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="mt-3 flex items-center justify-between px-2">
                    {capturedPhotoUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={retakePhoto}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-elevated px-3.5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Retake</span>
                        </button>
                        <button
                          type="button"
                          onClick={confirmCapturedPhoto}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Use Photo</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border transition"
                          title="Switch front/back camera"
                        >
                          <SwitchCamera className="h-4 w-4" />
                          <span className="hidden sm:inline">Flip</span>
                        </button>

                        <button
                          type="button"
                          onClick={snapPhoto}
                          className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-royalViolet bg-white shadow-royal hover:scale-105 active:scale-95 transition"
                          title="Snap Photo"
                        >
                          <div className="h-8 w-8 rounded-full bg-royalViolet" />
                        </button>

                        <button
                          type="button"
                          onClick={closeCamera}
                          className="inline-flex items-center gap-1 rounded-xl border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs font-semibold text-slate-light hover:text-warmIvory transition"
                        >
                          <X className="h-4 w-4" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : compressing ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-obsidian-border bg-obsidian-elevated/40 p-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
                  <div className="text-xs text-warmIvory">
                    Optimizing high-resolution photo...
                    <div className="text-[10px] text-slate-light">Compressing to fit 5 MB while preserving quality</div>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-royalViolet">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Remove Picture</span>
                    </button>
                    <p className="mt-1 text-[11px] text-slate-light">
                      Picture selected ({selectedFile?.name})
                      {selectedFile?.size ? ` • ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera("user")}
                      className="flex items-center justify-center gap-2 rounded-xl border border-royalViolet/40 bg-royalViolet/10 p-3.5 text-xs font-semibold text-royalViolet-hover transition hover:bg-royalViolet/20 shadow-sm"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Take Photo (Camera)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-xl border border-obsidian-border bg-obsidian-elevated/40 p-3.5 text-xs font-semibold text-warmIvory transition hover:border-royalViolet/60"
                    >
                      <UploadCloud className="h-4 w-4 text-slate" />
                      <span>Upload from Device</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />

                  <p className="text-center text-[10px] text-slate">
                    JPEG, PNG, WebP (up to 5MB, auto-compressed if larger)
                  </p>
                </div>
              )}

              {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3.5 text-sm font-semibold text-white shadow-royal transition-all duration-200 hover:bg-royalViolet-hover disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Contact Information</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-obsidian-border pt-4 text-center">
            <p className="text-[11px] text-slate leading-relaxed">
              Your details are submitted directly and privately so the owner can follow up with you.
              Never disclosed to third parties or published in any public directory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
