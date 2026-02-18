# Firecrawl Integration for VC Sourcing Enrichment

## Overview
Integrate Firecrawl's web scraping API into the existing enrichment pipeline to provide deeper research on startups and founders. Firecrawl complements the existing Exa.ai search by providing full-page content extraction, structured data extraction, and JavaScript-rendered page scraping.

## Architecture
- **Exa.ai** = Search & discovery (find URLs, LinkedIn profiles, news articles)
- **Firecrawl** = Deep scraping (extract full content, structured data from found URLs)
- Together they provide: Search → Find URLs → Deep scrape → Structured extraction

## API Reference

### Authentication
- **Base URL**: `https://api.firecrawl.dev/v2`
- **Auth Header**: `Authorization: Bearer fc-YOUR-API-KEY`
- **Content-Type**: `application/json`

### Key Endpoints

#### 1. `/v2/scrape` (POST) - Core endpoint
Scrapes a single URL and returns clean content.
```typescript
// Request
{
  url: string,           // Required: URL to scrape
  formats: string[],     // ["markdown", "json", "html", "links", "screenshot"]
  only_main_content: boolean, // Focus on primary content (recommended: true)
  timeout: number,       // Request timeout in ms
}

// Response
{
  success: boolean,
  data: {
    markdown: string,    // Clean LLM-ready content
    metadata: {
      title: string,
      description: string,
      sourceURL: string,
      statusCode: number,
    }
  }
}
```

#### 2. `/v2/scrape` with JSON extraction
Structured data extraction using schema or prompt.
```typescript
// Request with schema
{
  url: "https://startup-website.com",
  formats: [{
    type: "json",
    schema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        description: { type: "string" },
        productDescription: { type: "string" },
        teamMembers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              linkedIn: { type: "string" },
            }
          }
        },
        techStack: { type: "array", items: { type: "string" } },
        pricing: { type: "string" },
        fundingInfo: { type: "string" },
      }
    }
  }]
}

// Request with prompt (simpler, no schema needed)
{
  url: "https://startup-website.com",
  formats: [{
    type: "json",
    prompt: "Extract the company name, what the product does, team members with their roles, technologies used, and any funding information"
  }]
}
```

#### 3. `/v2/extract` (POST) - Multi-URL structured extraction
Extract structured data from multiple URLs.
```typescript
// Request
{
  urls: ["https://startup.com", "https://startup.com/about"],
  prompt: "Extract company info, team members, and product details",
  schema: { /* JSON Schema */ },
  enableWebSearch: boolean, // Expand beyond specified URLs
}

// Response
{
  success: true,
  data: { /* extracted structured data */ },
  status: "completed"
}
```

#### 4. `/v2/map` (POST) - Discover all URLs on a site
```typescript
// Request
{ url: "https://startup-website.com" }

// Response
{ success: true, links: ["https://startup.com/about", "https://startup.com/team", ...] }
```

### Rate Limits & Pricing
- **Free tier**: 500 credits (1 credit = 1 scrape or 1 crawled page)
- **Hobby**: $20/mo for 3,000 credits
- **Standard**: $100/mo for 100,000 credits
- **Extract**: Uses token-based billing (15 tokens per credit)
- Failed requests are not charged

### Node.js SDK
```bash
npm install @mendable/firecrawl-js
```
```typescript
import Firecrawl from '@mendable/firecrawl-js';
const firecrawl = new Firecrawl({ apiKey: "fc-YOUR-API-KEY" });

// Simple scrape
const doc = await firecrawl.scrape('https://example.com', { formats: ['markdown'] });

// Structured extraction
const data = await firecrawl.extract({
  urls: ['https://startup.com'],
  prompt: 'Extract company info',
  schema: { /* JSON Schema */ }
});
```

### Error Handling
- Check `response.success` boolean
- HTTP 429 for rate limiting (implement exponential backoff)
- HTTP 402 for credit exhaustion
- Timeout errors for slow/unreachable pages

---

## Implementation Steps

### Phase 1: Settings & API Key Storage

#### 1.1 Add Firecrawl API key to userSettings schema
**File**: `convex/schema.ts`
- Add `firecrawlApiKey: v.optional(v.string())` to the `userSettings` table

#### 1.2 Add Firecrawl API key input to Settings page
**File**: `app/sourcing/settings/page.tsx` (or wherever settings UI is)
- Add a new input field for "Firecrawl API Key" in the API Keys section
- Follow the same pattern as the existing Exa and Crunchbase API key fields
- Include a link to https://www.firecrawl.dev to get an API key

### Phase 2: Startup Website Deep Scraping

#### 2.1 Create Firecrawl helper functions
**File**: `convex/autoSourcing.ts` (add to existing file)

```typescript
// Firecrawl API base URL
const FIRECRAWL_API = "https://api.firecrawl.dev/v2";

// Scrape a startup website with Firecrawl for deep content extraction
async function scrapeWithFirecrawl(
  apiKey: string,
  url: string
): Promise<{ markdown: string; metadata: { title?: string; description?: string } } | null> {
  try {
    const response = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        only_main_content: true,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl scrape error:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.success) return null;

    return {
      markdown: data.data.markdown || "",
      metadata: data.data.metadata || {},
    };
  } catch (error) {
    console.error("Firecrawl scrape exception:", error);
    return null;
  }
}

// Extract structured startup data from a website using Firecrawl
async function extractStartupDataWithFirecrawl(
  apiKey: string,
  url: string
): Promise<{
  description?: string;
  productDescription?: string;
  teamMembers?: Array<{ name: string; role: string; linkedIn?: string }>;
  techStack?: string[];
  businessModel?: string;
  pricing?: string;
  fundingInfo?: string;
} | null> {
  try {
    const response = await fetch(`${FIRECRAWL_API}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [{
          type: "json",
          prompt: "Extract: company description, what the product does (product description), team members with names and roles and LinkedIn URLs if visible, technologies/tech stack mentioned, business model (B2B/B2C/marketplace/etc), pricing model, and any funding or investment information mentioned",
        }],
        only_main_content: true,
        timeout: 30000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;

    return data.data.json || null;
  } catch (error) {
    console.error("Firecrawl extract error:", error);
    return null;
  }
}
```

#### 2.2 Map a startup's website to find key pages
```typescript
// Discover all pages on a startup's website
async function mapStartupWebsite(
  apiKey: string,
  url: string
): Promise<string[]> {
  try {
    const response = await fetch(`${FIRECRAWL_API}/map`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.links || [];
  } catch (error) {
    console.error("Firecrawl map error:", error);
    return [];
  }
}
```

### Phase 3: Integrate into Enrichment Pipeline

#### 3.1 Add Firecrawl to `enrichCompanyDeep`
**File**: `convex/autoSourcing.ts`

In the existing `enrichCompanyDeep` function, after finding the startup's website via Exa, use Firecrawl to:
1. **Map** the website to find /about, /team, /pricing pages
2. **Scrape** key pages for deep content (markdown)
3. **Extract** structured data (team members, tech stack, business model, funding)
4. Merge Firecrawl data with existing Exa data (Firecrawl takes priority for website content)

#### 3.2 Add Firecrawl to `reEnrichAllFounders`
- Pass `firecrawlApiKey` as an optional arg
- After Exa-based company enrichment, run Firecrawl deep scrape if key is available
- Use structured extraction to discover team members not found via Companies House

#### 3.3 Add Firecrawl to news article scraping
- When Exa finds news article URLs, use Firecrawl to scrape full article content
- Extract funding amounts, investor names, and round details more accurately
- Store richer article summaries in `newsArticles` field

### Phase 4: Enhanced Founder Discovery via Team Pages

#### 4.1 Discover founders from startup websites
Using Firecrawl's structured extraction on /about and /team pages:
- Extract names, roles, LinkedIn URLs, and bios of team members
- Cross-reference with existing Companies House officers
- Auto-create new founder records for discovered team members
- This catches founders that Companies House doesn't list (advisors, CTOs who aren't directors)

### Phase 5: UI Updates

#### 5.1 Add Firecrawl status to enrichment results
**File**: `app/sourcing/discover/page.tsx`
- Add "Pages Scraped" count to the re-enrichment results card
- Show Firecrawl credit usage if available

#### 5.2 Add Firecrawl data display to startup detail view
- Show extracted product description prominently
- Display discovered team members from website
- Show tech stack badges
- Display scraped pricing/business model info

---

## Data Flow

```
1. Companies House → Discover startup + officers
2. Exa.ai Search → Find LinkedIn profiles, news URLs, company website
3. Firecrawl Map → Find /about, /team, /pricing pages on website
4. Firecrawl Scrape → Get full markdown content from key pages
5. Firecrawl Extract → Structured data (team, tech, funding, pricing)
6. Merge all data → Update startup + founder records in Convex
```

## Schema Changes Needed

### `userSettings` table
```typescript
firecrawlApiKey: v.optional(v.string()),
```

### `startups` table (optional additions)
```typescript
firecrawlScrapedAt: v.optional(v.number()),  // When last scraped
pricingModel: v.optional(v.string()),         // Extracted pricing info
discoveredTeamMembers: v.optional(v.array(v.object({
  name: v.string(),
  role: v.optional(v.string()),
  linkedInUrl: v.optional(v.string()),
  source: v.string(), // "firecrawl_website"
}))),
```

## Credit Budget Estimate
Per startup enrichment with Firecrawl:
- 1 credit: Map website URLs
- 1-3 credits: Scrape key pages (homepage, about, team)
- 1-2 credits: Structured extraction
- **Total: ~3-6 credits per startup**

At 500 free credits, you can deep-enrich ~80-160 startups for free.
