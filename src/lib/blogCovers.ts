// Curated Unsplash photo covers by blog category.
// Unsplash photos are free for commercial use — unsplash.com/license
// Each category has 4 photos; deterministic selection based on slug.

const U = "https://images.unsplash.com/photo-";
const Q = "?w=1200&q=85&fit=crop&crop=center";

export const CATEGORY_COVERS: Record<string, string[]> = {
  ai_news: [
    `${U}1677442135703-1787eea5ce01${Q}`,  // AI abstract blue glow
    `${U}1620712943543-bcc4688e7485${Q}`,  // robot / AI humanoid
    `${U}1555255707-c07966088b7b${Q}`,     // neon tech circuit
    `${U}1518770660439-4636190af475${Q}`,  // circuit board macro
  ],
  tech_news: [
    `${U}1518770660439-4636190af475${Q}`,  // circuit board
    `${U}1461749280684-dccba630e2f6${Q}`,  // laptop with code
    `${U}1451187580459-43490279c0fa${Q}`,  // space/galaxy dark
    `${U}1555255707-c07966088b7b${Q}`,     // neon glow
  ],
  trends: [
    `${U}1470225620780-dba8ba36b745${Q}`,  // music equipment desk
    `${U}1493225457124-a3eb161ffa5f${Q}`,  // concert crowd
    `${U}1514320291840-2e0a9bf2a9ae${Q}`,  // festival crowd lights
    `${U}1505740420928-5e560c06d30e${Q}`,  // headphones product
  ],
  feature: [
    `${U}1598488035139-bdbb2231ce04${Q}`,  // studio music gear
    `${U}1516450360452-9312f5e86fc7${Q}`,  // DJ turntable neon
    `${U}1511671782779-c97d3d27a1d4${Q}`,  // listening headphones
    `${U}1485579149621-3123dd979885${Q}`,  // headphones purple
  ],
  monetization: [
    `${U}1553729459-efe14ef6055d${Q}`,     // dollar bills
    `${U}1454165804606-c3d57bc86b40${Q}`,  // business desk
    `${U}1507003211169-0a1dd7228f2d${Q}`,  // coffee & laptop
    `${U}1611532736597-de2d4265fba3${Q}`,  // analytics / social media
  ],
  tutorial: [
    `${U}1598488035139-bdbb2231ce04${Q}`,  // studio gear
    `${U}1505740420928-5e560c06d30e${Q}`,  // headphones
    `${U}1461749280684-dccba630e2f6${Q}`,  // code/laptop
    `${U}1516450360452-9312f5e86fc7${Q}`,  // DJ decks
  ],
  psychology: [
    `${U}1504892564858-48800e5aeb17${Q}`,  // brain / mind concept
    `${U}1451187580459-43490279c0fa${Q}`,  // galaxy / deep space
    `${U}1485579149621-3123dd979885${Q}`,  // moody headphones
    `${U}1511671782779-c97d3d27a1d4${Q}`,  // emotional listening
  ],
  industry: [
    `${U}1493225457124-a3eb161ffa5f${Q}`,  // concert crowd
    `${U}1526478806334-5fd488fcaabc${Q}`,  // vinyl records stack
    `${U}1459749411175-04bf5292ceea${Q}`,  // vinyl on turntable
    `${U}1514320291840-2e0a9bf2a9ae${Q}`,  // festival
  ],
  tools: [
    `${U}1598488035139-bdbb2231ce04${Q}`,  // studio equipment
    `${U}1516450360452-9312f5e86fc7${Q}`,  // DJ tools
    `${U}1505740420928-5e560c06d30e${Q}`,  // headphones
    `${U}1518770660439-4636190af475${Q}`,  // circuit / tech
  ],
  lifestyle: [
    `${U}1511671782779-c97d3d27a1d4${Q}`,  // person with headphones
    `${U}1485579149621-3123dd979885${Q}`,  // moody headphones
    `${U}1459749411175-04bf5292ceea${Q}`,  // vinyl record
    `${U}1470225620780-dba8ba36b745${Q}`,  // music at desk
  ],
  marketing: [
    `${U}1611532736597-de2d4265fba3${Q}`,  // social media analytics
    `${U}1507003211169-0a1dd7228f2d${Q}`,  // coffee & work
    `${U}1454165804606-c3d57bc86b40${Q}`,  // business
    `${U}1553729459-efe14ef6055d${Q}`,     // money
  ],
  future: [
    `${U}1451187580459-43490279c0fa${Q}`,  // galaxy / space
    `${U}1677442135703-1787eea5ce01${Q}`,  // AI abstract
    `${U}1518770660439-4636190af475${Q}`,  // futuristic circuit
    `${U}1555255707-c07966088b7b${Q}`,     // neon glow future
  ],
};

const FALLBACK = [
  `${U}1598488035139-bdbb2231ce04${Q}`,
  `${U}1470225620780-dba8ba36b745${Q}`,
  `${U}1516450360452-9312f5e86fc7${Q}`,
  `${U}1493225457124-a3eb161ffa5f${Q}`,
];

/**
 * Returns a real cover image URL. Uses `coverUrl` from DB when available,
 * otherwise picks a deterministic Unsplash photo based on category and slug.
 */
export function getCoverUrl(
  coverUrl: string | null | undefined,
  category: string,
  slug: string
): string {
  if (coverUrl) return coverUrl;
  const pool = CATEGORY_COVERS[category] ?? FALLBACK;
  // Deterministic index from last 2 chars of slug
  const code = slug ? (slug.charCodeAt(slug.length - 1) + (slug.charCodeAt(slug.length - 2) || 0)) : 0;
  return pool[code % pool.length];
}
