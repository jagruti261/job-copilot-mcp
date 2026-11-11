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

export async function searchRemotive(query: string, limit = 10): Promise<Job[]> {
  const res = await axios.get("https://remotive.com/api/remote-jobs", {
    params: { search: query, limit },
    timeout: 8000,
  });
  return (res.data.jobs || []).slice(0, limit).map((j: any) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    url: j.url,
    description: j.description?.replace(/<[^>]*>/g, "").slice(0, 500) + "...",
    tags: j.tags || [],
    postedAt: j.publication_date,
    salary: j.salary || undefined,
    remote: true,
    source: "Remotive",
  }));
}

export async function searchArbeitnow(query: string, limit = 10): Promise<Job[]> {
  const res = await axios.get("https://arbeitnow.com/api/job-board-api", {
    timeout: 8000,
  });
  const all: any[] = res.data.data || [];
  const filtered = all
    .filter((j) =>
      j.title?.toLowerCase().includes(query.toLowerCase()) ||
      j.description?.toLowerCase().includes(query.toLowerCase()) ||
      j.tags?.some((t: string) => t.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, limit);

  return filtered.map((j) => ({
    id: `arbeitnow-${j.slug}`,
    title: j.title,
    company: j.company_name,
    location: j.location || "Remote",
    url: j.url,
    description: j.description?.replace(/<[^>]*>/g, "").slice(0, 500) + "...",
    tags: j.tags || [],
    postedAt: j.created_at,
    salary: undefined,
    remote: j.remote || false,
    source: "Arbeitnow",
  }));
}

export async function searchJobs(query: string, remoteOnly: boolean, limit: number): Promise<Job[]> {
  const results = await Promise.allSettled([
    searchRemotive(query, Math.ceil(limit / 2)),
    remoteOnly ? Promise.resolve([]) : searchArbeitnow(query, Math.ceil(limit / 2)),
  ]);

  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") jobs.push(...r.value);
  }
  return jobs.slice(0, limit);
}
