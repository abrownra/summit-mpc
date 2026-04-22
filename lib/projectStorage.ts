import { SavedProject } from "@/lib/types";

const STORAGE_KEY = "summit-mpc-projects";

export function listProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProject(project: SavedProject): void {
  const all = listProjects().filter(p => p.id !== project.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([project, ...all]));
}

export function deleteProject(id: string): void {
  const all = listProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
