import React, { useState } from 'react';
import { X, Globe2, ShieldCheck, Calendar, Server, ExternalLink, RefreshCw, CheckCircle2, XCircle, AlertCircle, HelpCircle, Code, Layers } from 'lucide-react';
import { DomainAnalysisResult, RegistrationEvidence, DomainStatus } from '../types/index.ts';

interface DomainDetailModalProps {
  result: DomainAnalysisResult | null;
  onClose: () => void;
}

export const DomainDetailModal: React.FC<DomainDetailModalProps> = ({ result, onClose }) => {
  const [selectedSubDomain, setSelectedSubDomain] = useState<string | null>(null);
  const [inspectEvidence, setInspectEvidence] = useState<RegistrationEvidence | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'footprint' | 'related' | 'evidence'>('footprint');
  const [showRawJson, setShowRawJson] = useState(false);

  if (!result) return null;

  // Active evidence to display in the evidence card
  const currentEvidence: RegistrationEvidence | undefined =
    inspectEvidence ||
    (selectedSubDomain
      ? result.tldResults.find(t => t.fullDomain === selectedSubDomain)?.evidence ||
        result.relatedResults.find(r => r.domain === selectedSubDomain)?.evidence
      : result.primaryEvidence || result.tldResults[0]?.evidence);

  const handleInspectDomain = async (domainToInspect: string) => {
    setSelectedSubDomain(domainToInspect);
    setInspectLoading(true);
    try {
      const res = await fetch('/api/quick-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainToInspect })
      });
      const data = await res.json();
      if (data.success && data.evidence) {
        setInspectEvidence(data.evidence);
      }
    } catch {
      //
    } finally {
      setInspectLoading(false);
    }
  };

  const getStatusBadge = (status: DomainStatus) => {
    switch (status) {
      case 'registered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Registered
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            <CheckCircle2 className="w-3 h-3" />
            Available
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
            <HelpCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-mono">{result.normalizedDomain}</h2>
                {getStatusBadge(result.primaryEvidence?.status || (result.registeredTldCount > 0 ? 'registered' : 'available'))}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Base name: <span className="font-mono text-indigo-300 font-semibold">{result.baseName}</span> •{' '}
                <strong className="text-white">{result.registeredTldCount}</strong> of {result.totalTldsChecked} TLDs registered •{' '}
                <strong className="text-white">{result.relatedComCount}</strong> related .COMs registered
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/40 text-xs font-medium">
          <button
            onClick={() => setActiveTab('footprint')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'footprint'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>TLD Footprint ({result.registeredTldCount}/{result.totalTldsChecked})</span>
          </button>
          <button
            onClick={() => setActiveTab('related')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'related'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Related .COMs ({result.relatedComCount}/{result.totalRelatedChecked})</span>
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Registration Evidence & WHOIS/RDAP</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: TLD Footprint Matrix */}
          {activeTab === 'footprint' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Click any extension to view registration proof and WHOIS/RDAP records:</span>
                <span className="font-mono text-zinc-500">{result.tldResults.length} TLDs checked</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {result.tldResults.map(tldItem => {
                  const isSelected = selectedSubDomain === tldItem.fullDomain;
                  const isReg = tldItem.status === 'registered';

                  return (
                    <button
                      key={tldItem.fullDomain}
                      type="button"
                      onClick={() => handleInspectDomain(tldItem.fullDomain)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/40 shadow-sm'
                          : isReg
                          ? 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                          : 'bg-zinc-950/40 border-zinc-900 opacity-75 hover:opacity-100 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-sm text-white">
                          {tldItem.tld}
                        </span>
                        {getStatusBadge(tldItem.status)}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate">
                        {tldItem.fullDomain}
                      </div>
                      {tldItem.evidence?.registrar && (
                        <div className="text-[10px] text-zinc-500 truncate mt-1">
                          {tldItem.evidence.registrar}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Related .COMs Matrix */}
          {activeTab === 'related' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Commercially relevant variations ranked by naming relevance:</span>
                <span className="font-mono text-zinc-500">
                  {result.relatedResults.filter(r => r.status === 'registered').length} registered / {result.relatedResults.length} tested
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {result.relatedResults.map(rel => {
                  const isSelected = selectedSubDomain === rel.domain;
                  const isReg = rel.status === 'registered';

                  return (
                    <button
                      key={rel.domain}
                      type="button"
                      onClick={() => handleInspectDomain(rel.domain)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/40 shadow-sm'
                          : isReg
                          ? 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                          : 'bg-zinc-950/40 border-zinc-900 opacity-60 hover:opacity-100 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-white truncate">
                          {rel.domain}
                        </span>
                        {getStatusBadge(rel.status)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono border border-zinc-800">
                          {rel.pattern}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                          Score: {rel.relevanceScore}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3 or Persistent Bottom Card: Registration Evidence Details */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                  Registration Evidence for:{' '}
                  <strong className="text-white font-mono">
                    {selectedSubDomain || result.normalizedDomain}
                  </strong>
                </span>
                {inspectLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-2.5 py-1 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Code className="w-3 h-3" />
                  <span>{showRawJson ? 'Hide Raw' : 'View Raw RDAP/DNS'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInspectDomain(selectedSubDomain || result.normalizedDomain)}
                  disabled={inspectLoading}
                  className="px-2.5 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg flex items-center gap-1 transition-colors"
                  title="Live query authoritative registry"
                >
                  <RefreshCw className={`w-3 h-3 ${inspectLoading ? 'animate-spin' : ''}`} />
                  <span>Live Refresh</span>
                </button>
              </div>
            </div>

            {currentEvidence ? (
              <div className="space-y-4 text-xs">
                {/* Meta Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Registrar</span>
                    <span className="font-semibold text-zinc-200 block truncate mt-0.5">
                      {currentEvidence.registrar || (currentEvidence.isRegistered ? 'Registered' : 'Not Registered')}
                    </span>
                    {currentEvidence.registrarId && (
                      <span className="text-[10px] text-zinc-500 font-mono">IANA ID: {currentEvidence.registrarId}</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Created Date</span>
                    <span className="font-mono text-zinc-200 block mt-0.5">
                      {currentEvidence.creationDate ? new Date(currentEvidence.creationDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Expiration Date</span>
                    <span className="font-mono text-zinc-200 block mt-0.5">
                      {currentEvidence.expirationDate ? new Date(currentEvidence.expirationDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Data Source</span>
                    <span className="text-zinc-200 block truncate mt-0.5 font-medium">
                      {currentEvidence.source}
                    </span>
                    {currentEvidence.responseTimeMs !== undefined && (
                      <span className="text-[10px] text-zinc-500 font-mono">{currentEvidence.responseTimeMs}ms</span>
                    )}
                  </div>
                </div>

                {/* Nameservers */}
                {currentEvidence.nameservers && currentEvidence.nameservers.length > 0 && (
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-indigo-400" />
                      Authoritative Delegated Nameservers ({currentEvidence.nameservers.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {currentEvidence.nameservers.map(ns => (
                        <span key={ns} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                          {ns}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Flags */}
                {currentEvidence.statusDetails && currentEvidence.statusDetails.length > 0 && (
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">
                      Registry EPP Status Flags
                    </span>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {currentEvidence.statusDetails.map(status => (
                        <span key={status} className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw JSON View */}
                {showRawJson && (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 overflow-x-auto">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase block mb-1">
                      Raw Provider Evidence Payload
                    </span>
                    <pre className="font-mono text-[11px] text-zinc-400 leading-relaxed max-h-48 overflow-y-auto">
                      {JSON.stringify(currentEvidence, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-zinc-500">
                Click any domain or extension to load its authoritative registration records.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-xs text-zinc-500">
          <span>Checked at: {result.checkedAt ? new Date(result.checkedAt).toLocaleString() : 'Just now'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
