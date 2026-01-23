// CC Mixter API Service
// Handles searching and downloading Creative Commons licensed music

export interface CCMixterTrack {
  upload_id: number;
  upload_name: string;
  user_name: string;
  user_real_name?: string;
  license_url: string;
  license_name: string;
  file_page_url: string;
  download_url?: string;
  files?: {
    file_id: number;
    file_name: string;
    file_format_info: {
      ps?: string;
      default_ext?: string;
      media_type?: string;
    };
    download_url: string;
  }[];
  upload_date?: string;
  upload_tags?: string;
  upload_description?: string;
}

export interface CCMixterSearchResult {
  tracks: CCMixterTrack[];
  cached: boolean;
  cacheTimestamp?: number;
}

const CACHE_KEY = 'ccmixter_cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Get cached results
const getCachedResults = (query: string): CCMixterSearchResult | null => {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return null;
    
    const parsed = JSON.parse(cache);
    const cached = parsed[query];
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        tracks: cached.tracks,
        cached: true,
        cacheTimestamp: cached.timestamp
      };
    }
    return null;
  } catch {
    return null;
  }
};

// Save to cache
const saveToCache = (query: string, tracks: CCMixterTrack[]) => {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    const parsed = cache ? JSON.parse(cache) : {};
    
    // Clean old entries
    const now = Date.now();
    Object.keys(parsed).forEach(key => {
      if (now - parsed[key].timestamp > CACHE_DURATION) {
        delete parsed[key];
      }
    });
    
    parsed[query] = { tracks, timestamp: now };
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to cache CC Mixter results:', error);
  }
};

// Search CC Mixter API via edge function proxy
export const searchCCMixter = async (
  genre: string,
  limit: number = 50
): Promise<CCMixterSearchResult> => {
  const cacheKey = `${genre}-${limit}`;
  
  // Check cache first
  const cached = getCachedResults(cacheKey);
  if (cached) {
    console.log('CC Mixter: Using cached results for', genre);
    return cached;
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ccmixter-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ genre, limit })
      }
    );

    if (!response.ok) {
      throw new Error(`CC Mixter API error: ${response.status}`);
    }

    const data = await response.json();
    const tracks: CCMixterTrack[] = data.tracks || [];
    
    // Cache the results
    saveToCache(cacheKey, tracks);
    
    return { tracks, cached: false };
  } catch (error) {
    console.error('CC Mixter search failed:', error);
    throw error;
  }
};

// Get license display info
export const getLicenseInfo = (licenseUrl: string): { type: string; badges: string[]; attribution: string } => {
  const badges: string[] = [];
  let type = 'CC';
  
  if (licenseUrl.includes('by-nc-sa')) {
    type = 'CC BY-NC-SA';
    badges.push('BY', 'NC', 'SA');
  } else if (licenseUrl.includes('by-nc-nd')) {
    type = 'CC BY-NC-ND';
    badges.push('BY', 'NC', 'ND');
  } else if (licenseUrl.includes('by-nc')) {
    type = 'CC BY-NC';
    badges.push('BY', 'NC');
  } else if (licenseUrl.includes('by-sa')) {
    type = 'CC BY-SA';
    badges.push('BY', 'SA');
  } else if (licenseUrl.includes('by-nd')) {
    type = 'CC BY-ND';
    badges.push('BY', 'ND');
  } else if (licenseUrl.includes('/by/')) {
    type = 'CC BY';
    badges.push('BY');
  } else if (licenseUrl.includes('publicdomain') || licenseUrl.includes('cc0')) {
    type = 'CC0 Public Domain';
    badges.push('PD');
  }
  
  return {
    type,
    badges,
    attribution: `Licensed under ${type}`
  };
};

// Download a CC Mixter track
export const downloadCCMixterTrack = async (
  track: CCMixterTrack
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find MP3 download URL
    let downloadUrl = track.download_url;
    
    if (!downloadUrl && track.files && track.files.length > 0) {
      // Find MP3 file
      const mp3File = track.files.find(f => 
        f.file_format_info?.default_ext === 'mp3' || 
        f.file_name.endsWith('.mp3')
      );
      downloadUrl = mp3File?.download_url || track.files[0].download_url;
    }

    if (!downloadUrl) {
      return { success: false, error: 'No download URL available' };
    }

    // Open download in new tab (legal CC download)
    window.open(downloadUrl, '_blank');
    
    return { success: true };
  } catch (error) {
    console.error('CC Mixter download failed:', error);
    return { success: false, error: 'Download failed' };
  }
};

// Clear cache
export const clearCCMixterCache = () => {
  localStorage.removeItem(CACHE_KEY);
};
