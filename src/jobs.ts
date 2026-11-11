import axios from "axios";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  tags: string[];
  postedAt: string;
  salary?: string;
  remote: boolean;
  source: string;
}

function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/);
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

// ── Primary: JSearch (LinkedIn + Indeed + Google Jobs + Glassdoor) ──────────
// Free tier: 200 req/month — get key at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
async function searchJSearch(query: string, limit: number, apiKey: string): Promise<Job[]> {
  const res = await axios.get("https://jsearch.p.rapidapi.com/search", {
    params: { query, page: 1, num_pages: 1, date_posted: "month" },
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    timeout: 10000,
  });

  return (res.data.data || []).slice(0, limit).map((j: any) => ({
    id: `jsearch-${j.job_id}`,
    title: j.job_title,
    company: j.employer_name,
    location: j.job_city ? `${j.job_city}, ${j.job_country}` : (j.job_country || "Unknown"),
    url: j.job_apply_link || j.job_google_link,
    description: stripHtml(j.job_description || "").slice(0, 400),
    tags: j.job_required_skills || [],
    postedAt: j.job_posted_at_datetime_utc?.split("T")[0] || "",
    salary: j.job_min_salary ? `$${j.job_min_salary}–$${j.job_max_salary}` : undefined,
    remote: j.job_is_remote || false,
    source: j.job_publisher || "LinkedIn/Indeed",
  }));
}

// ── Fallback sources (no API key needed) ────────────────────────────────────

async function searchRemotive(query: string, limit: number): Promise<Job[]> {
  const res = await axios.get("https://remotive.com/api/remote-jobs", {
    params: { search: query, limit: limit * 2 },
    timeout: 8000,
  });
  return (res.data.jobs || []).slice(0, limit).map((j: any) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Worldwide",
    url: j.url,
    description: stripHtml(j.description || "").slice(0, 400),
    tags: j.tags || [],
    postedAt: j.publication_date?.split("T")[0] || "",
    salary: j.salary || undefined,
    remote: true,
    source: "Remotive",
  }));
}

async function searchRemoteOK(query: string, limit: number): Promise<Job[]> {
  const res = await axios.get("https://remoteok.com/api", {
    headers: { "User-Agent": "job-copilot-mcp/1.0" },
    timeout: 8000,
  });
  const all: any[] = (res.data || []).filter((j: any) => j.id);
  return all
    .filter((j) =>
      matchesQuery(j.position || "", query) ||
      matchesQuery((j.tags || []).join(" "), query)
    )
    .slice(0, limit)
    .map((j) => ({
      id: `remoteok-${j.id}`,
      title: j.position,
      company: j.company,
      location: "Remote",
      url: j.url,
      description: stripHtml(j.description || "").slice(0, 400),
      tags: j.tags || [],
      postedAt: j.date?.split("T")[0] || "",
      salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : undefined,
      remote: true,
      source: "RemoteOK",
    }));
}

async function searchTheMuse(query: string, limit: number): Promise<Job[]> {
  const res = await axios.get("https://www.themuse.com/api/public/jobs", {
    params: { page: 0, descending: true },
    timeout: 8000,
  });
  return (res.data.results || [])
    .filter((j: any) =>
      matchesQuery(j.name || "", query) ||
      matchesQuery((j.categories || []).map((c: any) => c.name).join(" "), query)
    )
    .slice(0, limit)
    .map((j: any) => ({
      id: `muse-${j.id}`,
      title: j.name,
      company: j.company?.name || "Unknown",
      location: j.locations?.map((l: any) => l.name).join(", ") || "Unknown",
      url: j.refs?.landing_page || "",
      description: stripHtml(j.contents || "").slice(0, 400),
      tags: j.categories?.map((c: any) => c.name) || [],
      postedAt: j.publication_date?.split("T")[0] || "",
      salary: undefined,
      remote: (j.locations || []).some((l: any) => l.name?.toLowerCase().includes("remote")),
      source: "The Muse",
    }));
}

async function searchArbeitnow(query: string, limit: number): Promise<Job[]> {
  const res = await axios.get("https://arbeitnow.com/api/job-board-api", {
    timeout: 8000,
  });
  return (res.data.data || [])
    .filter((j: any) =>
      matchesQuery(j.title || "", query) ||
      matchesQuery((j.tags || []).join(" "), query)
    )
    .slice(0, limit)
    .map((j: any) => ({
      id: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location || "Remote",
      url: j.url,
      description: stripHtml(j.description || "").slice(0, 400),
      tags: j.tags || [],
      postedAt: new Date(j.created_at * 1000).toISOString().split("T")[0],
      salary: undefined,
      remote: j.remote || false,
      source: "Arbeitnow",
    }));
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function searchJobs(
  query: string,
  remoteOnly: boolean,
  limit: number,
  jsearchApiKey?: string
): Promise<{ jobs: Job[]; sources: string[]; note?: string }> {
  const tasks: Promise<Job[]>[] = [];
  const sourceNames: string[] = [];

  if (jsearchApiKey) {
    // LinkedIn + Indeed + Google Jobs + Glassdoor go first
    tasks.push(searchJSearch(query, Math.ceil(limit * 0.6), jsearchApiKey));
    sourceNames.push("LinkedIn/Indeed/Google Jobs/Glassdoor");
    tasks.push(searchRemotive(query, Math.ceil(limit * 0.2)));
    sourceNames.push("Remotive");
    tasks.push(searchRemoteOK(query, Math.ceil(limit * 0.2)));
    sourceNames.push("RemoteOK");
  } else {
    tasks.push(searchRemotive(query, Math.ceil(limit / 4)));
    sourceNames.push("Remotive");
    tasks.push(searchRemoteOK(query, Math.ceil(limit / 4)));
    sourceNames.push("RemoteOK");
    tasks.push(searchTheMuse(query, Math.ceil(limit / 4)));
    sourceNames.push("The Muse");
    if (!remoteOnly) {
      tasks.push(searchArbeitnow(query, Math.ceil(limit / 4)));
      sourceNames.push("Arbeitnow");
    }
  }

  const results = await Promise.allSettled(tasks);
  const successSources: string[] = [];
  const jobs: Job[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      jobs.push(...r.value);
      successSources.push(sourceNames[i]);
    }
  });

  // deduplicate and sort newest first
  const seen = new Set<string>();
  const unique = jobs
    .filter((j) => {
      const key = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.postedAt > a.postedAt ? 1 : -1))
    .slice(0, limit);

  const note = jsearchApiKey
    ? undefined
    : "💡 To also search LinkedIn, Indeed & Google Jobs: use setup_api_keys with a free RapidAPI key from rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch";

  return { jobs: unique, sources: successSources, note };
}
