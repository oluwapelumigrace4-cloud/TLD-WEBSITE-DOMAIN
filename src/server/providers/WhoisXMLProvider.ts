import type { DomainProvider, DomainCheckResult } from './DomainProvider.ts';
import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';
import { normalizeDomain } from '../utils/domainNormalizer.ts';

export class WhoisXMLProvider implements DomainProvider {
  readonly id = 'whoisxml';
  readonly name = 'WhoisXML Bulk Availability & WHOIS API';
  readonly supportsBulk = true;
  readonly bulkBatchSize = 500; // Can go up to 1,000

  private apiKey: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey.trim() || process.env.WHOISXML_API_KEY || '';
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async checkDomain(domain: string): Promise<DomainCheckResult> {
    const list = await this.checkDomains([domain]);
    return list[0];
  }

  public async checkDomains(domains: string[]): Promise<DomainCheckResult[]> {
    const normalizedList = domains.map(d => normalizeDomain(d).normalized || d.toLowerCase().trim());
    if (!this.apiKey) {
      // Missing API key - return clear configuration status
      return normalizedList.map(domain => ({
        domain,
        isRegistered: null,
        status: 'unknown' as DomainStatus,
        evidence: {
          domain,
          isRegistered: null,
          status: 'unknown' as DomainStatus,
          source: 'WhoisXML API (No API Key Configured)',
          checkedAt: new Date().toISOString(),
          error: 'WHOISXML_API_KEY is not configured in settings or environment'
        }
      }));
    }

    const start = Date.now();
    const results: DomainCheckResult[] = [];

    // Process in batches of up to 500
    for (let i = 0; i < normalizedList.length; i += this.bulkBatchSize) {
      const batch = normalizedList.slice(i, i + this.bulkBatchSize);

      try {
        const res = await fetch(`https://domain-availability.whoisxmlapi.com/api/v1`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            domains: batch,
            mode: 'fast'
          }),
          signal: AbortSignal.timeout(15000)
        });

        const responseTimeMs = Date.now() - start;

        if (res.ok) {
          const json = await res.json();
          const domainAvailability = json.domainInfo || json.domainAvailability || [];

          const resultMap = new Map<string, any>();
          if (Array.isArray(domainAvailability)) {
            for (const item of domainAvailability) {
              const name = item.domainName?.toLowerCase() || item.domain?.toLowerCase();
              if (name) resultMap.set(name, item);
            }
          }

          for (const d of batch) {
            const item = resultMap.get(d);
            if (item) {
              const isAvail = item.domainAvailability === 'AVAILABLE' || item.available === true;
              const isReg = item.domainAvailability === 'UNAVAILABLE' || isAvail === false;
              const status: DomainStatus = isReg ? 'registered' : (isAvail ? 'available' : 'unknown');

              results.push({
                domain: d,
                isRegistered: isReg,
                status,
                evidence: {
                  domain: d,
                  isRegistered: isReg,
                  status,
                  source: 'WhoisXML Bulk Availability API',
                  checkedAt: new Date().toISOString(),
                  responseTimeMs
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
                  source: 'WhoisXML Bulk Availability API',
                  checkedAt: new Date().toISOString(),
                  responseTimeMs,
                  error: 'Domain omitted from batch response'
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
                source: 'WhoisXML Bulk Availability API',
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
              source: 'WhoisXML Bulk Availability API',
              checkedAt: new Date().toISOString(),
              error: err.message || 'API request failed'
            }
          });
        }
      }
    }

    return results;
  }

  public async getRegistrationData(domain: string): Promise<RegistrationEvidence> {
    const normalized = normalizeDomain(domain).normalized || domain.toLowerCase().trim();
    if (!this.apiKey) {
      return {
        domain: normalized,
        isRegistered: null,
        status: 'unknown',
        source: 'WhoisXML WHOIS API',
        checkedAt: new Date().toISOString(),
        error: 'WHOISXML_API_KEY is not configured'
      };
    }

    const start = Date.now();
    try {
      const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${this.apiKey}&domainName=${encodeURIComponent(normalized)}&outputFormat=JSON`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const responseTimeMs = Date.now() - start;

      if (res.ok) {
        const json = await res.json();
        const record = json.WhoisRecord;
        if (!record) {
          return {
            domain: normalized,
            isRegistered: false,
            status: 'available',
            source: 'WhoisXML WHOIS API',
            checkedAt: new Date().toISOString(),
            responseTimeMs
          };
        }

        const isReg = record.dataError !== 'MISSING_WHOIS_DATA';
        const nameservers: string[] = [];
        if (record.nameServers && Array.isArray(record.nameServers.hostNames)) {
          nameservers.push(...record.nameServers.hostNames.map((n: string) => n.toLowerCase()));
        }

        return {
          domain: normalized,
          isRegistered: isReg,
          status: isReg ? 'registered' : 'available',
          registrar: record.registrarName,
          creationDate: record.createdDateNormalized || record.createdDate,
          expirationDate: record.expiresDateNormalized || record.expiresDate,
          updatedDate: record.updatedDateNormalized || record.updatedDate,
          nameservers: nameservers.length > 0 ? nameservers : undefined,
          source: 'WhoisXML Authoritative WHOIS API',
          checkedAt: new Date().toISOString(),
          responseTimeMs,
          rawJson: {
            registryData: record.registryData,
            contactEmail: record.contactEmail
          }
        };
      }

      return {
        domain: normalized,
        isRegistered: null,
        status: 'unknown',
        source: 'WhoisXML WHOIS API',
        checkedAt: new Date().toISOString(),
        responseTimeMs,
        error: `HTTP ${res.status}`
      };
    } catch (e: any) {
      return {
        domain: normalized,
        isRegistered: null,
        status: 'unknown',
        source: 'WhoisXML WHOIS API',
        checkedAt: new Date().toISOString(),
        error: e.message || 'WHOIS query failed'
      };
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    if (!this.apiKey) {
      return { success: false, message: 'No WhoisXML API Key provided. Enter key in Settings.' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`https://domain-availability.whoisxmlapi.com/api/v1?apiKey=${this.apiKey}&domainName=google.com&mode=fast`, {
        signal: AbortSignal.timeout(5000)
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: 'WhoisXML API Key authenticated successfully', latencyMs };
      }
      return { success: false, message: `WhoisXML returned HTTP ${res.status}`, latencyMs };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to reach WhoisXML API' };
    }
  }
}
