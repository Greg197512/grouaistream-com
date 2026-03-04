/**
 * AI-driven genre-to-color palette mapping.
 * Returns hue ranges, saturation, and brightness for equalizer + particles.
 */

export interface GenreColorPalette {
  /** Base hue for bass frequencies */
  bassHue: number;
  /** Base hue for mid frequencies */
  midHue: number;
  /** Base hue for treble frequencies */
  trebleHue: number;
  /** Saturation percentage (0-100) */
  saturation: number;
  /** Base brightness percentage (0-100) */
  brightness: number;
  /** Glow hue for shadows/effects */
  glowHue: number;
  /** Overall darkness factor (0=bright, 1=very dark) */
  darkness: number;
  /** Label for debugging */
  label: string;
}

const PALETTES: Record<string, GenreColorPalette> = {
  // Dark & aggressive genres
  rock: {
    bassHue: 0, midHue: 350, trebleHue: 15,
    saturation: 75, brightness: 35,
    glowHue: 0, darkness: 0.6,
    label: "Crimson Rock",
  },
  metal: {
    bassHue: 260, midHue: 280, trebleHue: 300,
    saturation: 50, brightness: 25,
    glowHue: 270, darkness: 0.8,
    label: "Dark Violet Metal",
  },
  punk: {
    bassHue: 345, midHue: 355, trebleHue: 10,
    saturation: 80, brightness: 30,
    glowHue: 350, darkness: 0.65,
    label: "Blood Punk",
  },
  grunge: {
    bassHue: 30, midHue: 20, trebleHue: 40,
    saturation: 40, brightness: 25,
    glowHue: 25, darkness: 0.75,
    label: "Dirty Amber Grunge",
  },
  // Electronic & energetic
  edm: {
    bassHue: 180, midHue: 200, trebleHue: 260,
    saturation: 90, brightness: 55,
    glowHue: 190, darkness: 0.2,
    label: "Electric Cyan",
  },
  trance: {
    bassHue: 240, midHue: 260, trebleHue: 280,
    saturation: 85, brightness: 50,
    glowHue: 250, darkness: 0.3,
    label: "Deep Indigo Trance",
  },
  house: {
    bassHue: 35, midHue: 50, trebleHue: 60,
    saturation: 85, brightness: 50,
    glowHue: 45, darkness: 0.25,
    label: "Warm House Gold",
  },
  techno: {
    bassHue: 160, midHue: 180, trebleHue: 200,
    saturation: 70, brightness: 40,
    glowHue: 170, darkness: 0.5,
    label: "Cold Techno",
  },
  // Pop & mainstream
  pop: {
    bassHue: 310, midHue: 330, trebleHue: 340,
    saturation: 80, brightness: 55,
    glowHue: 320, darkness: 0.15,
    label: "Hot Pink Pop",
  },
  disco: {
    bassHue: 40, midHue: 320, trebleHue: 50,
    saturation: 85, brightness: 55,
    glowHue: 45, darkness: 0.15,
    label: "Glam Disco",
  },
  // Urban
  "hip-hop": {
    bassHue: 45, midHue: 30, trebleHue: 55,
    saturation: 70, brightness: 45,
    glowHue: 40, darkness: 0.45,
    label: "Gold Hip-Hop",
  },
  rap: {
    bassHue: 45, midHue: 30, trebleHue: 55,
    saturation: 70, brightness: 45,
    glowHue: 40, darkness: 0.45,
    label: "Gold Rap",
  },
  "r&b": {
    bassHue: 270, midHue: 290, trebleHue: 310,
    saturation: 65, brightness: 40,
    glowHue: 280, darkness: 0.4,
    label: "Purple Soul",
  },
  // Chill & mellow
  jazz: {
    bassHue: 220, midHue: 230, trebleHue: 45,
    saturation: 55, brightness: 40,
    glowHue: 225, darkness: 0.5,
    label: "Midnight Jazz",
  },
  blues: {
    bassHue: 210, midHue: 220, trebleHue: 230,
    saturation: 60, brightness: 38,
    glowHue: 215, darkness: 0.55,
    label: "Deep Blues",
  },
  classical: {
    bassHue: 40, midHue: 35, trebleHue: 45,
    saturation: 35, brightness: 50,
    glowHue: 38, darkness: 0.3,
    label: "Warm Gold Classical",
  },
  ambient: {
    bassHue: 190, midHue: 210, trebleHue: 230,
    saturation: 45, brightness: 45,
    glowHue: 200, darkness: 0.4,
    label: "Ethereal Ambient",
  },
};

// Default orange palette (when no genre matched)
const DEFAULT_PALETTE: GenreColorPalette = {
  bassHue: 15, midHue: 25, trebleHue: 35,
  saturation: 90, brightness: 50,
  glowHue: 25, darkness: 0,
  label: "Default Orange",
};

/**
 * Returns an AI-selected color palette based on the track genre.
 * Matches partial/case-insensitive genre strings.
 */
export function getGenrePalette(genre: string | null | undefined): GenreColorPalette {
  if (!genre) return DEFAULT_PALETTE;

  const g = genre.toLowerCase().trim();

  // Direct match
  if (PALETTES[g]) return PALETTES[g];

  // Partial match (e.g. "Punk Rock" → punk, "Heavy Metal" → metal)
  for (const [key, palette] of Object.entries(PALETTES)) {
    if (g.includes(key) || key.includes(g)) return palette;
  }

  // Keyword-based fallback
  if (g.includes("hard") || g.includes("heavy") || g.includes("death") || g.includes("black") || g.includes("doom")) {
    return PALETTES.metal;
  }
  if (g.includes("electro") || g.includes("synth") || g.includes("bass")) {
    return PALETTES.edm;
  }
  if (g.includes("soul") || g.includes("funk")) {
    return PALETTES["r&b"];
  }
  if (g.includes("reggae") || g.includes("ska")) {
    return { ...PALETTES.house, bassHue: 120, midHue: 50, trebleHue: 45, glowHue: 100, label: "Reggae Green" };
  }
  if (g.includes("country") || g.includes("folk")) {
    return { ...PALETTES.classical, bassHue: 30, label: "Country Warm" };
  }

  return DEFAULT_PALETTE;
}
