import type { DomainProvider, DomainCheckResult } from './DomainProvider.ts';
import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';
import { normalizeDomain } from '../utils/domainNormalizer.ts';

export class GoDaddyProvider implements DomainProvider {
  readonly id = 'godaddy';
  readonly name = 'GoDaddy Bulk Domains API';
  readonly supportsBulk = true;
  readonly bulkBatchSize = 500;

  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string = '', apiSecret: string = '') {
    this.apiKey = apiKey.trim() || process.env.GODADDY_API_KEY || '';
    this.apiSecret = apiSecret.trim() || process.env.GODADDY_API_SECRET || '';
  }

  public setCredentials(key: string, secret: string) {
    this.apiKey = key.trim();
    this.apiSecret = secret.trim();
  }

  public async checkDomain(domain: string): Promise<DomainCheckResult> {
    const list = await this.checkDomains([domain]);
    return list[0];
  }

  public async checkDomains(domains: string[]): Promise<DomainCheckResult[]> {
    const normalizedList = domains.map(d => normalizeDomain(d).normalized || d.toLowerCase().trim());

    if (!this.apiKey || !this.apiSecret) {
      return normalizedList.map(domain => ({
        domain,
        isRegistered: null,
        status: 'unknown' as DomainStatus,
        evidence: {
          domain,
          isRegistered: null,
          status: 'unknown' as DomainStatus,
          source: 'GoDaddy API (Missing Key/Secret)',
          checkedAt: new Date().toISOString(),
          error: 'GODADDY_API_KEY and GODADDY_API_SECRET are required'
        }
      }));
    }

    const start = Date.now();
    const results: DomainCheckResult[] = [];

    for (let i = 0; i < normalizedList.length; i += this.bulkBatchSize) {
      const batch = normalizedList.slice(i, i + this.bulkBatchSize);

      try {
        const res = await fetch(`https://api.godaddy.com/v1/domains/available`, {
          method: 'POST',
          headers: {
            'Authorization': `sso-key ${this.apiKey}:${this.apiSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(15000)
        });

        const responseTimeMs = Date.now() - start;

        if (res.ok) {
          const json = await res.json();
          const items = json.domains || [];
          const map = new Map<string, any>();
          for (const item of items) {
            if (item.domain) map.set(item.domain.toLowerCase(), item);
          }

          for (const d of batch) {
            const match = map.get(d);
            if (match) {
              const isAvail = match.available === true;
              const isReg = !isAvail;
              const status: DomainStatus = isReg ? 'registered' : 'available';
              results.push({
                domain: d,
                isRegistered: isReg,
                status,
                evidence: {
                  domain: d,
                  isRegistered: isReg,
                  status,
                  source: 'GoDaddy Developer API',
                  checkedAt: new Date().toISOString(),
                  responseTimeMs,
                  rawJson: {
                    price: match.price,
                    currency: match.currency,
                    definitive: match.definitive
                  }
                }
              });
            } else {
              results.push({
                domain: d,
                isRegistered: null,
                status: 'unknown',
                evidence: {
                  domain: d,
                  isRegistered: null,
                  status: 'unknown',
                  source: 'GoDaddy Developer API',
                  checkedAt: new Date().toISOString(),
                  responseTimeMs,
                  error: 'Domain not returned in batch'
                }
              });
            }
          }
        } else {
          const errText = await res.text().catch(() => '');
          for (const d of batch) {
            results.push({
              domain: d,
              isRegistered: null,
              status: 'unknown',
              evidence: {
                domain: d,
                isRegistered: null,
                status: 'unknown',
                source: 'GoDaddy Developer API',
                checkedAt: new Date().toISOString(),
                responseTimeMs,
                error: `HTTP ${res.status}: ${errText.slice(0, 100)}`
              }
            });
          }
        }
      } catch (err: any) {
        for (const d of batch) {
          results.push({
            domain: d,
            isRegistered: null,
            status: 'error',
            evidence: {
              domain: d,
              isRegistered: null,
              status: 'error',
              source: 'GoDaddy Developer API',
              checkedAt: new Date().toISOString(),
              error: err.message || 'Network request failed'
            }
          });
        }
      }
    }

    return results;
  }

  public async getRegistrationData(domain: string): Promise<RegistrationEvidence> {
    const check = await this.checkDomain(domain);
    return check.evidence;
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.apiKey || !this.apiSecret) {
      return { success: false, message: 'Please provide both GoDaddy API Key and Secret' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`https://api.godaddy.com/v1/domains/available?domain=google.com`, {
        headers: {
          'Authorization': `sso-key ${this.apiKey}:${this.apiSecret}`
        },
        signal: AbortSignal.timeout(5000)
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: 'GoDaddy Developer API Key authenticated successfully', latencyMs };
      }
      return { success: false, message: `GoDaddy returned HTTP ${res.status}`, latencyMs };
    } catch (e: any) {
      return { success: false, message: e.message || 'GoDaddy connection failed' };
    }
  }
}
