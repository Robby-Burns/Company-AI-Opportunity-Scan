import { describe, expect, it } from "vitest";
import { evaluateTurn } from "./evaluator";
import { SEED_ARCHETYPES } from "./seed-archetypes";
import { JsonLearningStore } from "./store";
import type { SessionTelemetry, TurnTelemetry } from "./types";

describe("Adaptive Question Learning Engine (§HD Discovery & Epistemic Progress)", () => {
  describe("1. State Transition & Weighted Uncertainty Scoring", () => {
    it("rewards weighted uncertainty reduction and concrete evidence over shallow answers", () => {
      // Turn A: Resolves unknowns and gains coverage
      const highValueTurn = evaluateTurn({
        questionNumber: 1,
        dimension: "operations",
        depth: 2,
        archetypeId: "arch_workflow_trace",
        coverageBefore: "LIGHT",
        coverageAfter: "ADEQUATE",
        unknownsBefore: ["sequence", "actors", "handoffs"],
        unknownsAfter: ["handoffs"], // 2 unknowns resolved
        factsBefore: [],
        factsAfter: ["estimates_created_by_rep", "sent_via_email", "approved_by_manager"],
        answerSnippet: "Rep creates estimate in CRM, emails customer, manager approves if over $5k.",
        evidenceGeneratedCount: 3
      });

      // Turn B: Shallow answer, no coverage gain, no unknowns resolved
      const shallowTurn = evaluateTurn({
        questionNumber: 2,
        dimension: "operations",
        depth: 2,
        archetypeId: "arch_workflow_trace",
        coverageBefore: "LIGHT",
        coverageAfter: "LIGHT",
        unknownsBefore: ["handoffs"],
        unknownsAfter: ["handoffs"],
        factsBefore: ["estimates_created_by_rep"],
        factsAfter: ["estimates_created_by_rep"],
        answerSnippet: "Yes, we do that.",
        evidenceGeneratedCount: 0
      });

      expect(highValueTurn.efficacyScore).toBeGreaterThan(shallowTurn.efficacyScore);
      expect(highValueTurn.outcome).toBe("HIGH_VALUE");
      expect(shallowTurn.outcome).toBe("REDUNDANT");
    });

    it("rewards assumption invalidation as a high-information outcome", () => {
      const invalidationTurn = evaluateTurn({
        questionNumber: 3,
        dimension: "systems",
        depth: 2,
        archetypeId: "arch_signal_verification",
        coverageBefore: "LIGHT",
        coverageAfter: "ADEQUATE",
        unknownsBefore: ["tool_usage"],
        unknownsAfter: [],
        factsBefore: [],
        factsAfter: ["we_abandoned_servicetitan_last_year"],
        answerSnippet: "No, we actually stopped using ServiceTitan last year and moved to custom sheets.",
        evidenceGeneratedCount: 1,
        assumptionInvalidated: true
      });

      expect(invalidationTurn.outcome).toBe("INVALIDATED_ASSUMPTION");
      expect(invalidationTurn.efficacyScore).toBeGreaterThanOrEqual(0.8);
      expect(invalidationTurn.assumptionInvalidated).toBe(true);
    });

    it("identifies and categorizes discrepancies without false certainty", () => {
      const discrepancyTurn = evaluateTurn({
        questionNumber: 4,
        dimension: "business",
        depth: 2,
        archetypeId: "arch_signal_verification",
        coverageBefore: "LIGHT",
        coverageAfter: "ADEQUATE",
        unknownsBefore: ["turnaround_time"],
        unknownsAfter: [],
        factsBefore: [],
        factsAfter: ["schedule_three_days_out_despite_website_same_day"],
        answerSnippet: "Our website mentions same-day turnaround, but in practice our crew is booked 3 days out.",
        evidenceGeneratedCount: 1,
        discrepancyType: "signal_vs_reality"
      });

      expect(discrepancyTurn.outcome).toBe("SURFACED_DISCREPANCY");
      expect(discrepancyTurn.discrepancyType).toBe("signal_vs_reality");
      expect(discrepancyTurn.efficacyScore).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe("2. Negative Learning Penalties & Anti-Patterns", () => {
    it("penalizes leading questions and premature confirmation seeking", () => {
      const leadingTurn = evaluateTurn({
        questionNumber: 5,
        dimension: "operations",
        depth: 3,
        archetypeId: "arch_exception_probe",
        coverageBefore: "ADEQUATE",
        coverageAfter: "ADEQUATE",
        unknownsBefore: [],
        unknownsAfter: [],
        factsBefore: ["uses_quickbooks"],
        factsAfter: ["uses_quickbooks"],
        answerSnippet: "Yes, reconciliation is slow.",
        evidenceGeneratedCount: 0,
        isLeading: true
      });

      expect(leadingTurn.outcome).toBe("LEADING");
      expect(leadingTurn.efficacyScore).toBeLessThan(0.4);
    });

    it("penalizes redundant turns that re-probe established information", () => {
      const redundantTurn = evaluateTurn({
        questionNumber: 6,
        dimension: "systems",
        depth: 1,
        coverageBefore: "ADEQUATE",
        coverageAfter: "ADEQUATE",
        unknownsBefore: [],
        unknownsAfter: [],
        factsBefore: ["uses_slack"],
        factsAfter: ["uses_slack"],
        answerSnippet: "We use Slack.",
        evidenceGeneratedCount: 0,
        isRedundant: true
      });

      expect(redundantTurn.outcome).toBe("REDUNDANT");
      expect(redundantTurn.isRedundant).toBe(true);
      expect(redundantTurn.efficacyScore).toBeLessThan(0.35);
    });
  });

  describe("3. Archetype Retrieval & Methodology Alignment", () => {
    it("provides methodology-derived strategy guidance for all 5 dimensions", () => {
      const dims = ["business", "operations", "systems", "data", "people"] as const;

      for (const dim of dims) {
        const found = SEED_ARCHETYPES.filter((a) => a.dimension === dim);
        expect(found.length).toBeGreaterThan(0);
        for (const arch of found) {
          expect(arch.purpose).toBeTruthy();
          expect(arch.strategyGuidance).toBeTruthy();
          expect(arch.desiredEvidenceCategories.length).toBeGreaterThan(0);
          expect(arch.avoidWhen).toBeTruthy();
        }
      }
    });

    it("ensures arch_signal_verification uses neutral, non-leading strategy", () => {
      const signalArch = SEED_ARCHETYPES.find((a) => a.id === "arch_signal_verification");
      expect(signalArch).toBeDefined();
      expect(signalArch?.strategyGuidance).toContain("NEVER assume the signal is active or critical");
      expect(signalArch?.strategyGuidance).toContain("What role, if any");
    });
  });

  describe("4. 3-Tier Governance Gate & Promotion Mechanics", () => {
    it("does not promote an archetype to ESTABLISHED before reaching minSampleSize", async () => {
      const store = new JsonLearningStore();
      await store.resetToSeeds();
      const arch = (await store.getArchetypes("operations"))[0]!;

      // 2 high-scoring turns (sampleSize = 2 < 5)
      const telemetry: SessionTelemetry = {
        scanId: "test_scan_1",
        completedAt: Date.now(),
        turns: [
          {
            questionNumber: 1,
            dimension: "operations",
            depth: 2,
            archetypeId: arch.id,
            coverageBefore: "LIGHT",
            coverageAfter: "ADEQUATE",
            uncertaintyCountBefore: 2,
            uncertaintyCountAfter: 0,
            weightedDeltaUncertainty: 0.5,
            evidenceSpecificCount: 3,
            assumptionInvalidated: false,
            discrepancyType: "none",
            isRedundant: false,
            isLeading: false,
            outcome: "HIGH_VALUE",
            efficacyScore: 0.85
          },
          {
            questionNumber: 2,
            dimension: "operations",
            depth: 2,
            archetypeId: arch.id,
            coverageBefore: "LIGHT",
            coverageAfter: "ADEQUATE",
            uncertaintyCountBefore: 2,
            uncertaintyCountAfter: 0,
            weightedDeltaUncertainty: 0.5,
            evidenceSpecificCount: 3,
            assumptionInvalidated: false,
            discrepancyType: "none",
            isRedundant: false,
            isLeading: false,
            outcome: "HIGH_VALUE",
            efficacyScore: 0.88
          }
        ]
      };

      await store.recordSessionTelemetry(telemetry);
      const updated = await store.getArchetype(arch.id);
      expect(updated?.sampleCount).toBe(2);
      expect(updated?.lifecycle).toBe("SEEDED"); // Not yet promoted
    });

    it("promotes to ESTABLISHED once sampleSize >= 5 with consistent high scores", async () => {
      const store = new JsonLearningStore();
      await store.resetToSeeds();
      const arch = (await store.getArchetypes("operations"))[0]!;

      const turns: TurnTelemetry[] = Array.from({ length: 5 }, (_, i) => ({
        questionNumber: i + 1,
        dimension: "operations",
        depth: 2,
        archetypeId: arch.id,
        coverageBefore: "LIGHT",
        coverageAfter: "ADEQUATE",
        uncertaintyCountBefore: 2,
        uncertaintyCountAfter: 0,
        weightedDeltaUncertainty: 0.5,
        evidenceSpecificCount: 3,
        assumptionInvalidated: false,
        discrepancyType: "none",
        isRedundant: false,
        isLeading: false,
        outcome: "HIGH_VALUE",
        efficacyScore: 0.82
      }));

      await store.recordSessionTelemetry({
        scanId: "multi_test_scan",
        completedAt: Date.now(),
        turns
      });

      const updated = await store.getArchetype(arch.id);
      expect(updated?.sampleCount).toBe(5);
      expect(updated?.avgEfficacyScore).toBeGreaterThanOrEqual(0.75);
      expect(updated?.lifecycle).toBe("ESTABLISHED");
    });

    it("deprioritizes but preserves archetypes with sustained poor performance (never deletes)", async () => {
      const store = new JsonLearningStore();
      await store.resetToSeeds();
      const arch = (await store.getArchetypes("data"))[0]!;

      const badTurns: TurnTelemetry[] = Array.from({ length: 8 }, (_, i) => ({
        questionNumber: i + 1,
        dimension: "data",
        depth: 2,
        archetypeId: arch.id,
        coverageBefore: "ADEQUATE",
        coverageAfter: "ADEQUATE",
        uncertaintyCountBefore: 0,
        uncertaintyCountAfter: 0,
        weightedDeltaUncertainty: 0,
        evidenceSpecificCount: 0,
        assumptionInvalidated: false,
        discrepancyType: "none",
        isRedundant: true,
        isLeading: false,
        outcome: "REDUNDANT",
        efficacyScore: 0.25
      }));

      await store.recordSessionTelemetry({
        scanId: "bad_test_scan",
        completedAt: Date.now(),
        turns: badTurns
      });

      const updated = await store.getArchetype(arch.id);
      expect(updated?.sampleCount).toBe(8);
      expect(updated?.avgEfficacyScore).toBeLessThan(0.55);
      expect(updated?.lifecycle).toBe("DEPRIORITIZED");
      // Still exists in store for niche re-evaluation
      expect(await store.getArchetype(arch.id)).toBeDefined();
    });
  });

  describe("5. Zero PII & Cross-Client Isolation Boundary", () => {
    it("guarantees zero client-specific entity names, URLs, emails, or free text in telemetry", () => {
      const turn = evaluateTurn({
        questionNumber: 1,
        dimension: "operations",
        depth: 2,
        archetypeId: "arch_workflow_trace",
        coverageBefore: "LIGHT",
        coverageAfter: "ADEQUATE",
        unknownsBefore: ["sequence"],
        unknownsAfter: [],
        factsBefore: [],
        factsAfter: ["workflow_mapped"],
        answerSnippet: "John Smith at Acme Corp (john@acme.com) uses https://acme-internal.com to ship signs in Kennewick.",
        evidenceGeneratedCount: 2
      });

      const serialized = JSON.stringify(turn);

      // Verify zero PII leakage
      expect(serialized).not.toContain("John Smith");
      expect(serialized).not.toContain("Acme Corp");
      expect(serialized).not.toContain("john@acme.com");
      expect(serialized).not.toContain("https://acme-internal.com");
      expect(serialized).not.toContain("Kennewick");
    });
  });
});
