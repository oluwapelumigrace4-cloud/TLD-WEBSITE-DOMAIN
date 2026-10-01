import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { BulkSearchView } from './components/BulkSearchView.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { ApiComparisonGuide } from './components/ApiComparisonGuide.tsx';
import { ProviderSettingsModal } from './components/ProviderSettingsModal.tsx';
import { DomainDetailModal } from './components/DomainDetailModal.tsx';
import { DomainAnalysisResult, RegistrationEvidence } from './types/index.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'bulk' | 'results' | 'guide' | 'settings'>('dashboard');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<string>('idle');
  const [activeProviderName, setActiveProviderName] = useState<string>('Authoritative Hybrid');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Quick single-domain inspection state
  const [quickInspectionResult, setQuickInspectionResult] = useState<DomainAnalysisResult | null>(null);
  const [quickInspectLoading, setQuickInspectLoading] = useState(false);

  // Fetch active provider info on load
  const loadProviderStatus = () => {
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => {
        if (data.activeProvider) {
          const match = data.providers?.find((p: any) => p.id === data.activeProvider);
          setActiveProviderName(match?.name || data.activeProvider);
        }
      })
      .catch(() => {});
  };

  // Check for the most recent job on load to show in Results view
  useEffect(() => {
    loadProviderStatus();
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          setActiveJobId(data.jobs[0].id);
          setActiveJobStatus(data.jobs[0].status);
        }
      })
      .catch(() => {});
  }, []);

  const handleJobStarted = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveJobStatus('running');
    setCurrentTab('results');
  };

  const handleOpenJob = (id: string) => {
    setActiveJobId(id);
    setCurrentTab('results');
  };

  const handleQuickInspect = async (rawDomain: string) => {
    setQuickInspectLoading(true);
    try {
      const clean = rawDomain.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split('/')[0];
      const parts = clean.split('.');
      const baseName = parts.length > 1 ? parts[parts.length - 2] : clean;
      const tld = parts.length > 1 ? parts[parts.length - 1] : 'com';

      const res = await fetch('/api/quick-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: clean })
      });
      const data = await res.json();

      const mockAnalysisResult: DomainAnalysisResult = {
        id: `inspect_${Date.now()}`,
        inputDomain: rawDomain,
        normalizedDomain: clean,
        baseName,
        inputTld: tld,
        status: 'complete',
        registeredTldCount: data.evidence?.isRegistered ? 1 : 0,
        totalTldsChecked: 1,
        registeredTlds: data.evidence?.isRegistered ? [`.${tld}`] : [],
        tldResults: [
          {
            tld: `.${tld}`,
            fullDomain: clean,
            status: data.evidence?.status || 'unknown',
            evidence: data.evidence
          }
        ],
        relatedComCount: 0,
        totalRelatedChecked: 0,
        relatedComDomains: [],
        relatedResults: [],
        primaryEvidence: data.evidence,
        checkedAt: new Date().toISOString()
      };

      setQuickInspectionResult(mockAnalysisResult);
    } catch {
      //
    } finally {
      setQuickInspectLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'settings') {
            setSettingsOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        activeJobId={activeJobId}
        activeJobStatus={activeJobStatus}
        activeProviderName={activeProviderName}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardView
            onStartNewSearch={() => setCurrentTab('bulk')}
            onOpenJob={handleOpenJob}
            onOpenGuide={() => setCurrentTab('guide')}
            onQuickInspect={handleQuickInspect}
          />
        )}

        {currentTab === 'bulk' && (
          <BulkSearchView
            onJobStarted={handleJobStarted}
            activeProviderId="hybrid"
          />
        )}

        {currentTab === 'results' && (
          <ResultsView
            jobId={activeJobId}
            onSelectJob={(id) => setActiveJobId(id)}
          />
        )}

        {currentTab === 'guide' && (
          <ApiComparisonGuide
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </main>

      {/* Provider & API Keys Settings Modal */}
      <ProviderSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsSaved={() => {
          loadProviderStatus();
        }}
      />

      {/* Quick Inspection Modal */}
      <DomainDetailModal
        result={quickInspectionResult}
        onClose={() => setQuickInspectionResult(null)}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-4 px-6 text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-bold">DotFootprint</span>
          <span>•</span>
          <span>Authoritative Domain Footprint & Discovery</span>
        </div>
        <div>
          <span>Engine: RFC 7480 RDAP & DNS-over-HTTPS</span>
        </div>
      </footer>
    </div>
  );
}
