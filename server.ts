import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { parseBulkDomains, normalizeDomain } from './src/server/utils/domainNormalizer.ts';
import { ProviderRegistry } from './src/server/providers/ProviderRegistry.ts';
import { JobStorage } from './src/server/storage/JobStorage.ts';
import { JobQueue } from './src/server/queue/JobQueue.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function createServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const registry = ProviderRegistry.getInstance();
  const storage = JobStorage.getInstance();
  const queue = JobQueue.getInstance();

  // --------------------------------------------------------------------------
  // API Routes
  // --------------------------------------------------------------------------

  // System & Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Providers Status & Test
  app.get('/api/providers', (req, res) => {
    res.json(registry.getStatus());
  });

  app.post('/api/providers/config', (req, res) => {
    const { whoisxmlKey, godaddyKey, godaddySecret, activeProvider } = req.body;
    registry.updateCredentials({
      whoisxmlKey,
      godaddyKey,
      godaddySecret,
      activeProvider
    });
    res.json({ success: true, status: registry.getStatus() });
  });

  app.post('/api/providers/test', async (req, res) => {
    const { providerId } = req.body;
    try {
      const provider = registry.getProvider(providerId);
      const result = await provider.testConnection();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Test failed' });
    }
  });

  // Quick Single Domain Inspection
  app.post('/api/quick-inspect', async (req, res) => {
    const { domain, providerId } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain name is required' });
    }
    try {
      const provider = registry.getProvider(providerId);
      const evidence = await provider.getRegistrationData(domain);
      res.json({ success: true, evidence });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Inspection failed' });
    }
  });

  // Jobs: Create new bulk job
  app.post('/api/jobs', async (req, res) => {
    try {
      const {
        name,
        rawDomains,
        tldList = ['com', 'net', 'org', 'ai', 'io', 'co', 'app', 'dev', 'xyz', 'tech'],
        relatedDepth = 25,
        provider = 'hybrid',
        concurrency = 5,
        delayMs = 25,
        includeWhoisDetails = true
      } = req.body;

      if (!rawDomains || typeof rawDomains !== 'string') {
        return res.status(400).json({ error: 'Domain list is required' });
      }

      // Parse & normalize up to 5,000 domains
      const { normalized, validCount, invalidCount, duplicatesRemoved } = parseBulkDomains(rawDomains, 5000);

      if (validCount === 0) {
        return res.status(400).json({ error: 'No valid domains found in input.' });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const jobName = name?.trim() || `Batch Analysis (${validCount} domains)`;

      const job = await queue.startJob(jobId, jobName, normalized, {
        tldList: tldList.map((t: string) => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean),
        relatedDepth: Math.max(5, Math.min(250, Number(relatedDepth) || 25)),
        provider,
        concurrency: Math.max(1, Math.min(20, Number(concurrency) || 5)),
        delayMs: Math.max(0, Number(delayMs) || 0),
        includeWhoisDetails: Boolean(includeWhoisDetails)
      });

      res.json({
        success: true,
        jobId: job.id,
        totalDomains: job.totalDomains,
        validCount,
        invalidCount,
        duplicatesRemoved,
        job
      });
    } catch (err: any) {
      console.error('[API] Failed to create job:', err);
      res.status(500).json({ error: err.message || 'Failed to start bulk job' });
    }
  });

  // Jobs: List all
  app.get('/api/jobs', async (req, res) => {
    try {
      const jobs = await storage.listJobs();
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list jobs' });
    }
  });

  // Jobs: Get single job with pagination, search, and filtering
  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Check in-memory queue first for instant sub-millisecond retrieval
      let targetJob = queue.getActiveJob(id);
      if (!targetJob) {
        targetJob = await storage.getJob(id);
      }

      if (!targetJob) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Query params for high-performance pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(req.query.limit as string) || 50));
      const search = (req.query.search as string || '').toLowerCase().trim();
      const statusFilter = (req.query.status as string || 'all').toLowerCase().trim();
      const sortBy = (req.query.sortBy as string || 'default');
      const sortOrder = (req.query.sortOrder as string || 'desc').toLowerCase();
      const minTlds = parseInt(req.query.minTlds as string) || 0;
      const minRelated = parseInt(req.query.minRelated as string) || 0;

      let filtered = targetJob.results;

      if (search) {
        filtered = filtered.filter(r =>
          r.inputDomain.toLowerCase().includes(search) ||
          r.baseName.toLowerCase().includes(search) ||
          r.registeredTlds.some(t => t.toLowerCase().includes(search))
        );
      }

      if (statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status === statusFilter);
      }

      if (minTlds > 0) {
        filtered = filtered.filter(r => r.registeredTldCount >= minTlds);
      }

      if (minRelated > 0) {
        filtered = filtered.filter(r => r.relatedComCount >= minRelated);
      }

      // Sorting
      if (sortBy === 'tlds') {
        filtered = [...filtered].sort((a, b) =>
          sortOrder === 'asc' ? a.registeredTldCount - b.registeredTldCount : b.registeredTldCount - a.registeredTldCount
        );
      } else if (sortBy === 'related') {
        filtered = [...filtered].sort((a, b) =>
          sortOrder === 'asc' ? a.relatedComCount - b.relatedComCount : b.relatedComCount - a.relatedComCount
        );
      } else if (sortBy === 'domain') {
        filtered = [...filtered].sort((a, b) =>
          sortOrder === 'asc' ? a.inputDomain.localeCompare(b.inputDomain) : b.inputDomain.localeCompare(a.inputDomain)
        );
      }

      const totalFiltered = filtered.length;
      const totalPages = Math.ceil(totalFiltered / limit);
      const paginatedResults = filtered.slice((page - 1) * limit, page * limit);

      res.json({
        job: {
          id: targetJob.id,
          name: targetJob.name,
          createdAt: targetJob.createdAt,
          completedAt: targetJob.completedAt,
          status: targetJob.status,
          totalDomains: targetJob.totalDomains,
          processedDomains: targetJob.processedDomains,
          successCount: targetJob.successCount,
          errorCount: targetJob.errorCount,
          settings: targetJob.settings,
          stats: targetJob.stats
        },
        pagination: {
          page,
          limit,
          totalFiltered,
          totalPages
        },
        results: paginatedResults
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch job details' });
    }
  });

  // Job Controls: Pause
  app.post('/api/jobs/:id/pause', (req, res) => {
    const { id } = req.params;
    const ok = queue.pauseJob(id);
    res.json({ success: ok, message: ok ? 'Job paused' : 'Unable to pause job' });
  });

  // Job Controls: Resume
  app.post('/api/jobs/:id/resume', (req, res) => {
    const { id } = req.params;
    const ok = queue.resumeJob(id);
    res.json({ success: ok, message: ok ? 'Job resumed' : 'Unable to resume job' });
  });

  // Job Controls: Cancel
  app.post('/api/jobs/:id/cancel', (req, res) => {
    const { id } = req.params;
    const ok = queue.cancelJob(id);
    res.json({ success: ok, message: ok ? 'Job cancelled' : 'Unable to cancel job' });
  });

  // Job Controls: Delete All
  app.delete('/api/jobs', async (req, res) => {
    try {
      const jobs = await storage.listJobs();
      for (const j of jobs) {
        queue.cancelJob(j.id);
        await storage.deleteJob(j.id);
      }
      res.json({ success: true, count: jobs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to clear jobs' });
    }
  });

  // Job Controls: Delete Single
  app.delete('/api/jobs/:id', async (req, res) => {
    const { id } = req.params;
    queue.cancelJob(id);
    const deleted = await storage.deleteJob(id);
    res.json({ success: deleted });
  });

  // Export: Summary CSV
  app.get('/api/jobs/:id/export/summary-csv', async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      if (!job) return res.status(404).send('Job not found');

      const csv = storage.generateSummaryCsv(job);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${job.name.replace(/[^a-z0-9]/gi, '_')}_summary.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).send(err.message || 'Export error');
    }
  });

  // Export: Detailed CSV
  app.get('/api/jobs/:id/export/detailed-csv', async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      if (!job) return res.status(404).send('Job not found');

      const csv = storage.generateDetailedCsv(job);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${job.name.replace(/[^a-z0-9]/gi, '_')}_detailed.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).send(err.message || 'Export error');
    }
  });

  // Export: Full JSON
  app.get('/api/jobs/:id/export/json', async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      if (!job) return res.status(404).send('Job not found');

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${job.name.replace(/[^a-z0-9]/gi, '_')}.json"`);
      res.send(JSON.stringify(job, null, 2));
    } catch (err: any) {
      res.status(500).send(err.message || 'Export error');
    }
  });

  // --------------------------------------------------------------------------
  // Vite Integration / Static file serving
  // --------------------------------------------------------------------------
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DotFootprint] Server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });
}

createServer().catch(err => {
  console.error('[DotFootprint] Startup failed:', err);
  process.exit(1);
});
