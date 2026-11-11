import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchJobs } from "./jobs.js";
import {
  saveProfile,
  getProfile,
  saveResume,
  getResume,
  addApplication,
  updateApplication,
  getApplications,
} from "./storage.js";

const server = new McpServer({
  name: "job-copilot",
  version: "1.0.0",
});

// ── Profile tools ──────────────────────────────────────────────

server.tool(
  "save_profile",
  "Save your job seeker profile (name, skills, target roles, location)",
  {
    name: z.string(),
    email: z.string().optional(),
    location: z.string().optional(),
    targetRoles: z.array(z.string()).describe("Roles you are targeting e.g. ['Software Engineer', 'Data Analyst']"),
    skills: z.array(z.string()).describe("Your key skills"),
    experienceYears: z.number().describe("Total years of work experience"),
    remoteOnly: z.boolean().optional().default(false),
  },
  async (args) => {
    saveProfile(args);
    return { content: [{ type: "text", text: `Profile saved for ${args.name}. You have ${args.skills.length} skills and ${args.experienceYears} years of experience.` }] };
  }
);

server.tool(
  "get_profile",
  "Retrieve your saved job seeker profile",
  {},
  async () => {
    const profile = getProfile();
    if (!profile) return { content: [{ type: "text", text: "No profile saved yet. Use save_profile to create one." }] };
    return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
  }
);

// ── Resume tools ───────────────────────────────────────────────

server.tool(
  "save_resume",
  "Save your current resume text so Claude can tailor it to job descriptions",
  { resumeText: z.string().describe("Your full resume in plain text") },
  async ({ resumeText }) => {
    saveResume(resumeText);
    return { content: [{ type: "text", text: `Resume saved (${resumeText.length} characters). Claude can now tailor it to any job description.` }] };
  }
);

server.tool(
  "get_resume",
  "Retrieve your saved resume",
  {},
  async () => {
    const resume = getResume();
    if (!resume) return { content: [{ type: "text", text: "No resume saved yet. Use save_resume to store it." }] };
    return { content: [{ type: "text", text: resume }] };
  }
);

server.tool(
  "get_resume_tailoring_prompt",
  "Get a ready-to-use prompt for tailoring your saved resume to a specific job description",
  { jobDescription: z.string().describe("Paste the full job description here") },
  async ({ jobDescription }) => {
    const resume = getResume();
    const profile = getProfile();
    if (!resume) return { content: [{ type: "text", text: "No resume found. Please save your resume first with save_resume." }] };

    const prompt = `You are an expert resume writer and ATS optimization specialist.

CANDIDATE PROFILE:
${profile ? JSON.stringify(profile, null, 2) : "No profile saved"}

CURRENT RESUME:
${resume}

TARGET JOB DESCRIPTION:
${jobDescription}

Please:
1. Rewrite the resume to match the job description, using keywords from the JD naturally
2. Quantify achievements where possible (add placeholder numbers if needed)
3. Reorder bullet points to prioritize most relevant experience
4. Flag any skills in the JD that are missing from the resume
5. Give an ATS match score (0-100) for the original vs tailored version

Keep it concise, action-verb led, and ATS-friendly.`;

    return { content: [{ type: "text", text: prompt }] };
  }
);

server.tool(
  "get_cover_letter_prompt",
  "Generate a prompt to write a personalized cover letter for a job",
  {
    jobDescription: z.string(),
    companyName: z.string(),
    tone: z.enum(["professional", "enthusiastic", "concise"]).default("professional"),
  },
  async ({ jobDescription, companyName, tone }) => {
    const resume = getResume();
    const profile = getProfile();

    const prompt = `Write a compelling, ${tone} cover letter for the following job at ${companyName}.

CANDIDATE INFO:
${profile ? `Name: ${profile.name}, Experience: ${profile.experienceYears} years, Skills: ${profile.skills.join(", ")}` : "Use details from the resume below"}

RESUME:
${resume || "No resume saved — use general best practices"}

JOB DESCRIPTION:
${jobDescription}

Requirements:
- 3 paragraphs max (opening hook, why I'm the fit, call to action)
- Reference 2-3 specific things from the job description
- Do NOT use generic phrases like "I am writing to apply for..."
- End with a confident but not arrogant close
- Keep it under 300 words`;

    return { content: [{ type: "text", text: prompt }] };
  }
);

// ── Job search tools ───────────────────────────────────────────

server.tool(
  "search_jobs",
  "Search for latest job listings from multiple free job boards (Remotive, Arbeitnow)",
  {
    query: z.string().describe("Job title, skills, or keywords e.g. 'React developer' or 'data analyst'"),
    remoteOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(10).describe("Number of results (max 20)"),
  },
  async ({ query, remoteOnly, limit }) => {
    const safeLimit = Math.min(limit ?? 10, 20);
    const jobs = await searchJobs(query, remoteOnly ?? false, safeLimit);

    if (!jobs.length) {
      return { content: [{ type: "text", text: `No jobs found for "${query}". Try broader keywords.` }] };
    }

    const output = jobs
      .map(
        (j, i) =>
          `${i + 1}. **${j.title}** at ${j.company}\n   📍 ${j.location} | 🕐 ${j.postedAt.split("T")[0]} | Source: ${j.source}\n   ${j.salary ? `💰 ${j.salary}\n   ` : ""}🔗 ${j.url}\n   Tags: ${j.tags.slice(0, 5).join(", ")}`
      )
      .join("\n\n");

    return { content: [{ type: "text", text: `Found ${jobs.length} jobs for "${query}":\n\n${output}` }] };
  }
);

server.tool(
  "analyze_job_match",
  "Get a prompt to analyze how well your saved resume matches a job description",
  { jobDescription: z.string() },
  async ({ jobDescription }) => {
    const resume = getResume();
    const profile = getProfile();

    const prompt = `Analyze how well this candidate matches the job description below.

CANDIDATE:
${profile ? JSON.stringify(profile, null, 2) : "No profile"}
${resume ? `\nRESUME:\n${resume}` : ""}

JOB DESCRIPTION:
${jobDescription}

Provide:
1. Match Score: X/100
2. Strong matches (skills/experience you have that the JD needs)
3. Gaps (what the JD requires that you're missing)
4. Quick wins (easy things to add/highlight to improve your score)
5. Verdict: Apply / Apply with modifications / Skip`;

    return { content: [{ type: "text", text: prompt }] };
  }
);

server.tool(
  "get_interview_prep",
  "Generate likely interview questions and tips for a specific job description",
  {
    jobDescription: z.string(),
    interviewType: z.enum(["behavioral", "technical", "mixed"]).default("mixed"),
  },
  async ({ jobDescription, interviewType }) => {
    const profile = getProfile();
    const prompt = `You are an experienced interview coach. Based on the job description below, generate interview preparation material.

${profile ? `CANDIDATE PROFILE:\n${JSON.stringify(profile, null, 2)}\n` : ""}
JOB DESCRIPTION:
${jobDescription}

Generate:
1. Top 5 likely ${interviewType} interview questions for this specific role
2. For each question: a STAR-method answer framework with hints
3. 3 questions the candidate should ask the interviewer
4. Key things to research before the interview
5. Red flags to watch out for in this role

Be specific to the job description, not generic.`;

    return { content: [{ type: "text", text: prompt }] };
  }
);

// ── Application tracker ────────────────────────────────────────

server.tool(
  "track_application",
  "Track a job application you have submitted",
  {
    company: z.string(),
    role: z.string(),
    url: z.string().optional(),
    status: z.enum(["saved", "applied", "interviewing", "offer", "rejected"]).default("applied"),
    notes: z.string().optional(),
  },
  async (args) => {
    const app = addApplication(args);
    return { content: [{ type: "text", text: `Tracked: ${app.role} at ${app.company} (${app.status}) — ID: ${app.id}` }] };
  }
);

server.tool(
  "update_application",
  "Update the status or notes of a tracked application",
  {
    id: z.string().describe("Application ID from track_application"),
    status: z.enum(["saved", "applied", "interviewing", "offer", "rejected"]).optional(),
    notes: z.string().optional(),
  },
  async ({ id, status, notes }) => {
    const app = updateApplication(id, { ...(status && { status }), ...(notes && { notes }) });
    if (!app) return { content: [{ type: "text", text: `No application found with ID ${id}` }] };
    return { content: [{ type: "text", text: `Updated: ${app.role} at ${app.company} → ${app.status}` }] };
  }
);

server.tool(
  "list_applications",
  "List all tracked job applications with their current status",
  {
    status: z.enum(["saved", "applied", "interviewing", "offer", "rejected", "all"]).optional().default("all"),
  },
  async ({ status }) => {
    const apps = getApplications();
    const filtered = status === "all" ? apps : apps.filter((a) => a.status === status);

    if (!filtered.length) return { content: [{ type: "text", text: "No applications tracked yet." }] };

    const summary = {
      saved: apps.filter((a) => a.status === "saved").length,
      applied: apps.filter((a) => a.status === "applied").length,
      interviewing: apps.filter((a) => a.status === "interviewing").length,
      offer: apps.filter((a) => a.status === "offer").length,
      rejected: apps.filter((a) => a.status === "rejected").length,
    };

    const list = filtered
      .map((a) => `• [${a.id}] ${a.role} at ${a.company} — ${a.status.toUpperCase()} (${a.appliedDate})${a.notes ? `\n  Notes: ${a.notes}` : ""}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `📊 Summary: ${summary.applied} applied | ${summary.interviewing} interviewing | ${summary.offer} offers | ${summary.rejected} rejected\n\n${list}`,
      }],
    };
  }
);

// ── Start ──────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
