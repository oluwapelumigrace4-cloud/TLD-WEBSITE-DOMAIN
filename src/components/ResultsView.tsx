import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Search, Filter, ArrowUpDown, Pause, Play, XCircle, RefreshCw,
  CheckCircle2, Clock, Globe2, AlertCircle, ChevronLeft, ChevronRight, Layers, Eye
} from 'lucide-react';
import { JobDetails, DomainAnalysisResult, JobStats } from '../types/index.ts';
import { DomainDetailModal } from './DomainDetailModal.tsx';

interface ResultsViewProps {
  jobId: string | null;
  onSelectJob: (id: string) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ jobId, onSelectJob }) => {
  const [jobData, setJobData] = useState<{
    job: JobDetails;
    pagination: { page: number; limit: number; totalFiltered: number; totalPages: number };
    results: DomainAnalysisResult[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDomainResult, setSelectedDomainResult] = useState<DomainAnalysisResult | null>(null);

  // Filters & sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('tlds');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [minTlds, setMinTlds] = useState<number>(0);
  const [minRelated, setMinRelated] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch job details and results
  const fetchResults = async (isBackgroundPoll = false) => {
    if (!jobId) return;
    if (!isBackgroundPoll) setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        search: searchTerm,
        status: statusFilter,
        sortBy,
        sortOrder,
        minTlds: String(minTlds),
        minRelated: String(minRelated)
      });

      const res = await fetch(`/api/jobs/${jobId}?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load job');
      }

      const data = await res.json();
      setJobData(data);
      setError('');
    } catch (err: any) {
      if (!isBackgroundPoll) {
        setError(err.message || 'Error fetching results');
      }
    } finally {
      if (!isBackgroundPoll) setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder, minTlds, minRelated, pageSize]);

  // Robust live polling loop: ticks every 800ms while mounted until job is completed
  useEffect(() => {
    let isMounted = true;

    // Immediate initial fetch
    fetchResults(false);

    const interval = setInterval(async () => {
      if (!isMounted || !jobId) return;
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
          search: searchTerm,
          status: statusFilter,
          sortBy,
          sortOrder,
          minTlds: String(minTlds),
          minRelated: String(minRelated)
        });

        const res = await fetch(`/api/jobs/${jobId}?${params.toString()}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setJobData(data);
        }
      } catch {}
    }, 800);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jobId, currentPage, pageSize, searchTerm, statusFilter, sortBy, sortOrder, minTlds, minRelated]);

  const handlePause = async () => {
    if (!jobId) return;
    await fetch(`/api/jobs/${jobId}/pause`, { method: 'POST' });
    fetchResults(false);
  };

  const handleResume = async () => {
    if (!jobId) return;
    await fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' });
    fetchResults(false);
  };

  const handleCancel = async () => {
    if (!jobId || !confirm('Are you sure you want to stop this batch analysis?')) return;
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
    fetchResults(false);
  };

  if (!jobId) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">No Batch Selected</h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
          Start a new bulk domain research batch or select an existing one from the Dashboard.
        </p>
      </div>
    );
  }

  const job = jobData?.job;
  const isRunning = job?.status === 'running';
  const isPaused = job?.status === 'paused';
  const progressPercent = job && job.totalDomains > 0 ? Math.round((job.processedDomains / job.totalDomains) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* Top Banner: Live Progress & Execution Controls */}
      {job && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{job.name}</h1>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    job.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                      : job.status === 'paused'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : job.status === 'completed'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Provider: <span className="text-indigo-400 font-semibold">{job.settings?.provider}</span> •{' '}
                {job.settings?.tldList?.length || 0} TLDs • {job.settings?.relatedDepth || 0} Related Depth
              </p>
            </div>

            {/* Action Buttons: Pause/Resume/Cancel & Export */}
            <div className="flex flex-wrap items-center gap-2">
              {isRunning && (
                <button
                  onClick={handlePause}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              {isPaused && (
                <button
                  onClick={handleResume}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              )}

              {(isRunning || isPaused) && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}

              <button
                onClick={() => fetchResults(false)}
                disabled={loading}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                title="Refresh table"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Exports */}
              <div className="flex items-center gap-1.5 ml-2">
                <a
                  href={`/api/jobs/${job.id}/export/summary-csv`}
                  download
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </a>
                <a
                  href={`/api/jobs/${job.id}/export/detailed-csv`}
                  download
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors hidden sm:flex items-center gap-1"
                  title="Export all individual TLD and related .COM queries"
                >
                  <span>Detailed CSV</span>
                </a>
              </div>
            </div>
          </div>

          {/* Progress Bar & Live Speed Counter */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300">
                Progress:{' '}
                <strong className="text-white text-sm">
                  {job.processedDomains.toLocaleString()}
                </strong>{' '}
                / {job.totalDomains.toLocaleString()} domains ({progressPercent}%)
              </span>
              <div className="flex items-center gap-4 text-zinc-400">
                {isRunning && (
                  <>
                    <span>Speed: <strong className="text-emerald-400">{job.stats?.reqPerSec || 0} req/s</strong></span>
                    {job.stats?.etaSeconds !== undefined && job.stats.etaSeconds > 0 && (
                      <span className="hidden sm:inline">
                        ETA: <strong className="text-zinc-200">{Math.ceil(job.stats.etaSeconds / 60)}m {job.stats.etaSeconds % 60}s</strong>
                      </span>
                    )}
                  </>
                )}
                {job.completedAt && (
                  <span className="text-zinc-500">Completed in {Math.round((job.stats?.elapsedMs || 0) / 1000)}s</span>
                )}
              </div>
            </div>

            <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-300 ${
                  job.status === 'completed'
                    ? 'bg-indigo-500'
                    : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-zinc-800/60 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block">Registered Footprint</span>
              <span className="text-emerald-400 font-bold text-base mt-0.5 block">
                {job.stats?.registeredCount?.toLocaleString() || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block">Available / NXDOMAIN</span>
              <span className="text-cyan-400 font-bold text-base mt-0.5 block">
                {job.stats?.availableCount?.toLocaleString() || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block">Avg TLDs / Domain</span>
              <span className="text-white font-bold text-base mt-0.5 block">
                {job.stats?.avgTldCount || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 uppercase block">Avg Related .COMs</span>
              <span className="text-indigo-400 font-bold text-base mt-0.5 block">
                {job.stats?.avgRelatedCount || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by domain, base name, or registered TLD..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="complete">Complete Only</option>
              <option value="processing">Processing</option>
              <option value="queued">Queued</option>
              <option value="error">Errors</option>
            </select>

            {/* Min TLD Count Filter */}
            <select
              value={minTlds}
              onChange={e => setMinTlds(parseInt(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none"
            >
              <option value="0">All TLD Counts</option>
              <option value="3">≥ 3 TLDs Registered</option>
              <option value="5">≥ 5 TLDs Registered</option>
              <option value="8">≥ 8 TLDs Registered</option>
              <option value="12">≥ 12 TLDs Registered</option>
            </select>

            {/* Min Related .COMs Filter */}
            <select
              value={minRelated}
              onChange={e => setMinRelated(parseInt(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none"
            >
              <option value="0">All Related .COMs</option>
              <option value="1">≥ 1 Related .COM</option>
              <option value="5">≥ 5 Related .COMs</option>
              <option value="10">≥ 10 Related .COMs</option>
            </select>
          </div>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-2">
            <span>Sort By:</span>
            <button
              onClick={() => {
                if (sortBy === 'tlds') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortBy('tlds'); setSortOrder('desc'); }
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                sortBy === 'tlds' ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <span>TLD Count</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                if (sortBy === 'related') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortBy('related'); setSortOrder('desc'); }
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                sortBy === 'related' ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <span>Related .COMs</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                if (sortBy === 'domain') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                else { setSortBy('domain'); setSortOrder('asc'); }
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                sortBy === 'domain' ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              <span>Domain A-Z</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          <span className="font-mono text-zinc-500">
            Showing {jobData?.pagination.totalFiltered.toLocaleString() || 0} matching domains
          </span>
        </div>
      </div>

      {/* Main Investor-Style Table */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-zinc-300">
            <thead className="bg-zinc-950/90 text-zinc-400 uppercase text-[11px] font-mono border-b border-zinc-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Domain</th>
                <th className="py-3.5 px-4">TLD Count</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Registered Extensions</th>
                <th className="py-3.5 px-4">Related .COMs</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-mono text-xs">
              {jobData && jobData.results.length > 0 ? (
                jobData.results.map(row => {
                  const isComplete = row.status === 'complete';
                  const isProcessing = row.status === 'processing';
                  const isError = row.status === 'error';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedDomainResult(row)}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Domain column */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                          <span>{row.inputDomain}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-sans mt-0.5">
                          Base: <span className="font-mono text-zinc-400">{row.baseName}</span>
                        </div>
                      </td>

                      {/* TLD Count */}
                      <td className="py-3.5 px-4">
                        {isComplete ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-bold ${
                                row.registeredTldCount >= 10
                                  ? 'text-emerald-400'
                                  : row.registeredTldCount >= 5
                                  ? 'text-cyan-400'
                                  : row.registeredTldCount > 0
                                  ? 'text-indigo-400'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {row.registeredTldCount}
                            </span>
                            <span className="text-[10px] text-zinc-500">/ {row.totalTldsChecked}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Registered Extensions badges */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        {isComplete && row.registeredTlds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {row.registeredTlds.slice(0, 7).map(tld => (
                              <span
                                key={tld}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono"
                              >
                                {tld}
                              </span>
                            ))}
                            {row.registeredTlds.length > 7 && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-950 text-[10px] text-zinc-500 font-mono">
                                +{row.registeredTlds.length - 7} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-[11px]">None registered</span>
                        )}
                      </td>

                      {/* Related .COMs count and sample */}
                      <td className="py-3.5 px-4">
                        {isComplete ? (
                          <div>
                            <div className="flex items-center gap-1.5 font-bold">
                              <span
                                className={`text-sm ${
                                  row.relatedComCount >= 10
                                    ? 'text-cyan-400'
                                    : row.relatedComCount > 0
                                    ? 'text-indigo-300'
                                    : 'text-zinc-500'
                                }`}
                              >
                                {row.relatedComCount}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-normal">.com registered</span>
                            </div>
                            {row.relatedComDomains.length > 0 && (
                              <div className="text-[10px] text-zinc-500 truncate max-w-[160px] sm:max-w-xs mt-0.5">
                                e.g. {row.relatedComDomains[0]}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isComplete && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-sans">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyzing...</span>
                          </span>
                        )}
                        {row.status === 'queued' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-sans">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Queued</span>
                          </span>
                        )}
                        {isError && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-sans">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Error</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDomainResult(row);
                          }}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors inline-flex items-center gap-1 font-sans"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    {loading ? 'Loading domain results...' : 'No matching domains found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {jobData && jobData.pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950/60 text-xs text-zinc-400 gap-3">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(parseInt(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-white font-mono"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
              <span className="font-mono text-zinc-500 ml-2">
                Page {jobData.pagination.page} of {jobData.pagination.totalPages}
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-bold text-white">
                {currentPage}
              </span>
              <button
                disabled={currentPage >= jobData.pagination.totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:pointer-events-none hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Domain Detail Modal */}
      <DomainDetailModal
        result={selectedDomainResult}
        onClose={() => setSelectedDomainResult(null)}
      />
    </div>
  );
};
