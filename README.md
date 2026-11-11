# Job Copilot MCP

> A Claude MCP server that helps job seekers find jobs, tailor resumes, write cover letters, prep for interviews, and track applications — all inside Claude.

## What It Does

| Tool | What it does |
|---|---|
| `save_profile` / `get_profile` | Store your skills, target roles, and experience |
| `save_resume` / `get_resume` | Store your resume so Claude can reference it |
| `search_jobs` | Find latest jobs from Remotive & Arbeitnow (no API key needed) |
| `get_resume_tailoring_prompt` | Tailor your resume to a specific job description (ATS-optimized) |
| `get_cover_letter_prompt` | Generate a personalized cover letter for any job |
| `analyze_job_match` | Get a match score and gap analysis against a job description |
| `get_interview_prep` | Get likely interview questions + STAR-method coaching |
| `track_application` | Track jobs you've applied to |
| `update_application` | Update application status |
| `list_applications` | See all tracked applications with status summary |

## Setup

### 1. Clone & Build

```bash
git clone https://github.com/YOUR_USERNAME/job-copilot-mcp
cd job-copilot-mcp
npm install
npm run build
```

### 2. Add to Claude

Add this to your Claude config file:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "job-copilot": {
      "command": "node",
      "args": ["/absolute/path/to/job-copilot-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You'll see the tools available in any conversation.

### 3. Add to Claude Code (CLI)

```bash
claude mcp add job-copilot node /absolute/path/to/job-copilot-mcp/dist/index.js
```

## Usage Examples

**Find remote React developer jobs:**
> "Search for remote React developer jobs"

**Tailor your resume:**
> "I have a job description. Can you tailor my resume for it?"  
> *(paste the JD — Claude fetches your saved resume and rewrites it)*

**Get interview ready:**
> "Help me prep for a Senior Product Manager interview"  
> *(paste the JD — Claude generates tailored questions + answers)*

**Track applications:**
> "Track that I applied to Stripe for Senior Engineer"

## Data Storage

Your profile, resume, and application data are stored locally at `~/.job-copilot/` — nothing is sent to any external server. Only job search queries hit the Remotive and Arbeitnow public APIs.

## Contributing

PRs welcome! Ideas for future tools:
- Salary benchmarking (via levels.fyi scraping)
- LinkedIn profile optimizer
- Follow-up email generator
- Skills gap course recommender

## License

MIT
