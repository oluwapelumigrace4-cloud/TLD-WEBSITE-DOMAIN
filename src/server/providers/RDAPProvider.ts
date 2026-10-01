import type { DomainProvider, DomainCheckResult } from './DomainProvider.ts';
import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';
import { normalizeDomain } from '../utils/domainNormalizer.ts';

interface IanaBootstrapEntry {
  tlds: string[];
  urls: string[];
}

export class RDAPProvider implements DomainProvider {
  readonly id = 'rdap';
  readonly name = 'Authoritative ICANN RDAP';
  readonly supportsBulk = false;
  readonly bulkBatchSize = 1;

  private cache = new Map<string, { data: RegistrationEvidence; expires: number }>();
  private bootstrapMap = new Map<string, string>();
  private bootstrapLoaded = false;
  private lastRequestTime = 0;
  private minIntervalMs = 250; // Max 4 requests/sec to prevent registry 429

  constructor(minIntervalMs: number = 250) {
    this.minIntervalMs = minIntervalMs;
    this.seedKnownRdapEndpoints();
  }

  private seedKnownRdapEndpoints() {
    // Fast-path known registries to avoid bootstrap roundtrip
    const verisign = 'https://rdap.verisign.com/com/v1/';
    this.bootstrapMap.set('com', verisign);
    this.bootstrapMap.set('net', verisign);
    this.bootstrapMap.set('org', 'https://rdap.publicinterestregistry.org/rdap/');
    this.bootstrapMap.set('info', 'https://rdap.identitydigital.services/rdap/');
    this.bootstrapMap.set('pro', 'https://rdap.identitydigital.services/rdap/');
    this.bootstrapMap.set('biz', 'https://rdap.godaddy.com/v1/');
    this.bootstrapMap.set('co', 'https://rdap.identitydigital.services/rdap/');
    this.bootstrapMap.set('app', 'https://rdap.nic.google/');
    this.bootstrapMap.set('dev', 'https://rdap.nic.google/');
    this.bootstrapMap.set('page', 'https://rdap.nic.google/');
    this.bootstrapMap.set('xyz', 'https://rdap.centralnic.com/');
    this.bootstrapMap.set('tech', 'https://rdap.centralnic.com/');
    this.bootstrapMap.set('online', 'https://rdap.centralnic.com/');
    this.bootstrapMap.set('site', 'https://rdap.centralnic.com/');
    this.bootstrapMap.set('store', 'https://rdap.centralnic.com/');
    this.bootstrapMap.set('io', 'https://rdap.nic.io/');
    this.bootstrapMap.set('ai', 'https://rdap.org/'); // Delegated to rdap.org proxy
    this.bootstrapMap.set('me', 'https://rdap.identitydigital.services/rdap/');
    this.bootstrapMap.set('us', 'https://rdap.identitydigital.services/rdap/');
    this.bootstrapMap.set('cloud', 'https://rdap.identitydigital.services/rdap/');
  }

  public async loadIanaBootstrap(): Promise<void> {
    if (this.bootstrapLoaded) return;
    try {
      const res = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.services)) {
          for (const service of json.services) {
            const tlds: string[] = service[0];
            const urls: string[] = service[1];
            if (urls && urls.length > 0) {
              const url = urls[0].endsWith('/') ? urls[0] : `${urls[0]}/`;
              for (const tld of tlds) {
                this.bootstrapMap.set(tld.toLowerCase(), url);
              }
            }
          }
        }
        this.bootstrapLoaded = true;
      }
    } catch {
      // Fallback to seeded endpoints & rdap.org
      this.bootstrapLoaded = true;
    }
  }

  private async rateLimitDelay() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < this.minIntervalMs) {
      await new Promise(r => setTimeout(r, this.minIntervalMs - timeSinceLast));
    }
    this.lastRequestTime = Date.now();
  }

  private getRdapBaseUrl(tld: string): string {
    const mapped = this.bootstrapMap.get(tld.toLowerCase());
    if (mapped) return mapped;
    return 'https://rdap.org/';
  }

  public async getRegistrationData(domain: string): Promise<RegistrationEvidence> {
    const normalized = normalizeDomain(domain).normalized || domain.toLowerCase().trim();
    const tld = normalized.split('.').pop() || 'com';

    // Check cache (TTL 30 minutes)
    const cached = this.cache.get(normalized);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    await this.rateLimitDelay();

    const startTime = Date.now();
    const baseUrl = this.getRdapBaseUrl(tld);
    const targetUrl = baseUrl.includes('/v1/') || baseUrl.endsWith('domain/')
      ? `${baseUrl}domain/${normalized}`
      : `${baseUrl}domain/${normalized}`;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/rdap+json, application/json',
          'User-Agent': 'DotFootprint-DomainResearch/1.0 (+https://dotfootprint.local)'
        },
        signal: AbortSignal.timeout(6500)
      });

      const responseTimeMs = Date.now() - startTime;

      if (response.status === 200) {
        const json = await response.json();
        const evidence = this.parseRdapJson(json, normalized, responseTimeMs, baseUrl);
        this.cache.set(normalized, { data: evidence, expires: Date.now() + 30 * 60 * 1000 });
        return evidence;
      } else if (response.status === 404) {
        // Authoritatively available / unregistered
        const evidence: RegistrationEvidence = {
          domain: normalized,
          isRegistered: false,
          status: 'available',
          source: `Authoritative RDAP (${new URL(baseUrl).hostname})`,
          checkedAt: new Date().toISOString(),
          responseTimeMs
        };
        this.cache.set(normalized, { data: evidence, expires: Date.now() + 30 * 60 * 1000 });
        return evidence;
      } else if (response.status === 429) {
        return {
          domain: normalized,
          isRegistered: null,
          status: 'unknown',
          source: `RDAP (${new URL(baseUrl).hostname})`,
          checkedAt: new Date().toISOString(),
          responseTimeMs,
          error: 'Rate limit (HTTP 429) from registry'
        };
      } else {
        return {
          domain: normalized,
          isRegistered: null,
          status: 'unknown',
          source: `RDAP (${new URL(baseUrl).hostname})`,
          checkedAt: new Date().toISOString(),
          responseTimeMs,
          error: `Registry returned HTTP ${response.status}`
        };
      }
    } catch (err: any) {
      const responseTimeMs = Date.now() - startTime;
      return {
        domain: normalized,
        isRegistered: null,
        status: 'unknown',
        source: 'RDAP Resolver',
        checkedAt: new Date().toISOString(),
        responseTimeMs,
        error: err.name === 'TimeoutError' ? 'RDAP query timed out' : (err.message || 'Network error')
      };
    }
  }

  private parseRdapJson(json: any, domain: string, responseTimeMs: number, baseUrl: string): RegistrationEvidence {
    let registrar: string | undefined;
    let registrarId: string | undefined;
    let creationDate: string | undefined;
    let expirationDate: string | undefined;
    let updatedDate: string | undefined;
    const nameservers: string[] = [];
    const statusDetails: string[] = [];

    // Parse status
    if (Array.isArray(json.status)) {
      statusDetails.push(...json.status);
    }

    // Parse events (registration, expiration, last changed)
    if (Array.isArray(json.events)) {
      for (const ev of json.events) {
        if (ev.eventAction === 'registration') creationDate = ev.eventDate;
        if (ev.eventAction === 'expiration') expirationDate = ev.eventDate;
        if (ev.eventAction === 'last changed' || ev.eventAction === 'last update') updatedDate = ev.eventDate;
      }
    }

    // Parse nameservers
    if (Array.isArray(json.nameservers)) {
      for (const ns of json.nameservers) {
        if (ns.ldhName) nameservers.push(ns.ldhName.toLowerCase());
      }
    }

    // Parse entities for registrar
    if (Array.isArray(json.entities)) {
      for (const entity of json.entities) {
        if (Array.isArray(entity.roles) && entity.roles.includes('registrar')) {
          if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
            const fnItem = entity.vcardArray[1].find((item: any) => item[0] === 'fn');
            if (fnItem && fnItem[3]) {
              registrar = String(fnItem[3]);
            }
          }
          if (!registrar && entity.handle) {
            registrar = entity.handle;
          }
          if (entity.publicIds && Array.isArray(entity.publicIds)) {
            const ianaId = entity.publicIds.find((p: any) => p.type === 'IANA Registrar ID');
            if (ianaId) registrarId = String(ianaId.identifier);
          }
        }
      }
    }

    const host = new URL(baseUrl).hostname;
    return {
      domain,
      isRegistered: true,
      status: 'registered',
      statusDetails,
      registrar: registrar || 'Registered (RDAP)',
      registrarId,
      nameservers: nameservers.length > 0 ? nameservers : undefined,
      creationDate,
      expirationDate,
      updatedDate,
      dnssec: json.secureDNS?.delegationSigned || false,
      source: `Authoritative RDAP (${host})`,
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      rawJson: {
        handle: json.handle,
        status: json.status,
        events: json.events,
        nameservers: nameservers
      }
    };
  }

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
    const results: DomainCheckResult[] = [];
    for (const domain of domains) {
      results.push(await this.checkDomain(domain));
    }
    return results;
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const res = await fetch('https://rdap.verisign.com/com/v1/domain/google.com', {
        headers: { 'Accept': 'application/rdap+json' },
        signal: AbortSignal.timeout(5000)
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: 'ICANN RDAP registry gateway online (Verisign/IANA)', latencyMs };
      }
      return { success: false, message: `RDAP gateway returned HTTP ${res.status}`, latencyMs };
    } catch (e: any) {
      return { success: false, message: e.message || 'RDAP connection failed' };
    }
  }
}
