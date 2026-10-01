import React, { useState, useEffect } from 'react';
import {
  Layers, Search, CheckCircle2, Clock, AlertTriangle, ArrowRight, Trash2,
  TrendingUp, Globe2, ShieldCheck, Zap, Activity, ExternalLink
} from 'lucide-react';
import { JobSummary } from '../types/index.ts';

interface DashboardViewProps {
  onStartNewSearch: () => void;
  onOpenJob: (id: string) => void;
  onOpenGuide: () => void;
  onQuickInspect: (domain: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartNewSearch,
  onOpenJob,
  onOpenGuide,
  onQuickInspect
}) => {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickDomain, setQuickDomain] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDeleteJob = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this batch history?')) return;
    try {
      await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch {
      //
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all batch histories?')) return;
    try {
      await fetch('/api/jobs', { method: 'DELETE' });
      setJobs([]);
    } catch {
      //
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDomain.trim()) return;
    onQuickInspect(quickDomain.trim());
  };

  // Cumulative totals
  const totalAnalyzed = jobs.reduce((sum, j) => sum + (j.processedDomains || 0), 0);
  const totalJobsCount = jobs.length;
  const runningJobs = jobs.filter(j => j.status === 'running');

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4 sm:px-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-indigo-950/30 border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            DotDB-Class Domain Footprint & Discovery Architecture
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            High-Scale Domain Registration Footprint & Related .COM Discovery
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl">
            Analyze up to <strong className="text-white">5,000 domains</strong> simultaneously. Detect which TLDs are registered across the global DNS zone, discover commercially ranked <strong className="text-indigo-400 font-mono">.com</strong> variants, and verify authoritative RDAP registration evidence.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onStartNewSearch}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Launch Bulk Search</span>
            </button>

            <button
              onClick={onOpenGuide}
              className="px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs sm:text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>API Comparison & Cost Breakdown</span>
            </button>
          </div>
        </div>

        {/* Quick Instant Search Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 max-w-2xl">
          <form onSubmit={handleQuickSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Instant single-domain check (e.g. stripe.com or brand)..."
                value={quickDomain}
                onChange={e => setQuickDomain(e.target.value)}
                className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs sm:text-sm rounded-xl transition-colors shrink-0"
            >
              Inspect
            </button>
          </form>
        </div>
      </div>

      {/* Aggregate Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Domains Analyzed</span>
            <Globe2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalAnalyzed.toLocaleString()}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Across {totalJobsCount} research batches
          </span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Active Analysis</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {runningJobs.length}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Background workers running
          </span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Engine Protocol</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white truncate">
            ICANN RDAP + DoH
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            Authoritative DNS & Registry JSON
          </span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Scale Capacity</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            5,000 / Batch
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Async chunking & rate throttling
          </span>
        </div>
      </div>

      {/* Recent Batches / Jobs Table */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Research Batches</h2>
            <p className="text-xs text-zinc-400">View progress, results, or export previous analyses</p>
          </div>
          <div className="flex items-center gap-3">
            {jobs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                title="Clear all past batch records"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onStartNewSearch}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>+ New Batch</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-zinc-800/60">
          {jobs.length > 0 ? (
            jobs.map(job => {
              const isRunning = job.status === 'running';
              const progress = job.totalDomains > 0 ? Math.round((job.processedDomains / job.totalDomains) * 100) : 0;

              return (
                <div
                  key={job.id}
                  onClick={() => onOpenJob(job.id)}
                  className="p-5 hover:bg-zinc-800/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white group-hover:text-indigo-400 transition-colors">
                        {job.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                            : job.status === 'completed'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 font-mono flex items-center gap-3">
                      <span>{job.totalDomains.toLocaleString()} domains</span>
                      <span>•</span>
                      <span>{job.settings?.tldList?.length || 0} TLDs</span>
                      <span>•</span>
                      <span>Depth: {job.settings?.relatedDepth || 0}</span>
                      <span>•</span>
                      <span className="text-zinc-500">
                        {new Date(job.createdAt).toLocaleDateString()} {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress indicator */}
                    <div className="w-32 hidden sm:block">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span>{progress}%</span>
                        <span>{job.processedDomains}/{job.totalDomains}</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteJob(e, job.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        title="Delete batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 group-hover:text-white group-hover:bg-indigo-600 transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-zinc-500 text-sm">
              No domain research batches yet. Click "Launch Bulk Search" above to analyze your first portfolio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
