import fs from "node:fs";
import path from "node:path";
import type { DepthLevel, LensId } from "@/lib/interview/types";
import { SEED_ARCHETYPES } from "./seed-archetypes";
import type {
  LearningStore,
  PromotionCriteria,
  QuestionArchetype,
  SessionTelemetry,
  TurnTelemetry
} from "./types";

const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minSampleSize: 5,
  minEfficacyScore: 0.7,
  maxVariance: 0.08
};

const DEFAULT_FILE_PATH = path.join(process.cwd(), "data", "learning-archetypes.json");

export class JsonLearningStore implements LearningStore {
  private cache: Map<string, QuestionArchetype> = new Map();
  private filePath: string;
  private isLoaded = false;

  constructor(filePath: string = DEFAULT_FILE_PATH) {
    this.filePath = filePath;
  }

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    this.isLoaded = true;

    // Load seeds first
    for (const seed of SEED_ARCHETYPES) {
      this.cache.set(seed.id, { ...seed });
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(raw) as { archetypes?: QuestionArchetype[] };
        if (Array.isArray(data.archetypes)) {
          for (const item of data.archetypes) {
            if (item && typeof item.id === "string") {
              this.cache.set(item.id, item);
            }
          }
        }
      }
    } catch {
      // Fallback gracefully to in-memory seeds on read error
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        version: 1,
        updatedAt: Date.now(),
        archetypes: Array.from(this.cache.values())
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // In-memory cache continues to serve even if persistence fails (e.g. read-only env)
    }
  }

  async getArchetypes(dimension?: LensId, depth?: DepthLevel): Promise<QuestionArchetype[]> {
    this.ensureLoaded();
    const all = Array.from(this.cache.values());

    return all.filter((a) => {
      if (dimension && a.dimension !== dimension) return false;
      if (depth && !a.depths.includes(depth)) return false;
      return true;
    });
  }

  async getArchetype(id: string): Promise<QuestionArchetype | undefined> {
    this.ensureLoaded();
    return this.cache.get(id);
  }

  async recordSessionTelemetry(telemetry: SessionTelemetry): Promise<void> {
    this.ensureLoaded();

    for (const turn of telemetry.turns) {
      if (!turn.archetypeId) continue;
      const arch = this.cache.get(turn.archetypeId);
      if (!arch) continue;

      this.updateArchetypeStatistics(arch, turn);
    }

    this.persist();
  }

  private updateArchetypeStatistics(arch: QuestionArchetype, turn: TurnTelemetry): void {
    const prevN = arch.sampleCount;
    const newN = prevN + 1;
    const prevAvg = arch.avgEfficacyScore;
    const score = turn.efficacyScore;

    // Welford's algorithm for online mean and variance update
    const newAvg = prevAvg + (score - prevAvg) / newN;
    const delta1 = score - prevAvg;
    const delta2 = score - newAvg;
    const newVariance = newN > 1 ? (arch.variance * (prevN - 1) + delta1 * delta2) / (newN - 1) : 0;

    arch.sampleCount = newN;
    arch.avgEfficacyScore = Number(newAvg.toFixed(4));
    arch.variance = Number(newVariance.toFixed(4));
    if (turn.assumptionInvalidated) arch.invalidationsCount += 1;
    if (turn.discrepancyType !== "none") arch.discrepanciesCount += 1;
    arch.lastUpdated = Date.now();

    // Check automatic promotion or deprioritization
    this.evaluateLifecycleTransition(arch);
  }

  private evaluateLifecycleTransition(arch: QuestionArchetype, criteria: PromotionCriteria = DEFAULT_PROMOTION_CRITERIA): void {
    // Deprioritization: if sample size >= 8 and sustained low score
    if (arch.sampleCount >= 8 && arch.avgEfficacyScore < 0.55 && arch.lifecycle !== "DEPRIORITIZED") {
      arch.lifecycle = "DEPRIORITIZED";
      return;
    }

    // Promotion gate: SEEDED / EXPERIMENTAL -> ESTABLISHED
    if (arch.lifecycle === "SEEDED" || arch.lifecycle === "EXPERIMENTAL") {
      if (
        arch.sampleCount >= criteria.minSampleSize &&
        arch.avgEfficacyScore >= criteria.minEfficacyScore &&
        arch.variance <= criteria.maxVariance
      ) {
        arch.lifecycle = "ESTABLISHED";
      }
    }
  }

  async evaluatePromotion(archetypeId: string, criteria?: Partial<PromotionCriteria>): Promise<boolean> {
    this.ensureLoaded();
    const arch = this.cache.get(archetypeId);
    if (!arch) return false;

    const fullCriteria: PromotionCriteria = {
      ...DEFAULT_PROMOTION_CRITERIA,
      ...criteria
    };

    if (
      arch.sampleCount >= fullCriteria.minSampleSize &&
      arch.avgEfficacyScore >= fullCriteria.minEfficacyScore &&
      arch.variance <= fullCriteria.maxVariance
    ) {
      arch.lifecycle = "ESTABLISHED";
      this.persist();
      return true;
    }
    return false;
  }

  async updateArchetype(archetype: QuestionArchetype): Promise<void> {
    this.ensureLoaded();
    this.cache.set(archetype.id, { ...archetype, lastUpdated: Date.now() });
    this.persist();
  }

  async resetToSeeds(): Promise<void> {
    this.isLoaded = true;
    this.cache.clear();
    for (const seed of SEED_ARCHETYPES) {
      this.cache.set(seed.id, { ...seed });
    }
    this.persist();
  }
}

let storeInstance: LearningStore | null = null;

export function getLearningStore(customFilePath?: string): LearningStore {
  if (!storeInstance || customFilePath) {
    const store = new JsonLearningStore(customFilePath);
    if (!customFilePath) storeInstance = store;
    return store;
  }
  return storeInstance;
}
