import { describe, it, expect } from "vitest";
import {
  calculateMatchScore,
  normalizeCompanyName,
  isAggregatorDomain
} from "./search";

describe("Search Candidate Scoring & Heuristics", () => {
  it("normalizes legal entity suffixes and punctuation", () => {
    expect(normalizeCompanyName("Acme Plumbing, Inc.")).toBe("acme plumbing");
    expect(normalizeCompanyName("Apex Logistics LLC")).toBe("apex logistics");
    expect(normalizeCompanyName("Summit Healthcare Solutions Corp.")).toBe("summit healthcare");
    expect(normalizeCompanyName("Global Consulting Group Ltd.")).toBe("global");
  });

  it("identifies aggregator directory domains", () => {
    expect(isAggregatorDomain("yelp.com")).toBe(true);
    expect(isAggregatorDomain("www.yelp.com")).toBe(true);
    expect(isAggregatorDomain("facebook.com")).toBe(true);
    expect(isAggregatorDomain("bbb.org")).toBe(true);
    expect(isAggregatorDomain("yellowpages.com")).toBe(true);
    expect(isAggregatorDomain("acmeplumbing.com")).toBe(false);
    expect(isAggregatorDomain("apex-logistics.io")).toBe(false);
  });

  it("calculates high confidence match score for exact name + geo + domain match", () => {
    const candidate = {
      title: "Acme Plumbing Services | Austin, TX Residential & Commercial",
      url: "https://www.acmeplumbingaustin.com",
      snippet: "Reliable plumbing and drain cleaning services located in Austin, Texas. Call today."
    };
    const context = {
      company: "Acme Plumbing, LLC",
      location: "Austin, TX",
      notes: "We are a residential plumbing company in Austin"
    };

    const score = calculateMatchScore(candidate, context);
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  it("penalizes geo mismatch when candidate is in a different state/city", () => {
    const candidate = {
      title: "Acme Plumbing | Chicago, IL Master Plumbers",
      url: "https://www.acmeplumbingchicago.com",
      snippet: "Top-rated plumbing repairs in downtown Chicago, Illinois."
    };
    const context = {
      company: "Acme Plumbing",
      location: "Austin, TX"
    };

    const score = calculateMatchScore(candidate, context);
    expect(score).toBeLessThan(0.70);
  });

  it("penalizes aggregator directories compared to direct domains", () => {
    const directCandidate = {
      title: "Apex Logistics Austin Depot",
      url: "https://www.apexlogistics.com",
      snippet: "Full freight logistics and warehousing services in Austin, TX."
    };
    const yelpCandidate = {
      title: "Apex Logistics - Austin, TX - Yelp",
      url: "https://www.yelp.com/biz/apex-logistics-austin",
      snippet: "Reviews and business details for Apex Logistics in Austin."
    };
    const context = {
      company: "Apex Logistics",
      location: "Austin, TX"
    };

    const directScore = calculateMatchScore(directCandidate, context);
    const yelpScore = calculateMatchScore(yelpCandidate, context);

    expect(directScore).toBeGreaterThan(yelpScore);
  });
});
