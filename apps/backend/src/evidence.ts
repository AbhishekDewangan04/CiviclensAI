import type { Evidence, EvidenceRepository } from "./domain.js";

export const baselineVerification: Evidence["verification"] = {
  method: "rule_based_text_only",
  assessment: "image_analysis_unavailable",
};

export class EvidenceService {
  constructor(private readonly repository: EvidenceRepository) {}

  async submit(input: { incidentId: string; userId: string; imageUrl: string; description: string }): Promise<Evidence> {
    return this.repository.create({ ...input, submittedAt: new Date(), status: "pending", verification: baselineVerification });
  }

  async history(incidentId: string, userId: string): Promise<Evidence[]> {
    return this.repository.listByIncident(incidentId, userId);
  }
}
