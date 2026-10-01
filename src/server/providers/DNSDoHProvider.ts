import type { DomainProvider, DomainCheckResult } from './DomainProvider.ts';
import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';
import { normalizeDomain } from '../utils/domainNormalizer.ts';
import dns from 'dns';

const dnsPromises = dns.promises;

// Use Google / Cloudflare public resolvers as primary fast DNS servers for Node
try {
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4']);
} catch {
  // Use default OS resolvers if setServers is restricted
}

export class DNSDoHProvider implements DomainProvider {
  readonly id = 'dns';
  readonly name = 'Authoritative DNS / DoH';
  readonly supportsBulk = true;
  readonly bulkBatchSize = 50;

  private dohEndpoint = 'https://cloudflare-dns.com/dns-query';
  private cache = new Map<string, { evidence: RegistrationEvidence; expires: number }>();

  public async checkDomain(domain: string): Promise<DomainCheckResult> {
    const evidence = await this.getRegistrationData(domain);
    return {
      domain: evidence.domain,
      isRegistered: evidence.isRegistered,
      status: evidence.status,
      evidence
    };
  }

  public async checkDomains(domains: string[]): Promise<DomainCheckResult[]> {
    // Parallel resolution across all domains in chunk with concurrency
    return await Promise.all(domains.map(d => this.checkDomain(d)));
  }

  public async getRegistrationData(domain: string): Promise<RegistrationEvidence> {
    const normalized = normalizeDomain(domain).normalized || domain.toLowerCase().trim();

    const cached = this.cache.get(normalized);
    if (cached && cached.expires > Date.now()) {
      return cached.evidence;
    }

    const start = Date.now();

    // 1. Fast Native DNS resolution (1-5ms)
    try {
      // Check NS records first
      const nsList = await dnsPromises.resolveNs(normalized);
      const responseTimeMs = Date.now() - start;

      const evidence: RegistrationEvidence = {
        domain: normalized,
        isRegistered: true,
        status: 'registered',
        nameservers: nsList.map(ns => ns.toLowerCase()),
        source: 'Authoritative DNS (Delegated NS)',
        checkedAt: new Date().toISOString(),
        responseTimeMs
      };

      this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
      return evidence;
    } catch (err: any) {
      // If code is ENOTFOUND or ENODATA, check SOA or A to be 100% sure
      if (err.code === 'ENOTFOUND') {
        const responseTimeMs = Date.now() - start;
        const evidence: RegistrationEvidence = {
          domain: normalized,
          isRegistered: false,
          status: 'available',
          source: 'Authoritative DNS (NXDOMAIN)',
          checkedAt: new Date().toISOString(),
          responseTimeMs
        };
        this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
        return evidence;
      }

      if (err.code === 'ENODATA') {
        // Domain exists in zone but has no NS directly on subname (e.g. has A or MX or SOA)
        try {
          const soa = await dnsPromises.resolveSoa(normalized);
          const responseTimeMs = Date.now() - start;
          const evidence: RegistrationEvidence = {
            domain: normalized,
            isRegistered: true,
            status: 'registered',
            nameservers: soa.nsname ? [soa.nsname.toLowerCase()] : undefined,
            source: 'Authoritative DNS (SOA Record)',
            checkedAt: new Date().toISOString(),
            responseTimeMs
          };
          this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
          return evidence;
        } catch {
          // Check A record
          try {
            const ips = await dnsPromises.resolve4(normalized);
            if (ips.length > 0) {
              const responseTimeMs = Date.now() - start;
              const evidence: RegistrationEvidence = {
                domain: normalized,
                isRegistered: true,
                status: 'registered',
                source: 'Authoritative DNS (A Record)',
                checkedAt: new Date().toISOString(),
                responseTimeMs
              };
              this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
              return evidence;
            }
          } catch {}
        }
      }
    }

    // 2. Fallback to Cloudflare DoH if native DNS timed out or had temporary SERVFAIL
    try {
      const url = `${this.dohEndpoint}?name=${encodeURIComponent(normalized)}&type=NS`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: AbortSignal.timeout(1500)
      });

      if (res.ok) {
        const json = await res.json();
        const responseTimeMs = Date.now() - start;
        const status = json.Status; // 0 = NOERROR, 3 = NXDOMAIN

        if (status === 3) {
          const evidence: RegistrationEvidence = {
            domain: normalized,
            isRegistered: false,
            status: 'available',
            source: 'Cloudflare DoH (NXDOMAIN)',
            checkedAt: new Date().toISOString(),
            responseTimeMs
          };
          this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
          return evidence;
        }

        if (status === 0) {
          const nameservers: string[] = [];
          if (Array.isArray(json.Answer)) {
            for (const ans of json.Answer) {
              if (ans.type === 2 && ans.data) {
                nameservers.push(ans.data.replace(/\.$/, '').toLowerCase());
              }
            }
          }
          const evidence: RegistrationEvidence = {
            domain: normalized,
            isRegistered: true,
            status: 'registered',
            nameservers: nameservers.length > 0 ? nameservers : undefined,
            source: 'Cloudflare DoH (Active Zone)',
            checkedAt: new Date().toISOString(),
            responseTimeMs
          };
          this.cache.set(normalized, { evidence, expires: Date.now() + 60 * 60 * 1000 });
          return evidence;
        }
      }
    } catch {}

    const responseTimeMs = Date.now() - start;
    return {
      domain: normalized,
      isRegistered: null,
      status: 'unknown',
      source: 'DNS / DoH Resolver',
      checkedAt: new Date().toISOString(),
      responseTimeMs
    };
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      await dnsPromises.resolveNs('google.com');
      const latencyMs = Date.now() - start;
      return { success: true, message: 'High-speed Authoritative DNS resolver online (1.1.1.1 / 8.8.8.8)', latencyMs };
    } catch (e: any) {
      return { success: false, message: e.message || 'DNS resolution failed' };
    }
  }
}
