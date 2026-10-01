import React, { useState, useMemo } from 'react';
import { Play, Upload, FileText, CheckCircle2, AlertCircle, Copy, Sparkles, Filter, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { parseBulkDomains } from '../server/utils/domainNormalizer.ts';

interface BulkSearchViewProps {
  onJobStarted: (jobId: string) => void;
  activeProviderId: string;
}

const PRESET_TLDS_10 = ['com', 'net', 'org', 'ai', 'io', 'co', 'app', 'dev', 'xyz', 'tech'];
const PRESET_TLDS_25 = [
  'com', 'net', 'org', 'ai', 'io', 'co', 'app', 'dev', 'xyz', 'tech',
  'me', 'info', 'biz', 'online', 'site', 'store', 'cloud', 'pro', 'live', 'link',
  'space', 'club', 'global', 'agency', 'digital'
];
const PRESET_TLDS_50 = [
  ...PRESET_TLDS_25,
  'tools', 'works', 'network', 'solutions', 'systems', 'group', 'team', 'zone', 'world', 'media',
  'studio', 'design', 'software', 'community', 'center', 'direct', 'services', 'today', 'company', 'ventures',
  'fund', 'market', 'exchange', 'finance', 'capital'
];

const SAMPLE_DATASETS = {
  unicorns: `stripe.com
openai.com
figma.com
vercel.com
canva.com
notion.so
linear.app
airbnb.com
dropbox.com
shopify.com
databricks.com
snowflake.com
anthropic.com
supabase.com
retool.com`,
  aiStartups: `midjourney.com
runwayml.com
synthesia.io
perplexity.ai
jasper.ai
elevenlabs.io
copy.ai
huggingface.co
stability.ai
character.ai
pika.art
suno.ai
kling.ai
glean.com
cohere.com`,
  messyUrls: `https://www.GitHub.com/features
HTTP://SUBDOMAIN.GITLAB.COM:443/home?ref=123
EXAMPLE.CO.UK/about
https://developer.mozilla.org#intro
www.BitBucket.org
https://news.ycombinator.com/item?id=1
AWS.AMAZON.COM
docker.com/products/engine
cloudflare.com
vercel.app`
};

export const BulkSearchView: React.FC<BulkSearchViewProps> = ({ onJobStarted, activeProviderId }) => {
  const [jobName, setJobName] = useState('');
  const [inputText, setInputText] = useState('');
  const [tldPreset, setTldPreset] = useState<'10' | '25' | '50' | 'custom'>('10');
  const [customTlds, setCustomTlds] = useState('com, net, org, ai, io, co, app');
  const [relatedDepth, setRelatedDepth] = useState<number>(15);
  const [provider, setProvider] = useState<string>(activeProviderId || 'hybrid');
  const [concurrency, setConcurrency] = useState<number>(15);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Real-time deduplication & parsing preview
  const parseResult = useMemo(() => {
    return parseBulkDomains(inputText, 5000);
  }, [inputText]);

  const activeTldList = useMemo(() => {
    if (tldPreset === '10') return PRESET_TLDS_10;
    if (tldPreset === '25') return PRESET_TLDS_25;
    if (tldPreset === '50') return PRESET_TLDS_50;
    return customTlds.split(/[\s,]+/).map(t => t.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
  }, [tldPreset, customTlds]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        if (!jobName) {
          setJobName(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleStartAnalysis = async () => {
    if (parseResult.validCount === 0) {
      setErrorMessage('Please enter at least one valid domain name.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobName.trim() || `Batch Analysis (${parseResult.validCount} domains)`,
          rawDomains: inputText,
          tldList: activeTldList,
          relatedDepth,
          provider,
          concurrency,
          delayMs
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start job');
      }

      onJobStarted(data.jobId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error initiating analysis');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            Bulk Domain Research & Footprint Engine
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Analyze up to 5,000 domains at scale. Discover registered TLD extensions and commercial .COM variants.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-500 font-mono">Load Demo:</span>
          <button
            type="button"
            onClick={() => setInputText(SAMPLE_DATASETS.unicorns)}
            className="px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            15 Unicorns
          </button>
          <button
            type="button"
            onClick={() => setInputText(SAMPLE_DATASETS.aiStartups)}
            className="px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            15 AI Startups
          </button>
          <button
            type="button"
            onClick={() => setInputText(SAMPLE_DATASETS.messyUrls)}
            className="px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-colors"
            title="Tests normalization of URLs, paths, subdomains, uppercase, and ports"
          >
            Messy URLs
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-6">
        {/* Job Name */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
            Batch Name (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Portfolio Audit Q4, AI Competitor Landscape..."
            value={jobName}
            onChange={e => setJobName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Big Textarea for 5,000 domains */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Enter Domains (Up to 5,000)
            </label>
            <label className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-medium">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / TXT</span>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="relative">
            <textarea
              rows={9}
              placeholder={`example.com\nmybrand.com\nrawk.com\nsomething.ai\nanothername.com\nhttps://www.startup.io/\n...`}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/80 transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Live Parsing & Deduplication Counter */}
          <div className="mt-2.5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Valid Domains: <strong className="text-white">{parseResult.validCount.toLocaleString()}</strong>
            </span>
            {parseResult.duplicatesRemoved > 0 && (
              <span className="text-amber-400/90 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Deduplicated: <strong>{parseResult.duplicatesRemoved.toLocaleString()}</strong>
              </span>
            )}
            {parseResult.invalidCount > 0 && (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Invalid: <strong>{parseResult.invalidCount.toLocaleString()}</strong>
              </span>
            )}
            <span className="text-zinc-500 ml-auto hidden sm:inline">
              Max limit: 5,000 domains / batch
            </span>
          </div>
        </div>

        {/* Configuration Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-zinc-800/80">
          {/* 1. TLD Extensions Footprint Selection */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-300">
                1. TLD Extensions Footprint
              </label>
              <p className="text-[11px] text-zinc-500">
                Which domain extensions to test for each base name
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '10', label: 'Top 10', count: 10 },
                { id: '25', label: 'Top 25', count: 25 },
                { id: '50', label: 'Major 50', count: 50 },
                { id: 'custom', label: 'Custom', count: activeTldList.length }
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTldPreset(preset.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                    tldPreset === preset.id
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="block font-semibold">{preset.label}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{preset.count} TLDs</span>
                </button>
              ))}
            </div>

            {tldPreset === 'custom' ? (
              <div>
                <input
                  type="text"
                  value={customTlds}
                  onChange={e => setCustomTlds(e.target.value)}
                  placeholder="com, net, org, ai, io, co, app, xyz, dev, uk"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 max-h-24 overflow-y-auto">
                {activeTldList.map(tld => (
                  <span
                    key={tld}
                    className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                  >
                    .{tld}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2. Related .COM Discovery Depth */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-300">
                2. Related .COM Discovery Depth
              </label>
              <p className="text-[11px] text-zinc-500">
                Number of ranked commercial variations to evaluate per domain
              </p>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[15, 25, 50, 100, 250].map(depth => (
                <button
                  key={depth}
                  type="button"
                  onClick={() => setRelatedDepth(depth)}
                  className={`py-2 px-1 rounded-xl text-xs font-mono text-center border transition-all ${
                    relatedDepth === depth
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-sm">{depth}</span>
                  <span className="text-[9px] text-zinc-500 block uppercase">vars</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60 leading-relaxed">
              Generates prioritized commercial prefixes (<code className="text-zinc-300 font-mono">get, try, use, go, hey, join, my, the</code>), suffixes (<code className="text-zinc-300 font-mono">hq, app, ai, co, labs, tech, group, io, pro</code>), plus plurals and abbreviations.
            </p>
          </div>
        </div>

        {/* Advanced Concurrency & Provider Drawer */}
        <div className="border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Advanced Execution Controls</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Active Provider Engine
                </label>
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="hybrid">Authoritative Hybrid (DNS + RDAP) [Free]</option>
                  <option value="dns">Authoritative DNS / DoH [Fastest, Free]</option>
                  <option value="rdap">ICANN RDAP Direct [Free]</option>
                  <option value="whoisxml">WhoisXML Bulk API [Key Required]</option>
                  <option value="godaddy">GoDaddy Domains API [Key Required]</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Worker Concurrency: <strong className="text-white font-mono">{concurrency}</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={concurrency}
                  onChange={e => setConcurrency(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="text-[10px] text-zinc-500">1 to 20 parallel domain workers</span>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Throttling Delay: <strong className="text-white font-mono">{delayMs}ms</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="25"
                  value={delayMs}
                  onChange={e => setDelayMs(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="text-[10px] text-zinc-500">Delay between worker dispatches</span>
              </div>
            </div>
          )}
        </div>

        {/* Start Button & Summary */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-zinc-400 font-mono text-center sm:text-left">
            <span>Estimated Queries: </span>
            <strong className="text-white">
              {(parseResult.validCount * (activeTldList.length + relatedDepth)).toLocaleString()}
            </strong>{' '}
            lookups across {parseResult.validCount.toLocaleString()} domains
          </div>

          <button
            type="button"
            onClick={handleStartAnalysis}
            disabled={loading || parseResult.validCount === 0}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing Queue...</span>
              </span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Footprint Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
