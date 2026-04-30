import type { Topic } from "@/lib/types/domain";

export type TopicStage = "pending" | "taught" | "mastered";

export type MissionTopicCandidate = {
  courseName: string;
  topicTitle: string;
  notes: string;
  isFromNextClass: boolean;
};

export function resolveTopicStage(topic: Topic): TopicStage {
  if (topic.learningStage === "mastered") {
    return "mastered";
  }
  if (topic.learningStage === "taught") {
    return "taught";
  }
  if (topic.taughtInClass) {
    return "taught";
  }
  return "pending";
}

export function rankMissionTopics(topics: MissionTopicCandidate[], limit = 3): MissionTopicCandidate[] {
  if (limit <= 0) {
    return [];
  }
  return topics
    .map((topic, index) => ({
      topic,
      score: (topic.isFromNextClass ? 1000 : 0) + (topic.notes ? 25 : 0) - index,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.topic);
}
