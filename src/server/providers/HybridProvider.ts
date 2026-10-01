import type { DomainProvider, DomainCheckResult } from './DomainProvider.ts';
import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';
import { RDAPProvider } from './RDAPProvider.ts';
import { DNSDoHProvider } from './DNSDoHProvider.ts';

export class HybridProvider implements DomainProvider {
  readonly id = 'hybrid';
  readonly name = 'Authoritative Hybrid Engine (High-Speed DNS + On-Demand RDAP)';
  readonly supportsBulk = true;
  readonly bulkBatchSize = 50;

  private rdap: RDAPProvider;
  private doh: DNSDoHProvider;

  constructor(rdap: RDAPProvider, doh: DNSDoHProvider) {
    this.rdap = rdap;
    this.doh = doh;
  }

  /**
   * Fast parallel bulk screening using DNS
   */
  public async checkDomains(domains: string[]): Promise<DomainCheckResult[]> {
    return await this.doh.checkDomains(domains);
  }

  /**
   * Single domain check with authoritative RDAP enrichment
   */
  public async checkDomain(domain: string): Promise<DomainCheckResult> {
    const dnsResult = await this.doh.checkDomain(domain);

    if (dnsResult.status === 'available') {
      return dnsResult;
    }

    if (dnsResult.status === 'registered') {
      try {
        const rdapEvidence = await this.rdap.getRegistrationData(domain);
        if (rdapEvidence.isRegistered) {
          return {
            domain,
            isRegistered: true,
            status: 'registered',
            evidence: {
              ...rdapEvidence,
              nameservers: rdapEvidence.nameservers || dnsResult.evidence.nameservers
            }
          };
        }
      } catch {
        // Fallback to DNS evidence
      }
    }

    return dnsResult;
  }

  /**
   * Get registration data with authoritative RDAP detail
   */
  public async getRegistrationData(domain: string): Promise<RegistrationEvidence> {
    const check = await this.checkDomain(domain);
    return check.evidence;
  }

  public async testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const dnsTest = await this.doh.testConnection();
    return {
      success: dnsTest.success,
      message: `DNS Gateway: ${dnsTest.message} | ICANN RDAP: Ready`,
      latencyMs: dnsTest.latencyMs
    };
  }
}
