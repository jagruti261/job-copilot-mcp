import fs from "fs";
import path from "path";
import os from "os";

const DATA_DIR = path.join(os.homedir(), ".job-copilot");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const RESUME_FILE = path.join(DATA_DIR, "resume.txt");
const APPS_FILE = path.join(DATA_DIR, "applications.json");
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json");

export interface ApiKeys {
  jsearchRapidApiKey?: string;
}

export function saveApiKeys(keys: ApiKeys): void {
  ensureDir();
  const existing = getApiKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ ...existing, ...keys }, null, 2));
}

export function getApiKeys(): ApiKeys {
  if (!fs.existsSync(KEYS_FILE)) return {};
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Profile {
  name: string;
  email?: string;
  location?: string;
  targetRoles: string[];
  skills: string[];
  experienceYears: number;
  remoteOnly?: boolean;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  url?: string;
  status: "applied" | "interviewing" | "offer" | "rejected" | "saved";
  appliedDate: string;
  notes?: string;
}

export function saveProfile(profile: Profile): void {
  ensureDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

export function getProfile(): Profile | null {
  if (!fs.existsSync(PROFILE_FILE)) return null;
  return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"));
}

export function saveResume(text: string): void {
  ensureDir();
  fs.writeFileSync(RESUME_FILE, text);
}

export function getResume(): string | null {
  if (!fs.existsSync(RESUME_FILE)) return null;
  return fs.readFileSync(RESUME_FILE, "utf-8");
}

export function getApplications(): Application[] {
  if (!fs.existsSync(APPS_FILE)) return [];
  return JSON.parse(fs.readFileSync(APPS_FILE, "utf-8"));
}

export function addApplication(app: Omit<Application, "id" | "appliedDate">): Application {
  ensureDir();
  const apps = getApplications();
  const newApp: Application = {
    ...app,
    id: Date.now().toString(),
    appliedDate: new Date().toISOString().split("T")[0],
  };
  apps.push(newApp);
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
  return newApp;
}

export function updateApplication(id: string, updates: Partial<Application>): Application | null {
  const apps = getApplications();
  const idx = apps.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  apps[idx] = { ...apps[idx], ...updates };
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
  return apps[idx];
}
