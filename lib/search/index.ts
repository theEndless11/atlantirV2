/**
 * lib/search/index.ts
 *
 * Content ingestion + web search — spec §14.7.
 * Everything behind two narrow interfaces: ContentFetcher and WebSearch.
 * Swap providers by changing which implementation is exported — no agent code changes.
 *
 * ContentFetcher providers (in priority order):
 *   1. Firecrawl  — primary, full-site crawl + clean markdown
 *   2. Jina       — fallback single-URL, zero-cost
 *   3. Cloudflare Browser Rendering — JS-heavy pages Firecrawl misses
 *
 * WebSearch providers (selected by workspace tier):
 *   1. Serper     — default, fast Google results
 *   2. Exa        — semantic / research queries
 *   3. SearXNG+Tor — privacy tier (self-hosted on Fly.io)
 */

// ---------------------------------------------------------------------------
// Interfaces (spec §14.7 verbatim)
// ---------------------------------------------------------------------------

export interface SearchHit {
  title: string
  url: string
  snippet: string
  publishedAt?: string
}

export interface ContentFetcher {
  fetchUrl(url: string): Promise<{ title: string; markdown: string; html?: string }>
  crawlSite(rootUrl: string, opts: { maxPages: number }): Promise<{ pages: Array<{ url: string; markdown: string }> }>
}

export interface WebSearch {
  search(query: string, opts?: { count?: number; region?: string }): Promise<{ results: SearchHit[] }>
}

// ---------------------------------------------------------------------------
// ContentFetcher — Firecrawl (primary)
// ---------------------------------------------------------------------------

class FirecrawlFetcher implements ContentFetcher {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor() {
    this.baseUrl = process.env.FIRECRAWL_URL ?? 'https://api.firecrawl.dev'
    this.apiKey = process.env.FIRECRAWL_API_KEY ?? ''
  }

  async fetchUrl(url: string): Promise<{ title: string; markdown: string; html?: string }> {
    const res = await fetch(`${this.baseUrl}/v1/scrape`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'html'] }),
    })
    if (!res.ok) throw new Error(`Firecrawl scrape failed: ${res.status}`)
    const data = await res.json()
    return {
      title: data.data?.metadata?.title ?? url,
      markdown: data.data?.markdown ?? '',
      html: data.data?.html,
    }
  }

  async crawlSite(rootUrl: string, opts: { maxPages: number }): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
    // Start crawl job
    const startRes = await fetch(`${this.baseUrl}/v1/crawl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rootUrl, limit: opts.maxPages, scrapeOptions: { formats: ['markdown'] } }),
    })
    if (!startRes.ok) throw new Error(`Firecrawl crawl failed: ${startRes.status}`)
    const { id: jobId } = await startRes.json()

    // Poll until complete (max 60s)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const pollRes = await fetch(`${this.baseUrl}/v1/crawl/${jobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      const poll = await pollRes.json()
      if (poll.status === 'completed') {
        return {
          pages: (poll.data ?? []).map((p: { url: string; markdown: string }) => ({
            url: p.url,
            markdown: p.markdown ?? '',
          })),
        }
      }
    }
    throw new Error(`Firecrawl crawl timed out for ${rootUrl}`)
  }
}

// ---------------------------------------------------------------------------
// ContentFetcher — Jina Reader (fallback, zero-cost)
// ---------------------------------------------------------------------------

class JinaFetcher implements ContentFetcher {
  async fetchUrl(url: string): Promise<{ title: string; markdown: string }> {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/markdown', 'X-Return-Format': 'markdown' },
    })
    if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
    const markdown = await res.text()
    // Jina embeds the title in the first line: "Title: ..."
    const titleMatch = markdown.match(/^Title:\s*(.+)/m)
    return { title: titleMatch?.[1]?.trim() ?? url, markdown }
  }

  async crawlSite(rootUrl: string, opts: { maxPages: number }): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
    // Jina doesn't support crawling — fetch root only
    const page = await this.fetchUrl(rootUrl)
    return { pages: [{ url: rootUrl, markdown: page.markdown }] }
  }
}

// ---------------------------------------------------------------------------
// ContentFetcher — Cloudflare Browser Rendering (JS-heavy pages)
// ---------------------------------------------------------------------------

class CloudflareBrowserFetcher implements ContentFetcher {
  private readonly accountId: string
  private readonly apiToken: string

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN ?? ''
  }

  async fetchUrl(url: string): Promise<{ title: string; markdown: string; html?: string }> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser-rendering/snapshot`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }
    )
    if (!res.ok) throw new Error(`Cloudflare Browser Rendering failed: ${res.status}`)
    const data = await res.json()
    const html: string = data.result?.html ?? ''
    // Convert HTML to markdown via a simple strip (full conversion handled server-side ideally)
    const markdown = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return { title: url, markdown, html }
  }

  async crawlSite(rootUrl: string, opts: { maxPages: number }): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
    const page = await this.fetchUrl(rootUrl)
    return { pages: [{ url: rootUrl, markdown: page.markdown }] }
  }
}

// ---------------------------------------------------------------------------
// Smart ContentFetcher — tries providers in order, falls back on error
// ---------------------------------------------------------------------------

class SmartContentFetcher implements ContentFetcher {
  private firecrawl = new FirecrawlFetcher()
  private jina = new JinaFetcher()
  private cf = new CloudflareBrowserFetcher()

  async fetchUrl(url: string): Promise<{ title: string; markdown: string; html?: string }> {
    // Try Firecrawl first (best quality)
    if (process.env.FIRECRAWL_API_KEY) {
      try {
        return await this.firecrawl.fetchUrl(url)
      } catch (e) {
        console.warn(`[search/fetch] Firecrawl failed for ${url}:`, e)
      }
    }

    // Try Cloudflare for JS-heavy pages
    if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
      try {
        return await this.cf.fetchUrl(url)
      } catch (e) {
        console.warn(`[search/fetch] Cloudflare BR failed for ${url}:`, e)
      }
    }

    // Jina always works (no key needed)
    return this.jina.fetchUrl(url)
  }

  async crawlSite(rootUrl: string, opts: { maxPages: number }): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
    if (process.env.FIRECRAWL_API_KEY) {
      try {
        return await this.firecrawl.crawlSite(rootUrl, opts)
      } catch (e) {
        console.warn(`[search/crawl] Firecrawl failed for ${rootUrl}:`, e)
      }
    }
    return this.jina.crawlSite(rootUrl, opts)
  }
}

// ---------------------------------------------------------------------------
// WebSearch — Serper (default)
// ---------------------------------------------------------------------------

class SerperSearch implements WebSearch {
  async search(query: string, opts?: { count?: number; region?: string }): Promise<{ results: SearchHit[] }> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: opts?.count ?? 5, gl: opts?.region }),
    })
    if (!res.ok) throw new Error(`Serper search failed: ${res.status}`)
    const data = await res.json()
    const results: SearchHit[] = (data.organic ?? []).map((r: { title: string; link: string; snippet: string; date?: string }) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      publishedAt: r.date,
    }))
    return { results }
  }
}

// ---------------------------------------------------------------------------
// WebSearch — Exa (semantic / research)
// ---------------------------------------------------------------------------

class ExaSearch implements WebSearch {
  async search(query: string, opts?: { count?: number }): Promise<{ results: SearchHit[] }> {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': process.env.EXA_API_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        numResults: opts?.count ?? 5,
        useAutoprompt: true,
        type: 'neural',
      }),
    })
    if (!res.ok) throw new Error(`Exa search failed: ${res.status}`)
    const data = await res.json()
    const results: SearchHit[] = (data.results ?? []).map((r: { title: string; url: string; text: string; publishedDate?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.slice(0, 300) ?? '',
      publishedAt: r.publishedDate,
    }))
    return { results }
  }
}

// ---------------------------------------------------------------------------
// WebSearch — SearXNG+Tor (privacy tier, self-hosted on Fly.io)
// ---------------------------------------------------------------------------

class SearXNGSearch implements WebSearch {
  private readonly baseUrl: string

  constructor() {
    // Internal Fly.io endpoint: https://search.atlantir.internal
    this.baseUrl = process.env.SEARXNG_URL ?? 'http://localhost:8080'
  }

  async search(query: string, opts?: { count?: number }): Promise<{ results: SearchHit[] }> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      engines: 'google,bing,duckduckgo,brave',
    })
    const res = await fetch(`${this.baseUrl}/search?${params}`)
    if (!res.ok) throw new Error(`SearXNG search failed: ${res.status}`)
    const data = await res.json()
    const results: SearchHit[] = (data.results ?? []).slice(0, opts?.count ?? 5).map(
      (r: { title: string; url: string; content: string; publishedDate?: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content ?? '',
        publishedAt: r.publishedDate,
      })
    )
    return { results }
  }
}

// ---------------------------------------------------------------------------
// Smart WebSearch — selects provider based on workspace tier / query type
// ---------------------------------------------------------------------------

export type SearchMode = 'default' | 'semantic' | 'privacy'

class SmartWebSearch implements WebSearch {
  private serper = new SerperSearch()
  private exa = new ExaSearch()
  private searxng = new SearXNGSearch()

  constructor(private mode: SearchMode = 'default') {}

  async search(query: string, opts?: { count?: number; region?: string }): Promise<{ results: SearchHit[] }> {
    if (this.mode === 'privacy') {
      try {
        return await this.searxng.search(query, opts)
      } catch (e) {
        console.warn('[search] SearXNG failed, falling back to Serper:', e)
        // Falls through to Serper
      }
    }

    if (this.mode === 'semantic' && process.env.EXA_API_KEY) {
      try {
        return await this.exa.search(query, opts)
      } catch (e) {
        console.warn('[search] Exa failed, falling back to Serper:', e)
      }
    }

    if (process.env.SERPER_API_KEY) {
      return this.serper.search(query, opts)
    }

    // No API keys configured — return empty (agent will note it)
    return { results: [] }
  }
}

// ---------------------------------------------------------------------------
// Singleton exports used throughout the app
// ---------------------------------------------------------------------------

export const contentFetcher: ContentFetcher = new SmartContentFetcher()

/** Get a WebSearch instance for the given mode */
export function getWebSearch(mode: SearchMode = 'default'): WebSearch {
  return new SmartWebSearch(mode)
}

/** Default search for most agent calls */
export const webSearch: WebSearch = new SmartWebSearch('default')
