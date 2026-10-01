import type { DomainProvider } from './DomainProvider.ts';
import { RDAPProvider } from './RDAPProvider.ts';
import { DNSDoHProvider } from './DNSDoHProvider.ts';
import { WhoisXMLProvider } from './WhoisXMLProvider.ts';
import { GoDaddyProvider } from './GoDaddyProvider.ts';
import { HybridProvider } from './HybridProvider.ts';

export class ProviderRegistry {
  private static instance: ProviderRegistry;

  public rdap: RDAPProvider;
  public dns: DNSDoHProvider;
  public whoisxml: WhoisXMLProvider;
  public godaddy: GoDaddyProvider;
  public hybrid: HybridProvider;

  private activeProviderId = 'hybrid';

  private constructor() {
    this.rdap = new RDAPProvider(250);
    this.dns = new DNSDoHProvider();
    this.whoisxml = new WhoisXMLProvider();
    this.godaddy = new GoDaddyProvider();
    this.hybrid = new HybridProvider(this.rdap, this.dns);

    // Warm up IANA bootstrap asynchronously
    this.rdap.loadIanaBootstrap().catch(() => {});
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public getProvider(id?: string): DomainProvider {
    const target = (id || this.activeProviderId).toLowerCase();
    switch (target) {
      case 'rdap':
        return this.rdap;
      case 'dns':
        return this.dns;
      case 'whoisxml':
        return this.whoisxml;
      case 'godaddy':
        return this.godaddy;
      case 'hybrid':
      default:
        return this.hybrid;
    }
  }

  public setActiveProvider(id: string) {
    this.activeProviderId = id;
  }

  public getActiveProviderId(): string {
    return this.activeProviderId;
  }

  public updateCredentials(keys: {
    whoisxmlKey?: string;
    godaddyKey?: string;
    godaddySecret?: string;
    activeProvider?: string;
  }) {
    if (keys.whoisxmlKey !== undefined) {
      this.whoisxml.setApiKey(keys.whoisxmlKey);
    }
    if (keys.godaddyKey !== undefined && keys.godaddySecret !== undefined) {
      this.godaddy.setCredentials(keys.godaddyKey, keys.godaddySecret);
    }
    if (keys.activeProvider) {
      this.activeProviderId = keys.activeProvider;
    }
  }

  public getStatus() {
    return {
      activeProvider: this.activeProviderId,
      providers: [
        {
          id: 'hybrid',
          name: 'Authoritative Hybrid (DNS + RDAP)',
          description: 'High-speed DNS screening with ICANN RDAP registrar & expiry enrichment. Recommended (Free, No API key needed).',
          configured: true,
          free: true
        },
        {
          id: 'dns',
          name: 'Authoritative DNS / DoH',
          description: 'Ultra high-speed DNS-over-HTTPS querying Cloudflare & Google public DNS. Excellent for massive 5,000 batches.',
          configured: true,
          free: true
        },
        {
          id: 'rdap',
          name: 'Direct ICANN RDAP',
          description: 'Official ICANN RDAP REST endpoints with rate limiting & IANA routing.',
          configured: true,
          free: true
        },
        {
          id: 'whoisxml',
          name: 'WhoisXML Bulk Availability API',
          description: 'Commercial API supporting 1,000 domains per request and full WHOIS records.',
          configured: !!this.whoisxml.getApiKey(),
          free: false
        },
        {
          id: 'godaddy',
          name: 'GoDaddy Domains API',
          description: 'Commercial developer API supporting up to 500 domains per batch.',
          configured: !!process.env.GODADDY_API_KEY,
          free: false
        }
      ]
    };
  }
}
