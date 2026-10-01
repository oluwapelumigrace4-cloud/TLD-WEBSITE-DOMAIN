/**
 * Domain normalization and parsing utility.
 * Handles messy inputs, URLs, multi-part TLDs (e.g. .co.uk, .com.au),
 * and isolates the registrable base name.
 */

// Common two-part TLD suffixes
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz', 'school.nz',
  'co.za', 'org.za', 'net.za', 'web.za',
  'com.br', 'net.br', 'org.br', 'gov.br', 'art.br',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.sg', 'edu.sg', 'gov.sg', 'net.sg', 'org.sg',
  'com.mx', 'org.mx', 'net.mx', 'edu.mx', 'gob.mx',
  'com.tr', 'org.tr', 'net.tr', 'edu.tr',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
  'com.ar', 'org.ar', 'net.ar',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.hk', 'org.hk', 'net.hk', 'idv.hk',
  'com.tw', 'org.tw', 'idv.tw',
  'co.kr', 'ne.kr', 'or.kr', 're.kr'
]);

export interface NormalizedDomain {
  raw: string;
  normalized: string;
  baseName: string;
  tld: string;
  isValid: boolean;
  error?: string;
}

export function normalizeDomain(rawInput: string): NormalizedDomain {
  if (!rawInput || typeof rawInput !== 'string') {
    return { raw: rawInput, normalized: '', baseName: '', tld: '', isValid: false, error: 'Empty input' };
  }

  let cleaned = rawInput.trim().toLowerCase();

  // Strip protocols
  cleaned = cleaned.replace(/^[a-z]+:\/\//, '');

  // Strip basic auth if present (user:pass@)
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@').pop() || '';
  }

  // Strip path, query params, hash
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.split(':')[0]; // strip port if any

  // Strip leading www. or m.
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/^m\./, '');

  // Remove trailing dots
  cleaned = cleaned.replace(/\.+$/, '');

  if (!cleaned) {
    return { raw: rawInput, normalized: '', baseName: '', tld: '', isValid: false, error: 'No valid host found' };
  }

  const parts = cleaned.split('.').filter(Boolean);

  if (parts.length < 2) {
    // Single word without TLD (e.g. "example") - assume .com for convenience or treat baseName as input
    return {
      raw: rawInput,
      normalized: `${cleaned}.com`,
      baseName: cleaned,
      tld: 'com',
      isValid: true
    };
  }

  // Check for multi-part TLD (e.g. example.co.uk)
  let tld = '';
  let baseName = '';

  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (MULTI_PART_TLDS.has(lastTwo)) {
      tld = lastTwo;
      // The registrable base name is the part immediately preceding the multi-part TLD
      baseName = parts[parts.length - 3];
    }
  }

  if (!tld) {
    tld = parts[parts.length - 1];
    baseName = parts[parts.length - 2];
  }

  // Validate characters (standard domain labels)
  const isValidBase = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(baseName);
  const isValidTld = /^[a-z0-9-]{2,24}(\.[a-z0-9-]{2,24})?$/.test(tld);

  const fullDomain = `${baseName}.${tld}`;

  return {
    raw: rawInput,
    normalized: fullDomain,
    baseName,
    tld,
    isValid: isValidBase && isValidTld,
    error: !isValidBase ? 'Invalid base domain name' : (!isValidTld ? 'Invalid TLD' : undefined)
  };
}

export function parseBulkDomains(rawText: string, maxLimit = 5000): {
  normalized: NormalizedDomain[];
  validCount: number;
  invalidCount: number;
  duplicatesRemoved: number;
} {
  if (!rawText) {
    return { normalized: [], validCount: 0, invalidCount: 0, duplicatesRemoved: 0 };
  }

  // Split on newlines, commas, or semicolons
  const lines = rawText.split(/[\r\n,;]+/);
  const seen = new Set<string>();
  const normalizedList: NormalizedDomain[] = [];
  let duplicates = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line contains CSV quotes or header
    if (trimmed.toLowerCase().includes('domain') && trimmed.toLowerCase().includes('name') && lines.indexOf(line) === 0) {
      continue; // Skip header
    }

    const norm = normalizeDomain(trimmed);
    if (!norm.isValid) {
      normalizedList.push(norm);
      continue;
    }

    if (seen.has(norm.normalized)) {
      duplicates++;
      continue;
    }

    seen.add(norm.normalized);
    normalizedList.push(norm);

    if (normalizedList.length >= maxLimit) {
      break;
    }
  }

  const validCount = normalizedList.filter(d => d.isValid).length;
  const invalidCount = normalizedList.length - validCount;

  return {
    normalized: normalizedList,
    validCount,
    invalidCount,
    duplicatesRemoved: duplicates
  };
}
