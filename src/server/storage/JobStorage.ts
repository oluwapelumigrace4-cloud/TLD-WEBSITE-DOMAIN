import fs from 'fs';
import path from 'path';
import type { JobDetails, JobSummary, DomainAnalysisResult } from '../../types/index.ts';

export class JobStorage {
  private static instance: JobStorage;
  private dataDir = path.resolve(process.cwd(), 'data', 'jobs');
  private indexFile = path.resolve(process.cwd(), 'data', 'jobs_index.json');
  private memoryCache = new Map<string, JobDetails>();
  private indexLock: Promise<void> = Promise.resolve();
  private jobLocks = new Map<string, Promise<void>>();

  private constructor() {
    this.ensureDirs();
  }

  public static getInstance(): JobStorage {
    if (!JobStorage.instance) {
      JobStorage.instance = new JobStorage();
    }
    return JobStorage.instance;
  }

  private ensureDirs() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexFile)) {
      fs.writeFileSync(this.indexFile, JSON.stringify([]), 'utf-8');
    }
  }

  private getJobPath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  public async saveJob(job: JobDetails): Promise<void> {
    this.memoryCache.set(job.id, job);

    // Serialize disk writes per job id so rapid periodic saves never collide
    const previousJobLock = this.jobLocks.get(job.id) || Promise.resolve();
    const currentJobLock = previousJobLock.then(async () => {
      const targetPath = this.getJobPath(job.id);
      const tempPath = `${targetPath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2)}`;

      try {
        await fs.promises.writeFile(tempPath, JSON.stringify(job), 'utf-8');
        await fs.promises.rename(tempPath, targetPath);
      } catch {
        // Fallback to direct write if rename encounters transient error
        try {
          await fs.promises.writeFile(targetPath, JSON.stringify(job), 'utf-8');
        } catch {}
      } finally {
        // Cleanup leftover temp file if exists
        try {
          if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
          }
        } catch {}
      }

      // Update index sequentially
      await this.updateIndex(job);
    }).catch(() => {});

    this.jobLocks.set(job.id, currentJobLock);
    await currentJobLock;
  }

  private async updateIndex(job: JobDetails): Promise<void> {
    const summary: JobSummary = {
      id: job.id,
      name: job.name,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      status: job.status,
      totalDomains: job.totalDomains,
      processedDomains: job.processedDomains,
      successCount: job.successCount,
      errorCount: job.errorCount,
      settings: job.settings,
      stats: job.stats
    };

    // Serialize index file updates with indexLock
    this.indexLock = this.indexLock.then(async () => {
      let indexList: JobSummary[] = [];
      try {
        if (fs.existsSync(this.indexFile)) {
          const raw = await fs.promises.readFile(this.indexFile, 'utf-8');
          indexList = JSON.parse(raw);
        }
      } catch {
        indexList = [];
      }

      const idx = indexList.findIndex(j => j.id === job.id);
      if (idx >= 0) {
        indexList[idx] = summary;
      } else {
        indexList.unshift(summary);
      }

      // Keep top 100 recent jobs in index
      if (indexList.length > 100) {
        indexList = indexList.slice(0, 100);
      }

      const tempIndex = `${this.indexFile}.tmp.${Date.now()}_${Math.random().toString(36).substring(2)}`;
      try {
        await fs.promises.writeFile(tempIndex, JSON.stringify(indexList, null, 2), 'utf-8');
        await fs.promises.rename(tempIndex, this.indexFile);
      } catch {
        // Fallback to direct write if rename fails
        try {
          await fs.promises.writeFile(this.indexFile, JSON.stringify(indexList, null, 2), 'utf-8');
        } catch {}
      } finally {
        try {
          if (fs.existsSync(tempIndex)) {
            await fs.promises.unlink(tempIndex);
          }
        } catch {}
      }
    }).catch(() => {});

    await this.indexLock;
  }

  public async getJob(id: string): Promise<JobDetails | null> {
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    const jobPath = this.getJobPath(id);
    if (!fs.existsSync(jobPath)) {
      return null;
    }

    try {
      const raw = await fs.promises.readFile(jobPath, 'utf-8');
      const job = JSON.parse(raw) as JobDetails;
      this.memoryCache.set(id, job);
      return job;
    } catch {
      return null;
    }
  }

  public async listJobs(): Promise<JobSummary[]> {
    try {
      if (!fs.existsSync(this.indexFile)) return [];
      const raw = await fs.promises.readFile(this.indexFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public async deleteJob(id: string): Promise<boolean> {
    this.memoryCache.delete(id);
    const jobPath = this.getJobPath(id);
    if (fs.existsSync(jobPath)) {
      try {
        await fs.promises.unlink(jobPath);
      } catch {}
    }

    // Update index
    try {
      const raw = await fs.promises.readFile(this.indexFile, 'utf-8');
      let indexList: JobSummary[] = JSON.parse(raw);
      indexList = indexList.filter(j => j.id !== id);
      await fs.promises.writeFile(this.indexFile, JSON.stringify(indexList, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  public generateSummaryCsv(job: JobDetails): string {
    const headers = [
      'input_domain',
      'base_name',
      'tld_count',
      'registered_tlds',
      'related_com_count',
      'related_com_domains',
      'status',
      'last_checked'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.join(',')];

    for (const r of job.results) {
      rows.push([
        escapeCsv(r.inputDomain),
        escapeCsv(r.baseName),
        r.registeredTldCount,
        escapeCsv(r.registeredTlds.join('; ')),
        r.relatedComCount,
        escapeCsv(r.relatedComDomains.join('; ')),
        escapeCsv(r.status),
        escapeCsv(r.checkedAt)
      ].join(','));
    }

    return rows.join('\r\n') + '\r\n';
  }

  public generateDetailedCsv(job: JobDetails): string {
    const headers = [
      'input_domain',
      'base_name',
      'checked_domain',
      'domain_type',
      'status',
      'registrar',
      'creation_date',
      'expiration_date',
      'nameservers',
      'source',
      'checked_at'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.join(',')];

    for (const r of job.results) {
      // 1. TLD footprint items
      for (const t of r.tldResults) {
        rows.push([
          escapeCsv(r.inputDomain),
          escapeCsv(r.baseName),
          escapeCsv(t.fullDomain),
          'TLD_FOOTPRINT',
          escapeCsv(t.status),
          escapeCsv(t.evidence?.registrar || ''),
          escapeCsv(t.evidence?.creationDate || ''),
          escapeCsv(t.evidence?.expirationDate || ''),
          escapeCsv(t.evidence?.nameservers?.join(';') || ''),
          escapeCsv(t.evidence?.source || ''),
          escapeCsv(t.evidence?.checkedAt || r.checkedAt)
        ].join(','));
      }

      // 2. Related .COM items
      for (const rel of r.relatedResults) {
        rows.push([
          escapeCsv(r.inputDomain),
          escapeCsv(r.baseName),
          escapeCsv(rel.domain),
          `RELATED_COM (${rel.pattern})`,
          escapeCsv(rel.status),
          escapeCsv(rel.evidence?.registrar || ''),
          escapeCsv(rel.evidence?.creationDate || ''),
          escapeCsv(rel.evidence?.expirationDate || ''),
          escapeCsv(rel.evidence?.nameservers?.join(';') || ''),
          escapeCsv(rel.evidence?.source || ''),
          escapeCsv(rel.evidence?.checkedAt || r.checkedAt)
        ].join(','));
      }
    }

    return rows.join('\r\n') + '\r\n';
  }
}
