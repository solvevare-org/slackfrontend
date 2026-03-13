import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_URL } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function playNotificationSound() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.0001
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    // fade in then out
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.35)
    o.stop(ctx.currentTime + 0.36)
  } catch (e) {
    // ignore audio errors (browser restrictions)
  }
}

// Remove any URLs from a text string and collapse whitespace.
export function hideUrls(text?: string | null) {
  if (!text) return "";
  // strip https/https urls
  const stripped = text.replace(/https?:\/\/[\S]+/gi, "");
  return stripped.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a URL returned from the backend so that it always points to the
 * configured API host.  The backend may send absolute URLs (including the
 * host), protocol‑relative URLs (`//host/...`), or just a path like
 * `${API_URL}/uploads/foo.png`.  In development the host is `localhost:6004`, but in a
 * production deployment the backend is usually accessed through a proxy, so
 * hardcoding the port would bypass that proxy.
 *
 * Usage:
 * ```tsx
 * <img src={imgUrl(user.avatar)} />
 * ```
 */
export function imgUrl(input?: string | null): string {
  if (!input) return '';

  // absolute URL already contains protocol
  if (/^httpss?:\/\//i.test(input)) {
    return input;
  }

  // protocol‑relative (starts with `//`).  Prepend the current page's
  // protocol so the browser resolves it correctly.
  if (/^\/\//.test(input)) {
    try {
      return `${window.location.protocol}${input}`;
    } catch {
      // fallback if window is not available (shouldn't happen in client)
      return `${API_URL}${input.replace(/^\/\//, '/')}`;
    }
  }

  // anything else is treated as a path relative to the API host
  if (input.startsWith('/')) {
    return `${API_URL}${input}`;
  }
  return `${API_URL}/${input}`;
}

