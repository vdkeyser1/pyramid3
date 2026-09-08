/**
 * A-04 — Audio Buffer Resampler
 * Pre-ricampiona AudioBuffer alla frequenza del contesto via OfflineAudioContext,
 * eliminando il ricampionamento real-time durante la riproduzione.
 *
 * Cache: WeakMap keyed by buffer → Map<sampleRate, resampledBuffer>.
 * I buffer vengono rilasciati automaticamente dal GC quando la sorgente è GC-ata.
 */

import { createLogger } from '@/core/Logger.js';

const log = createLogger('AudioBufferResampler');

// ── Cache ──────────────────────────────────────────────────────────────────────

const _cache = new WeakMap<AudioBuffer, Map<number, AudioBuffer>>();

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Ricampiona un AudioBuffer alla frequenza target.
 * Restituisce il buffer originale se la frequenza coincide già.
 *
 * @param buffer           Buffer sorgente (qualunque sample rate).
 * @param targetSampleRate Frequenza desiderata (tipicamente AudioContext.sampleRate).
 */
export async function resampleBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) return buffer;

  // Cache hit
  const srMap  = _cache.get(buffer);
  const cached = srMap?.get(targetSampleRate);
  if (cached) return cached;

  const ratio        = targetSampleRate / buffer.sampleRate;
  const targetLength = Math.ceil(buffer.length * ratio);

  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    targetLength,
    targetSampleRate,
  );

  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);

  const resampled = await offline.startRendering();

  // Mette in cache
  if (!_cache.has(buffer)) _cache.set(buffer, new Map());
  _cache.get(buffer)?.set(targetSampleRate, resampled);

  log.debug(
    `Ricampionato ${buffer.sampleRate}Hz → ${targetSampleRate}Hz ` +
    `(${buffer.length} → ${resampled.length} campioni, ${buffer.numberOfChannels}ch)`,
  );

  return resampled;
}

/**
 * Pre-ricampiona un batch di buffer in parallelo.
 * Da chiamare durante lo splash screen / asset loading.
 *
 * @param buffers          Buffer da ricampionare.
 * @param targetSampleRate Frequenza target (AudioContext.sampleRate).
 */
export async function preResampleBuffers(
  buffers: readonly AudioBuffer[],
  targetSampleRate: number,
): Promise<AudioBuffer[]> {
  return Promise.all(buffers.map((b) => resampleBuffer(b, targetSampleRate)));
}
