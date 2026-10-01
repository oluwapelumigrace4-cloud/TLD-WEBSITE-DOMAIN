import React, { useState } from 'react';
import { DollarSign, ShieldCheck, Zap, Database, AlertTriangle, CheckCircle2, HelpCircle, ExternalLink, KeyRound } from 'lucide-react';

interface ApiComparisonGuideProps {
  onOpenSettings: () => void;
}

export const ApiComparisonGuide: React.FC<ApiComparisonGuideProps> = ({ onOpenSettings }) => {
  const [domainCount, setDomainCount] = useState<number>(5000);
  const [tldCount, setTldCount] = useState<number>(10);
  const [relatedDepth, setRelatedDepth] = useState<number>(25);

  const totalQueries = domainCount * (tldCount + relatedDepth);
  const whoisXmlCostEstimate = (totalQueries * 0.003).toFixed(2);
  const commercialWhoisApiCost = (totalQueries * 0.005).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 px-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
          <Database className="w-3.5 h-3.5" />
          Technical & Economic Evaluation for 5,000 Domains
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Domain-Data APIs: Comparison, Architecture & Cost Analysis
        </h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-3xl leading-relaxed">
          Scalable domain footprint research requires handling thousands of queries without triggering registry bans or running up surprise API invoices. Here is the architectural and financial breakdown behind DotFootprint.
        </p>
      </div>

      {/* The 5,000 Domains Cost Math & Limitations */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Why Checking 5,000 Domains Can Become Very Expensive
            </h2>
            <p className="text-xs text-zinc-400">
              The multiplication factor of TLD footprints + related variations
            </p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-6">
          When checking <span className="text-white font-semibold">5,000 base domains</span>, you are not making 5,000 queries.
          For every base name, you evaluate <span className="text-indigo-400 font-medium">{tldCount} TLD extensions</span> and{' '}
          <span className="text-cyan-400 font-medium">{relatedDepth} related .COM variations</span>.
        </p>

        {/* Interactive Query & Cost Calculator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 mb-6">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Base Domains</label>
            <input
              type="number"
              min="10"
              max="5000"
              step="100"
              value={domainCount}
              onChange={e => setDomainCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">TLD Extensions</label>
            <input
              type="number"
              min="1"
              max="100"
              value={tldCount}
              onChange={e => setTldCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Related .COM Variations</label>
            <input
              type="number"
              min="5"
              max="250"
              value={relatedDepth}
              onChange={e => setRelatedDepth(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block">Total Lookups</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {totalQueries.toLocaleString()}
            </div>
            <span className="text-[11px] text-zinc-400 mt-1 block">
              {domainCount.toLocaleString()} × ({tldCount} TLDs + {relatedDepth} related)
            </span>
          </div>

          <div className="bg-zinc-900/90 border border-amber-900/40 rounded-xl p-4">
            <span className="text-xs font-mono text-amber-500/80 uppercase tracking-wider block">Commercial API Cost</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              ${whoisXmlCostEstimate} – ${commercialWhoisApiCost}
            </div>
            <span className="text-[11px] text-zinc-400 mt-1 block">
              At $0.003–$0.005 per commercial query
            </span>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider block">DotFootprint Hybrid</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              $0.00 (Free)
            </div>
            <span className="text-[11px] text-zinc-400 mt-1 block">
              DNS pre-filtering + ICANN RDAP enrichment
            </span>
          </div>
        </div>
      </div>

      {/* Provider Comparison Matrix */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Detailed Provider Comparison Matrix
        </h2>

        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs sm:text-sm text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[11px] font-mono border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Provider / Method</th>
                <th className="py-3 px-4">Bulk Batching</th>
                <th className="py-3 px-4">Rate Limits</th>
                <th className="py-3 px-4">Pricing</th>
                <th className="py-3 px-4">TLD Coverage</th>
                <th className="py-3 px-4">Evidence Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
              <tr className="hover:bg-zinc-900/40">
                <td className="py-3.5 px-4 font-semibold text-white font-sans">
                  Authoritative Hybrid
                  <span className="block text-[11px] text-indigo-400 font-normal">DotFootprint Default</span>
                </td>
                <td className="py-3.5 px-4 text-emerald-400">25–50 concurrent</td>
                <td className="py-3.5 px-4 text-zinc-300">Adaptive token-bucket</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">$0.00 (Free)</td>
                <td className="py-3.5 px-4 text-zinc-300">Global (gTLDs + ccTLDs)</td>
                <td className="py-3.5 px-4 text-emerald-400 font-sans">
                  DNS proof + RDAP Registrar, Dates, Status
                </td>
              </tr>

              <tr className="hover:bg-zinc-900/40">
                <td className="py-3.5 px-4 font-semibold text-white font-sans">
                  Direct ICANN RDAP
                  <span className="block text-[11px] text-zinc-400 font-normal">RFC 7480-7484</span>
                </td>
                <td className="py-3.5 px-4 text-amber-400">1 domain / request</td>
                <td className="py-3.5 px-4 text-amber-400">~2-5 req/sec (strict)</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">$0.00 (Free)</td>
                <td className="py-3.5 px-4 text-zinc-300">All ICANN gTLDs</td>
                <td className="py-3.5 px-4 text-emerald-400 font-sans">
                  Authoritative registry JSON (Highest)
                </td>
              </tr>

              <tr className="hover:bg-zinc-900/40">
                <td className="py-3.5 px-4 font-semibold text-white font-sans">
                  WhoisXML API
                  <span className="block text-[11px] text-zinc-400 font-normal">Bulk Availability + Whois</span>
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">Up to 1,000 / POST</td>
                <td className="py-3.5 px-4 text-emerald-400">High (Tier dependent)</td>
                <td className="py-3.5 px-4 text-amber-400">~$0.003 / query</td>
                <td className="py-3.5 px-4 text-zinc-300">2,000+ TLDs</td>
                <td className="py-3.5 px-4 text-emerald-400 font-sans">
                  Full WHOIS parser + Registrar
                </td>
              </tr>

              <tr className="hover:bg-zinc-900/40">
                <td className="py-3.5 px-4 font-semibold text-white font-sans">
                  GoDaddy Domains API
                  <span className="block text-[11px] text-zinc-400 font-normal">Developer Portal</span>
                </td>
                <td className="py-3.5 px-4 text-emerald-400">Up to 500 / POST</td>
                <td className="py-3.5 px-4 text-zinc-400">60 req/min</td>
                <td className="py-3.5 px-4 text-zinc-300">Free w/ active account</td>
                <td className="py-3.5 px-4 text-zinc-300">All GoDaddy supported</td>
                <td className="py-3.5 px-4 text-zinc-300 font-sans">
                  Availability + Retail Pricing
                </td>
              </tr>

              <tr className="hover:bg-zinc-900/40">
                <td className="py-3.5 px-4 font-semibold text-white font-sans">
                  Authoritative DNS / DoH
                  <span className="block text-[11px] text-zinc-400 font-normal">Cloudflare 1.1.1.1 + Google</span>
                </td>
                <td className="py-3.5 px-4 text-emerald-400">Hundreds / sec</td>
                <td className="py-3.5 px-4 text-emerald-400">Essentially unlimited</td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">$0.00 (Free)</td>
                <td className="py-3.5 px-4 text-zinc-300">All registered domains</td>
                <td className="py-3.5 px-4 text-zinc-400 font-sans">
                  Active NS & NXDOMAIN Proof
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Why the Hybrid Architecture is Chosen */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Our Chosen Practical Architecture: The Multi-Tier Hybrid Engine
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-300">
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-2">
              <Zap className="w-4 h-4" />
              Tier 1: High-Speed Pre-Screening
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We leverage Cloudflare and Google DNS-over-HTTPS alongside native Node.js DNS resolution. This instantly identifies non-existent domains (authoritative NXDOMAIN) and confirms delegated nameservers in milliseconds at zero cost.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              Tier 2: Authoritative RDAP Enrichment
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              For registered domains and drill-down inspections, we query official ICANN RDAP registry endpoints (Verisign for .com/.net, PIR for .org, etc.) using IANA bootstrap maps. This returns registrar names, creation dates, expiration dates, and EPP status flags without relying on scrape hacks.
            </p>
          </div>
        </div>
      </div>

      {/* How to configure API keys */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            Configure Commercial API Keys
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            You can enter your WhoisXML API Key or GoDaddy Developer credentials anytime in Provider Settings or in your <code className="text-zinc-300 font-mono">.env</code> file (<code className="text-zinc-300 font-mono">WHOISXML_API_KEY</code>, <code className="text-zinc-300 font-mono">GODADDY_API_KEY</code>).
          </p>
        </div>
        <button
          onClick={onOpenSettings}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm shadow-indigo-600/30 transition-all shrink-0 flex items-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>Open Provider Settings</span>
        </button>
      </div>
    </div>
  );
};
