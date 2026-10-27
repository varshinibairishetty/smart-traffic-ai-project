// src/utils/alertSound.js
//
// Web Audio API synthesizer for high-risk traffic alerts.
// Runs 100% locally in the browser with zero external audio assets.
// Produces a distinct two-tone alert chime (880 Hz -> 659 Hz).

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundMuted() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('smart_traffic_audio_muted') === 'true';
}

export function setSoundMuted(muted) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('smart_traffic_audio_muted', muted ? 'true' : 'false');
  }
}

/**
 * Plays a high-risk warning sound via Web Audio oscillator.
 * Respects user mute preference.
 */
export function playAlertBeep() {
  if (isSoundMuted()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: High alert pitch (880 Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(740, now + 0.12);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.13);

    // Tone 2: Secondary urgent pulse (659 Hz - E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(587, now + 0.28);

    gain2.gain.setValueAtTime(0.001, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.14);
    osc2.stop(now + 0.29);
  } catch (err) {
    console.debug('[Audio] Web Audio alert beep suppressed:', err.message);
  }
}
