import type { JobDetails, DomainAnalysisResult, TLDFootprintItem, RelatedDomainItem, JobStats, DomainStatus } from '../../types/index.ts';
import { JobStorage } from '../storage/JobStorage.ts';
import { ProviderRegistry } from '../providers/ProviderRegistry.ts';
import { generateRelatedComDomains } from '../utils/relatedGenerator.ts';
import type { NormalizedDomain } from '../utils/domainNormalizer.ts';

export class JobQueue {
  private static instance: JobQueue;
  private storage = JobStorage.getInstance();
  private registry = ProviderRegistry.getInstance();

  private activeJobs = new Map<string, {
    job: JobDetails;
    paused: boolean;
    cancelled: boolean;
    startTime: number;
    lastSaveTime: number;
  }>();

  private constructor() {}

  public static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  public async startJob(
    jobId: string,
    jobName: string,
    domains: NormalizedDomain[],
    settings: JobDetails['settings']
  ): Promise<JobDetails> {
    const initialResults: DomainAnalysisResult[] = domains.map((d, index) => ({
      id: `${jobId}_${index}`,
      inputDomain: d.raw,
      normalizedDomain: d.normalized,
      baseName: d.baseName,
      inputTld: d.tld,
      status: 'queued',
      registeredTldCount: 0,
      totalTldsChecked: settings.tldList.length,
      registeredTlds: [],
      tldResults: [],
      relatedComCount: 0,
      totalRelatedChecked: 0,
      relatedComDomains: [],
      relatedResults: [],
      checkedAt: ''
    }));

    const initialStats: JobStats = {
      registeredCount: 0,
      availableCount: 0,
      unknownCount: 0,
      errorCount: 0,
      avgTldCount: 0,
      avgRelatedCount: 0,
      reqPerSec: 0,
      elapsedMs: 0,
      etaSeconds: 0
    };

    const job: JobDetails = {
      id: jobId,
      name: jobName,
      createdAt: new Date().toISOString(),
      status: 'running',
      totalDomains: domains.length,
      processedDomains: 0,
      successCount: 0,
      errorCount: 0,
      settings,
      stats: initialStats,
      results: initialResults
    };

    // Store in active jobs map immediately for instant memory-access by API
    this.activeJobs.set(jobId, {
      job,
      paused: false,
      cancelled: false,
      startTime: Date.now(),
      lastSaveTime: Date.now()
    });

    // Save initial state to disk asynchronously (do not block startJob return)
    this.storage.saveJob(job).catch(() => {});

    // Kick off background execution loop immediately
    setImmediate(() => {
      this.processJobLoop(jobId).catch(err => {
        console.error(`[JobQueue] Fatal job failure for ${jobId}:`, err);
      });
    });

    return job;
  }

  public pauseJob(jobId: string): boolean {
    const active = this.activeJobs.get(jobId);
    if (active && active.job.status === 'running') {
      active.paused = true;
      active.job.status = 'paused';
      this.storage.saveJob(active.job).catch(() => {});
      return true;
    }
    return false;
  }

  public resumeJob(jobId: string): boolean {
    const active = this.activeJobs.get(jobId);
    if (active && active.job.status === 'paused') {
      active.paused = false;
      active.job.status = 'running';
      this.storage.saveJob(active.job).catch(() => {});
      this.processJobLoop(jobId).catch(err => {
        console.error(`[JobQueue] Resume failed for ${jobId}:`, err);
      });
      return true;
    }
    return false;
  }

  public cancelJob(jobId: string): boolean {
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.cancelled = true;
      active.job.status = 'cancelled';
      active.job.completedAt = new Date().toISOString();
      this.storage.saveJob(active.job).catch(() => {});
      this.activeJobs.delete(jobId);
      return true;
    }
    return false;
  }

  public getActiveJob(jobId: string): JobDetails | null {
    const active = this.activeJobs.get(jobId);
    if (active) return active.job;
    return null;
  }

  private async processJobLoop(jobId: string) {
    const active = this.activeJobs.get(jobId);
    if (!active) return;

    const { job } = active;
    const provider = this.registry.getProvider(job.settings.provider);

    // Dynamic concurrency: 10-25 workers for high throughput
    const concurrency = Math.max(5, Math.min(30, job.settings.concurrency || 15));

    let nextIndex = job.results.findIndex(r => r.status === 'queued');
    if (nextIndex === -1) {
      this.markJobCompleted(active);
      return;
    }

    const activeWorkers = new Set<Promise<void>>();

    while (nextIndex < job.results.length) {
      if (active.cancelled) break;
      if (active.paused) {
        await this.storage.saveJob(job).catch(() => {});
        return;
      }

      if (activeWorkers.size < concurrency) {
        const itemIndex = nextIndex;
        nextIndex++;

        const workerPromise = this.processSingleDomainItem(active, itemIndex, provider)
          .finally(() => {
            activeWorkers.delete(workerPromise);
          });

        activeWorkers.add(workerPromise);
      } else {
        await Promise.race(activeWorkers);
      }

      // Periodically persist progress (every 1.5 seconds or every 50 domains)
      if (Date.now() - active.lastSaveTime > 1500 || job.processedDomains % 50 === 0) {
        this.updateJobStats(active);
        this.storage.saveJob(job).catch(() => {});
        active.lastSaveTime = Date.now();
      }
    }

    await Promise.all(activeWorkers);

    if (!active.cancelled && !active.paused) {
      this.markJobCompleted(active);
    }
  }

  private async processSingleDomainItem(
    active: { job: JobDetails; paused: boolean; cancelled: boolean; startTime: number },
    index: number,
    provider: any
  ): Promise<void> {
    const item = active.job.results[index];
    if (!item || item.status !== 'queued') return;

    item.status = 'processing';

    try {
      const baseName = item.baseName || item.normalizedDomain.split('.')[0];
      const tldList = active.job.settings.tldList || ['com', 'net', 'org', 'ai', 'io'];
      const relatedDepth = active.job.settings.relatedDepth || 20;

      // 1. Generate TLD targets to test
      const tldTargets = tldList.map(tld => `${baseName}.${tld.replace(/^\./, '')}`);

      // 2. Generate related .com targets
      const relatedCandidates = generateRelatedComDomains(baseName, relatedDepth);
      const relatedTargets = relatedCandidates.map(c => c.domain);

      // 3. Check all targets in ONE high-speed parallel batch
      const allTargets = [...tldTargets, ...relatedTargets];
      const checkResults = await provider.checkDomains(allTargets);

      // Map lookup results by domain
      const resultMap = new Map<string, any>();
      for (const res of checkResults) {
        if (res && res.domain) {
          resultMap.set(res.domain.toLowerCase(), res);
        }
      }

      // 4. Build compact TLD Footprint items
      const registeredTlds: string[] = [];
      const tldItems: TLDFootprintItem[] = tldList.map(tld => {
        const fullDomain = `${baseName}.${tld.replace(/^\./, '')}`;
        const res = resultMap.get(fullDomain.toLowerCase());
        const status: DomainStatus = res?.status || 'unknown';
        const tldLabel = tld.startsWith('.') ? tld : `.${tld}`;

        if (status === 'registered') {
          registeredTlds.push(tldLabel);
        }

        return {
          tld: tldLabel,
          fullDomain,
          status,
          evidence: res?.evidence ? {
            domain: fullDomain,
            isRegistered: res.isRegistered,
            status: res.status,
            source: res.evidence.source,
            checkedAt: res.evidence.checkedAt,
            nameservers: res.evidence.nameservers,
            responseTimeMs: res.evidence.responseTimeMs
          } : undefined
        };
      });

      // 5. Build compact Related .COM items
      const registeredRelated: string[] = [];
      const relatedItems: RelatedDomainItem[] = relatedCandidates.map(cand => {
        const res = resultMap.get(cand.domain.toLowerCase());
        const status: DomainStatus = res?.status || 'unknown';

        if (status === 'registered') {
          registeredRelated.push(cand.domain);
        }

        return {
          domain: cand.domain,
          baseName: cand.baseName,
          variationType: cand.variationType,
          pattern: cand.pattern,
          status,
          relevanceScore: cand.relevanceScore,
          evidence: res?.evidence ? {
            domain: cand.domain,
            isRegistered: res.isRegistered,
            status: res.status,
            source: res.evidence.source,
            checkedAt: res.evidence.checkedAt,
            nameservers: res.evidence.nameservers,
            responseTimeMs: res.evidence.responseTimeMs
          } : undefined
        };
      });

      // 6. Update item with clean, compact arrays
      item.status = 'complete';
      item.registeredTldCount = registeredTlds.length;
      item.registeredTlds = registeredTlds;
      item.tldResults = tldItems;
      item.totalTldsChecked = tldItems.length;

      item.relatedComCount = registeredRelated.length;
      item.relatedComDomains = registeredRelated;
      item.relatedResults = relatedItems;
      item.totalRelatedChecked = relatedItems.length;

      item.checkedAt = new Date().toISOString();

      active.job.processedDomains++;
      active.job.successCount++;
    } catch (err: any) {
      item.status = 'error';
      item.error = err.message || 'Processing failed';
      item.checkedAt = new Date().toISOString();
      active.job.processedDomains++;
      active.job.errorCount++;
    }
  }

  private updateJobStats(active: { job: JobDetails; startTime: number }) {
    const { job, startTime } = active;
    const elapsedMs = Math.max(1, Date.now() - startTime);
    const processed = job.processedDomains;
    const reqPerSec = processed > 0 ? (processed / (elapsedMs / 1000)) : 0;
    const remaining = Math.max(0, job.totalDomains - processed);
    const etaSeconds = reqPerSec > 0 ? Math.round(remaining / reqPerSec) : 0;

    let totalTld = 0;
    let totalRelated = 0;
    let regCount = 0;
    let availCount = 0;
    let errCount = 0;

    for (let i = 0; i < processed; i++) {
      const r = job.results[i];
      if (r) {
        if (r.status === 'complete') {
          totalTld += r.registeredTldCount;
          totalRelated += r.relatedComCount;
          if (r.registeredTldCount > 0) regCount++;
          else availCount++;
        } else if (r.status === 'error') {
          errCount++;
        }
      }
    }

    job.stats = {
      registeredCount: regCount,
      availableCount: availCount,
      unknownCount: 0,
      errorCount: errCount,
      avgTldCount: processed > 0 ? Math.round((totalTld / processed) * 10) / 10 : 0,
      avgRelatedCount: processed > 0 ? Math.round((totalRelated / processed) * 10) / 10 : 0,
      reqPerSec: Math.round(reqPerSec * 10) / 10,
      elapsedMs,
      etaSeconds
    };
  }

  private async markJobCompleted(active: { job: JobDetails; startTime: number }) {
    active.job.status = 'completed';
    active.job.completedAt = new Date().toISOString();
    this.updateJobStats(active);
    await this.storage.saveJob(active.job).catch(() => {});
    // Keep in memory map for 15 minutes for lightning fast UI access
    setTimeout(() => {
      this.activeJobs.delete(active.job.id);
    }, 15 * 60 * 1000);
  }
}
