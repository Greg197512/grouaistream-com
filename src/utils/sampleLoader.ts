/**
 * Sample Loader - Fetches CC Mixter loops and converts them to AudioBuffers
 * for use in the music generator as layered samples
 */

import { searchCCMixter, type CCMixterTrack } from '@/services/ccMixterService';

export interface LoadedSample {
  buffer: AudioBuffer;
  name: string;
  artist: string;
  license: string;
  genre: string;
}

// Cache loaded samples in memory
const sampleCache = new Map<string, LoadedSample[]>();
const loadingPromises = new Map<string, Promise<LoadedSample[]>>();

// Genre-to-tag mapping for better CC Mixter results
const GENRE_SAMPLE_TAGS: Record<string, string[]> = {
  'Pop': ['pop', 'beat', 'loop'],
  'Rock': ['rock', 'guitar', 'drums'],
  'Electronic': ['electronic', 'synth', 'edm'],
  'Hip-Hop': ['hip_hop', 'beat', 'rap'],
  'Jazz': ['jazz', 'swing', 'piano'],
  'Classical': ['classical', 'orchestra', 'strings'],
  'Lo-fi': ['lofi', 'chill', 'ambient'],
  'Ambient': ['ambient', 'drone', 'pad'],
  'Metal': ['metal', 'heavy', 'distortion'],
  'R&B': ['rnb', 'soul', 'groove'],
  'Reggae': ['reggae', 'dub', 'ska'],
  'Trap': ['trap', 'bass', '808'],
  'House': ['house', 'dance', 'four_on_floor'],
  'Disco': ['disco', 'funk', 'groove'],
  'Indie': ['indie', 'alternative', 'folk'],
  'Country': ['country', 'acoustic', 'folk'],
};

/**
 * Fetch and decode an audio file from URL into an AudioBuffer
 */
async function fetchAudioBuffer(url: string, sampleRate: number = 44100): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 1000) return null; // Too small, skip
    
    // Use OfflineAudioContext for decoding (works in all browsers)
    const tempCtx = new OfflineAudioContext(2, sampleRate, sampleRate);
    const decoded = await tempCtx.decodeAudioData(arrayBuffer);
    return decoded;
  } catch (err) {
    console.warn('Failed to decode sample:', err);
    return null;
  }
}

/**
 * Load CC Mixter samples for a given genre
 * Returns up to maxSamples decoded AudioBuffers
 */
export async function loadGenreSamples(
  genre: string, 
  maxSamples: number = 3
): Promise<LoadedSample[]> {
  // Check cache
  const cacheKey = `${genre}-${maxSamples}`;
  if (sampleCache.has(cacheKey)) {
    return sampleCache.get(cacheKey)!;
  }
  
  // Deduplicate concurrent requests
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const tags = GENRE_SAMPLE_TAGS[genre] || [genre.toLowerCase()];
      const searchGenre = tags[0];
      
      const { tracks } = await searchCCMixter(searchGenre, 20);
      
      if (!tracks || tracks.length === 0) {
        console.log(`No CC Mixter samples found for ${genre}`);
        return [];
      }

      // Filter tracks that have downloadable audio
      const downloadable = tracks.filter(t => {
        const url = getTrackAudioUrl(t);
        return url && (url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg'));
      });

      // Randomly pick up to maxSamples
      const selected = shuffleArray(downloadable).slice(0, maxSamples);
      
      const loaded: LoadedSample[] = [];
      
      for (const track of selected) {
        const url = getTrackAudioUrl(track);
        if (!url) continue;
        
        const buffer = await fetchAudioBuffer(url);
        if (buffer) {
          loaded.push({
            buffer,
            name: track.upload_name,
            artist: track.user_real_name || track.user_name,
            license: track.license_name || 'CC BY',
            genre,
          });
        }
        
        if (loaded.length >= maxSamples) break;
      }

      console.log(`Loaded ${loaded.length} CC Mixter samples for ${genre}`);
      sampleCache.set(cacheKey, loaded);
      return loaded;
    } catch (err) {
      console.warn('Failed to load genre samples:', err);
      return [];
    } finally {
      loadingPromises.delete(cacheKey);
    }
  })();

  loadingPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Mix a sample buffer into an OfflineAudioContext at a specific time
 */
export function mixSampleIntoContext(
  ctx: OfflineAudioContext,
  sampleBuffer: AudioBuffer,
  startTime: number,
  duration: number,
  volume: number = 0.15,
  dest: AudioNode
) {
  const source = ctx.createBufferSource();
  source.buffer = sampleBuffer;
  source.loop = true; // Loop the sample to fill the duration
  
  const gain = ctx.createGain();
  // Fade in
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.5);
  // Sustain
  gain.gain.setValueAtTime(volume, startTime + duration - 1);
  // Fade out
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  // Apply a filter to blend better with synth
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.7;
  
  source.connect(filter).connect(gain).connect(dest);
  source.start(startTime);
  source.stop(startTime + duration + 0.1);
}

function getTrackAudioUrl(track: CCMixterTrack): string | null {
  if (track.download_url) return track.download_url;
  if (track.files && track.files.length > 0) {
    const mp3 = track.files.find(f => 
      f.file_name?.endsWith('.mp3') || f.file_format_info?.default_ext === 'mp3'
    );
    return mp3?.download_url || track.files[0]?.download_url || null;
  }
  return null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Clear sample cache
 */
export function clearSampleCache() {
  sampleCache.clear();
}
