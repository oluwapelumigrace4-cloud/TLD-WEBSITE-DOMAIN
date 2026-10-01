import type { RegistrationEvidence, DomainStatus } from '../../types/index.ts';

export interface DomainCheckResult {
  domain: string;
  isRegistered: boolean | null;
  status: DomainStatus;
  evidence: RegistrationEvidence;
}

export interface DomainProvider {
  readonly id: string;
  readonly name: string;
  readonly supportsBulk: boolean;
  readonly bulkBatchSize: number;

  /**
   * Check single domain availability / registration status
   */
  checkDomain(domain: string): Promise<DomainCheckResult>;

  /**
   * Check multiple domains in batches
   */
  checkDomains(domains: string[]): Promise<DomainCheckResult[]>;

  /**
   * Get full authoritative registration data (registrar, dates, nameservers, status flags)
   */
  getRegistrationData(domain: string): Promise<RegistrationEvidence>;

  /**
   * Test API connectivity / key validity
   */
  testConnection(): Promise<{ success: boolean; message: string; latencyMs?: number }>;
}
