import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
  // strip http/http urls
  const stripped = text.replace(/http?:\/\/[\S]+/gi, "");
  return stripped.replace(/\s+/g, " ").trim();
} 
