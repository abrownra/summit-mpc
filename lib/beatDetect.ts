/**
 * BPM detection via onset-strength autocorrelation.
 * Works well for drum loops and rhythmic samples.
 */
export async function detectBPM(url: string): Promise<number> {
  const res = await fetch(url);
  const arrayBuf = await res.arrayBuffer();

  // Decode audio (mono, any sample rate)
  const offlineCtx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuf);

  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;

  // Downsample to ~200 Hz analysis rate
  const step = Math.max(1, Math.floor(sr / 200));
  const envelope: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    let sum = 0;
    const end = Math.min(i + step, data.length);
    for (let j = i; j < end; j++) sum += Math.abs(data[j]);
    envelope.push(sum / (end - i));
  }

  // Onset strength = positive flux
  const onsets: number[] = new Array(envelope.length).fill(0);
  for (let i = 1; i < envelope.length; i++) {
    onsets[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }

  // Autocorrelation over BPM range 60–200
  const analysisRate = sr / step;
  const minLag = Math.floor((analysisRate * 60) / 200);
  const maxLag = Math.floor((analysisRate * 60) / 60);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const limit = onsets.length - lag;
    for (let i = 0; i < limit; i++) corr += onsets[i] * onsets[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const raw = (analysisRate * 60) / bestLag;

  // Normalize to 60–180 range by doubling/halving
  let bpm = raw;
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  return Math.round(bpm);
}

/** Semitone shift needed to compensate for a playback rate change */
export function rateToSemitones(rate: number): number {
  return -12 * Math.log2(rate);
}
