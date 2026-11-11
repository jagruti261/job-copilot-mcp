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
  const filtered = all
    .filter((j) =>
      matchesQuery(j.position || "", query) ||
      matchesQuery((j.tags || []).join(" "), query) ||
      matchesQuery(j.description || "", query)
    )
    .slice(0, limit);

  return filtered.map((j) => ({
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
  const all: any[] = res.data.results || [];
  const filtered = all
    .filter((j) =>
      matchesQuery(j.name || "", query) ||
      matchesQuery((j.categories || []).map((c: any) => c.name).join(" "), query) ||
      matchesQuery((j.levels || []).map((l: any) => l.name).join(" "), query)
    )
    .slice(0, limit);

  return filtered.map((j) => ({
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
  const all: any[] = res.data.data || [];
  const filtered = all
    .filter((j) =>
      matchesQuery(j.title || "", query) ||
      matchesQuery((j.tags || []).join(" "), query)
    )
    .slice(0, limit);

  return filtered.map((j) => ({
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

export async function searchJobs(query: string, remoteOnly: boolean, limit: number): Promise<Job[]> {
  const perSource = Math.ceil(limit / (remoteOnly ? 3 : 4));

  const sources = [
    searchRemotive(query, perSource),
    searchRemoteOK(query, perSource),
    searchTheMuse(query, perSource),
    ...(remoteOnly ? [] : [searchArbeitnow(query, perSource)]),
  ];

  const results = await Promise.allSettled(sources);

  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") jobs.push(...r.value);
    // silently skip failed sources so one down doesn't break everything
  }

  // deduplicate by title+company, sort newest first
  const seen = new Set<string>();
  return jobs
    .filter((j) => {
      const key = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.postedAt > a.postedAt ? 1 : -1))
    .slice(0, limit);
}
