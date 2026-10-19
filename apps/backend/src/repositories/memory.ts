import { randomUUID } from "node:crypto";
import type { Incident, IncidentEditable, IncidentRepository, User, UserRepository } from "../domain.js";

export class MemoryUserRepository implements UserRepository {
  private readonly users: User[] = [];
  async create(input: { email: string; name: string; passwordHash: string }): Promise<User> { const user: User = { ...input, id: randomUUID(), role: "user", createdAt: new Date() }; this.users.push(user); return user; }
  async findByEmail(email: string): Promise<User | null> { return this.users.find((user) => user.email === email) ?? null; }
  async findById(id: string): Promise<User | null> { return this.users.find((user) => user.id === id) ?? null; }
}

export class MemoryIncidentRepository implements IncidentRepository {
  private readonly incidents: Incident[] = [];
  async create(input: Omit<Incident, "id" | "createdAt" | "updatedAt">): Promise<Incident> { const now = new Date(); const incident = { ...input, id: randomUUID(), createdAt: now, updatedAt: now }; this.incidents.push(incident); return incident; }
  async listByUser(userId: string): Promise<Incident[]> { return this.incidents.filter((item) => item.userId === userId); }
  async findById(id: string): Promise<Incident | null> { return this.incidents.find((item) => item.id === id) ?? null; }
  async update(id: string, userId: string, input: IncidentEditable): Promise<Incident | null> { const item = this.incidents.find((candidate) => candidate.id === id && candidate.userId === userId); if (!item) return null; Object.assign(item, input, { updatedAt: new Date() }); return item; }
  async delete(id: string, userId: string): Promise<boolean> { const index = this.incidents.findIndex((item) => item.id === id && item.userId === userId); if (index < 0) return false; this.incidents.splice(index, 1); return true; }
}
