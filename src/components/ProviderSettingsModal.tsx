import React, { useState, useEffect } from 'react';
import { X, Check, KeyRound, ShieldAlert, Zap, Globe, RefreshCw, Server, AlertCircle } from 'lucide-react';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [activeProvider, setActiveProvider] = useState<string>('hybrid');
  const [whoisxmlKey, setWhoisxmlKey] = useState<string>('');
  const [godaddyKey, setGodaddyKey] = useState<string>('');
  const [godaddySecret, setGodaddySecret] = useState<string>('');
  const [providers, setProviders] = useState<any[]>([]);

  const [testStatus, setTestStatus] = useState<{ [key: string]: { loading: boolean; message?: string; success?: boolean; latencyMs?: number } }>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/providers')
        .then(res => res.json())
        .then(data => {
          if (data.activeProvider) setActiveProvider(data.activeProvider);
          if (Array.isArray(data.providers)) setProviders(data.providers);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider,
          whoisxmlKey,
          godaddyKey,
          godaddySecret
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onSettingsSaved) onSettingsSaved();
      }
    } catch {
      //
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (providerId: string) => {
    setTestStatus(prev => ({ ...prev, [providerId]: { loading: true } }));
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      setTestStatus(prev => ({
        ...prev,
        [providerId]: {
          loading: false,
          success: data.success,
          message: data.message,
          latencyMs: data.latencyMs
        }
      }));
    } catch (err: any) {
      setTestStatus(prev => ({
        ...prev,
        [providerId]: {
          loading: false,
          success: false,
          message: err.message || 'Test failed'
        }
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Domain Data Providers & API Keys</h2>
              <p className="text-xs text-zinc-400">Configure active engine, rate limits, and commercial credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Active Provider Selector */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
              Default Provider Engine
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'hybrid', title: 'Authoritative Hybrid', desc: 'DNS-Screening + ICANN RDAP (Recommended, Free)', free: true },
                { id: 'dns', title: 'Authoritative DNS / DoH', desc: 'Cloudflare 1.1.1.1 + Google DoH (Fastest, Free)', free: true },
                { id: 'rdap', title: 'ICANN RDAP Direct', desc: 'Official registry JSON endpoints (Free, Strict rate limits)', free: true },
                { id: 'whoisxml', title: 'WhoisXML Bulk API', desc: '1,000 domains / POST batch (Requires API Key)', free: false },
                { id: 'godaddy', title: 'GoDaddy Domains API', desc: '500 domains / POST batch (Requires Key + Secret)', free: false }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProvider(p.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all relative ${
                    activeProvider === p.id
                      ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-sm shadow-indigo-500/10'
                      : 'bg-zinc-950/50 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs sm:text-sm text-zinc-100">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${p.free ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {p.free ? 'FREE' : 'API KEY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Test Provider Connection */}
          <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Live Connection Test for: <span className="text-indigo-300 font-mono">{activeProvider}</span>
              </span>
              <button
                type="button"
                onClick={() => handleTest(activeProvider)}
                disabled={testStatus[activeProvider]?.loading}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testStatus[activeProvider]?.loading ? 'animate-spin' : ''}`} />
                <span>Test Gateway</span>
              </button>
            </div>

            {testStatus[activeProvider] && (
              <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                testStatus[activeProvider].success
                  ? 'bg-emerald-950/30 border border-emerald-800/50 text-emerald-300'
                  : 'bg-rose-950/30 border border-rose-800/50 text-rose-300'
              }`}>
                {testStatus[activeProvider].success ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{testStatus[activeProvider].message}</p>
                  {testStatus[activeProvider].latencyMs && (
                    <span className="text-[10px] opacity-75 font-mono">
                      Latency: {testStatus[activeProvider].latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* WhoisXML API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                WhoisXML API Key (Optional)
              </label>
              <a
                href="https://whois.whoisxmlapi.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Get WhoisXML Key ↗
              </a>
            </div>
            <input
              type="password"
              placeholder="e.g. at_1234567890abcdef..."
              value={whoisxmlKey}
              onChange={e => setWhoisxmlKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500">
              Enables 1,000-domain batch requests and deep WHOIS registrant history parsing.
            </p>
          </div>

          {/* GoDaddy API Key Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                GoDaddy Developer API (Optional)
              </label>
              <a
                href="https://developer.godaddy.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Get GoDaddy Key ↗
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="password"
                  placeholder="GoDaddy Key"
                  value={godaddyKey}
                  onChange={e => setGodaddyKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="GoDaddy Secret"
                  value={godaddySecret}
                  onChange={e => setGodaddySecret(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {saveSuccess && (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Settings saved successfully
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
