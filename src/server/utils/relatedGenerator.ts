/**
 * Intelligent related .COM domain variations generator.
 * Generates commercially relevant naming variations, ranks them by relevance,
 * and limits output to the user's requested depth (e.g. 15, 25, 50, 100, 250).
 */

export interface CandidateVariation {
  domain: string;
  baseName: string;
  variationType: 'prefix' | 'suffix' | 'plural' | 'compound' | 'combo' | 'abbreviation';
  pattern: string;
  relevanceScore: number; // Higher is better (e.g. 100 max)
}

// High commercial priority prefixes
const PREFIXES = [
  { p: 'get', weight: 95 },
  { p: 'try', weight: 92 },
  { p: 'use', weight: 89 },
  { p: 'go', weight: 87 },
  { p: 'the', weight: 85 },
  { p: 'my', weight: 83 },
  { p: 'hey', weight: 80 },
  { p: 'join', weight: 79 },
  { p: 'meet', weight: 78 },
  { p: 'we', weight: 75 },
  { p: 'your', weight: 74 },
  { p: 'app', weight: 72 },
  { p: 'open', weight: 70 },
  { p: 'pro', weight: 68 },
  { p: 'smart', weight: 66 },
  { p: 'with', weight: 64 },
  { p: 'best', weight: 62 },
  { p: 'all', weight: 60 }
];

// High commercial priority suffixes
const SUFFIXES = [
  { s: 'hq', weight: 96 },
  { s: 'app', weight: 94 },
  { s: 'ai', weight: 93 },
  { s: 'co', weight: 90 },
  { s: 'io', weight: 88 },
  { s: 'tech', weight: 86 },
  { s: 'labs', weight: 84 },
  { s: 'hub', weight: 82 },
  { s: 'pro', weight: 80 },
  { s: 'group', weight: 78 },
  { s: 'team', weight: 76 },
  { s: 'now', weight: 74 },
  { s: 'online', weight: 72 },
  { s: 'space', weight: 70 },
  { s: 'box', weight: 68 },
  { s: 'club', weight: 66 },
  { s: 'works', weight: 64 },
  { s: 'cloud', weight: 62 },
  { s: 'base', weight: 60 },
  { s: 'zone', weight: 58 },
  { s: 'stack', weight: 56 },
  { s: 'spot', weight: 54 },
  { s: 'link', weight: 52 },
  { s: 'net', weight: 50 }
];

// Common commercial prefix-suffix combinations (for depth >= 50)
const COMBOS = [
  { p: 'get', s: 'hq', weight: 75 },
  { p: 'get', s: 'app', weight: 73 },
  { p: 'the', s: 'app', weight: 71 },
  { p: 'the', s: 'hq', weight: 70 },
  { p: 'my', s: 'app', weight: 69 },
  { p: 'go', s: 'pro', weight: 67 }
];

// Common business abbreviations
const ABBREVIATIONS: Record<string, string> = {
  international: 'intl',
  corporation: 'corp',
  company: 'co',
  technologies: 'tech',
  technology: 'tech',
  solutions: 'sol',
  development: 'dev',
  systems: 'sys',
  network: 'net',
  analytics: 'ai',
  intelligence: 'ai',
  laboratories: 'labs',
  headquarters: 'hq'
};

export function generateRelatedComDomains(baseName: string, maxDepth: number = 25): CandidateVariation[] {
  const cleanBase = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanBase || cleanBase.length < 2) return [];

  const candidates: CandidateVariation[] = [];
  const seenDomains = new Set<string>();

  const addCandidate = (
    prefix: string,
    suffix: string,
    type: CandidateVariation['variationType'],
    pattern: string,
    baseWeight: number
  ) => {
    const candidateName = `${prefix}${cleanBase}${suffix}`;
    const domain = `${candidateName}.com`;

    // Ignore exact same domain or duplicates
    if (domain === `${cleanBase}.com` || seenDomains.has(domain)) return;
    seenDomains.add(domain);

    // Apply length penalty if candidate becomes overly long (> 24 chars)
    let score = baseWeight;
    if (candidateName.length > 20) {
      score -= Math.min(20, (candidateName.length - 20) * 2);
    }

    candidates.push({
      domain,
      baseName: candidateName,
      variationType: type,
      pattern,
      relevanceScore: Math.max(10, score)
    });
  };

  // 1. Prefixes
  for (const { p, weight } of PREFIXES) {
    addCandidate(p, '', 'prefix', `${p}[name]`, weight);
  }

  // 2. Suffixes
  for (const { s, weight } of SUFFIXES) {
    addCandidate('', s, 'suffix', `[name]${s}`, weight);
  }

  // 3. Plural / Singular variations
  if (cleanBase.endsWith('s') && cleanBase.length > 3) {
    // Singular version (e.g. tools -> tool)
    const singular = cleanBase.slice(0, -1);
    const domain = `${singular}.com`;
    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      candidates.push({
        domain,
        baseName: singular,
        variationType: 'plural',
        pattern: 'singular',
        relevanceScore: 91
      });
    }
  } else if (!cleanBase.endsWith('s')) {
    // Plural version (e.g. tool -> tools)
    const plural = `${cleanBase}s`;
    const domain = `${plural}.com`;
    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      candidates.push({
        domain,
        baseName: plural,
        variationType: 'plural',
        pattern: 'plural',
        relevanceScore: 90
      });
    }
  }

  // 4. Common Abbreviations if baseName contains known terms
  for (const [full, abbr] of Object.entries(ABBREVIATIONS)) {
    if (cleanBase.includes(full)) {
      const abbrBase = cleanBase.replace(full, abbr);
      const domain = `${abbrBase}.com`;
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        candidates.push({
          domain,
          baseName: abbrBase,
          variationType: 'abbreviation',
          pattern: `${full} → ${abbr}`,
          relevanceScore: 88
        });
      }
    }
  }

  // 5. Number Variations (e.g. 247, 365, 1, 2)
  const numbers = [
    { n: '247', weight: 65 },
    { n: '365', weight: 62 },
    { n: '1', weight: 58 },
    { n: '2', weight: 55 }
  ];
  for (const { n, weight } of numbers) {
    addCandidate('', n, 'suffix', `[name]${n}`, weight);
  }

  // 6. Compound Combos (get...hq, the...app, etc.)
  for (const { p, s, weight } of COMBOS) {
    const candidateName = `${p}${cleanBase}${s}`;
    const domain = `${candidateName}.com`;
    if (!seenDomains.has(domain)) {
      seenDomains.add(domain);
      candidates.push({
        domain,
        baseName: candidateName,
        variationType: 'combo',
        pattern: `${p}[name]${s}`,
        relevanceScore: weight
      });
    }
  }

  // Sort descending by relevanceScore
  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Return limited to requested depth
  return candidates.slice(0, maxDepth);
}
