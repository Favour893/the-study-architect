import { describe, expect, it } from "vitest";
import { rankMissionTopics, resolveTopicStage, type MissionTopicCandidate } from "../../lib/pulse/study-mission";
import type { Topic } from "../../lib/types/domain";

function makeTopic(input: Partial<Topic>): Topic {
  return {
    id: "t1",
    title: "Topic",
    taughtInClass: false,
    priorityScore: 0,
    ...input,
  };
}

describe("resolveTopicStage", () => {
  it("returns mastered when learningStage is mastered", () => {
    expect(resolveTopicStage(makeTopic({ learningStage: "mastered", taughtInClass: true }))).toBe("mastered");
  });

  it("returns taught when learningStage is taught", () => {
    expect(resolveTopicStage(makeTopic({ learningStage: "taught", taughtInClass: false }))).toBe("taught");
  });

  it("falls back to taught when taughtInClass is true", () => {
    expect(resolveTopicStage(makeTopic({ taughtInClass: true }))).toBe("taught");
  });

  it("defaults to pending otherwise", () => {
    expect(resolveTopicStage(makeTopic({ taughtInClass: false }))).toBe("pending");
  });
});

describe("rankMissionTopics", () => {
  it("prioritizes next-class topics before others", () => {
    const topics: MissionTopicCandidate[] = [
      { courseName: "A", topicTitle: "one", notes: "", isFromNextClass: false },
      { courseName: "B", topicTitle: "two", notes: "", isFromNextClass: true },
      { courseName: "C", topicTitle: "three", notes: "", isFromNextClass: false },
    ];

    const ranked = rankMissionTopics(topics, 3);
    expect(ranked[0]?.topicTitle).toBe("two");
  });

  it("uses notes as tiebreaker when next-class flag is equal", () => {
    const topics: MissionTopicCandidate[] = [
      { courseName: "A", topicTitle: "one", notes: "", isFromNextClass: false },
      { courseName: "B", topicTitle: "two", notes: "revise examples", isFromNextClass: false },
    ];

    const ranked = rankMissionTopics(topics, 2);
    expect(ranked[0]?.topicTitle).toBe("two");
  });

  it("returns only the requested limit", () => {
    const topics: MissionTopicCandidate[] = [
      { courseName: "A", topicTitle: "one", notes: "", isFromNextClass: false },
      { courseName: "B", topicTitle: "two", notes: "", isFromNextClass: false },
      { courseName: "C", topicTitle: "three", notes: "", isFromNextClass: false },
      { courseName: "D", topicTitle: "four", notes: "", isFromNextClass: false },
    ];

    const ranked = rankMissionTopics(topics, 3);
    expect(ranked).toHaveLength(3);
  });
});
