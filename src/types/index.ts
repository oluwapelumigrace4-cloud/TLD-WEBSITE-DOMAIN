export type DomainStatus = 'registered' | 'available' | 'unknown' | 'error';

export interface RegistrationEvidence {
  domain: string;
  isRegistered: boolean | null;
  status: DomainStatus;
  statusDetails?: string[];
  registrar?: string;
  registrarId?: string;
  nameservers?: string[];
  creationDate?: string;
  expirationDate?: string;
  updatedDate?: string;
  dnssec?: boolean;
  source: string;
  checkedAt: string;
  responseTimeMs?: number;
  error?: string;
  rawJson?: any;
}

export interface TLDFootprintItem {
  tld: string;
  fullDomain: string;
  status: DomainStatus;
  evidence?: RegistrationEvidence;
}

export interface RelatedDomainItem {
  domain: string;
  baseName: string;
  variationType: 'prefix' | 'suffix' | 'plural' | 'compound' | 'combo' | 'abbreviation';
  pattern: string;
  status: DomainStatus;
  relevanceScore: number;
  evidence?: RegistrationEvidence;
}

export interface DomainAnalysisResult {
  id: string;
  inputDomain: string;
  normalizedDomain: string;
  baseName: string;
  inputTld: string;
  status: 'complete' | 'processing' | 'queued' | 'error';
  registeredTldCount: number;
  totalTldsChecked: number;
  registeredTlds: string[];
  tldResults: TLDFootprintItem[];
  relatedComCount: number;
  totalRelatedChecked: number;
  relatedComDomains: string[];
  relatedResults: RelatedDomainItem[];
  primaryEvidence?: RegistrationEvidence;
  checkedAt: string;
  error?: string;
}

export interface JobSettings {
  tldList: string[];
  relatedDepth: number; // e.g. 15, 25, 50, 100, 250
  provider: 'hybrid' | 'rdap' | 'dns' | 'whoisxml' | 'godaddy';
  concurrency: number;
  delayMs: number;
  includeWhoisDetails: boolean;
}

export interface JobStats {
  registeredCount: number;
  availableCount: number;
  unknownCount: number;
  errorCount: number;
  avgTldCount: number;
  avgRelatedCount: number;
  reqPerSec: number;
  elapsedMs: number;
  etaSeconds: number;
}

export interface JobSummary {
  id: string;
  name: string;
  createdAt: string;
  completedAt?: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  totalDomains: number;
  processedDomains: number;
  successCount: number;
  errorCount: number;
  settings: JobSettings;
  stats: JobStats;
}

export interface JobDetails extends JobSummary {
  results: DomainAnalysisResult[];
}

export interface ProviderStatusInfo {
  provider: string;
  hasWhoisXmlKey: boolean;
  hasGodaddyKey: boolean;
  rdapAvailable: boolean;
  dnsAvailable: boolean;
  defaultProvider: string;
}
