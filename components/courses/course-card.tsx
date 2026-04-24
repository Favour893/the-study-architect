"use client";

import { useState } from "react";
import type { Course, Topic } from "@/lib/types/domain";

type CourseCardProps = {
  course: Course;
  topics: Topic[];
  onAddTopic: (courseId: string, title: string) => Promise<void>;
  onToggleTaught: (courseId: string, topicId: string, taughtInClass: boolean) => Promise<void>;
};

export function CourseCard({ course, topics, onAddTopic, onToggleTaught }: CourseCardProps) {
  const [topicTitle, setTopicTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topicTitle.trim()) {
      return;
    }

    setIsSubmitting(true);
    await onAddTopic(course.id, topicTitle);
    setTopicTitle("");
    setIsSubmitting(false);
  }

  return (
    <article className="space-y-4 rounded-2xl border border-app-border bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-app-fg">{course.title}</h3>
          {course.code ? <p className="text-sm text-app-subtle">{course.code}</p> : null}
          <div className="mt-1 space-y-0.5">
            {course.lecturerName ? (
              <p className="text-xs text-app-subtle">Lecturer: {course.lecturerName}</p>
            ) : null}
            {course.location ? (
              <p className="text-xs text-app-subtle">Location: {course.location}</p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-app-muted px-2.5 py-1 text-xs text-app-subtle">
          {course.topicCount} topics
        </span>
      </div>
      <p className="mt-4 text-sm text-app-subtle">
        Latest status: <span className="font-medium text-app-fg">{course.latestTopicStatus}</span>
      </p>

      <form onSubmit={handleAddTopic} className="flex gap-2">
        <input
          value={topicTitle}
          onChange={(event) => setTopicTitle(event.target.value)}
          className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none ring-app-accent focus:ring-2"
          placeholder="Add topic"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg border border-app-border bg-white px-3 py-2 text-sm font-medium text-app-fg hover:bg-app-muted disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {topics.length === 0 ? (
        <p className="text-sm text-app-subtle">No topics yet.</p>
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm text-app-fg">{topic.title}</p>
                <p className="text-xs text-app-subtle">
                  {topic.taughtInClass ? "Live Sync priority: top" : "Live Sync priority: normal"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onToggleTaught(course.id, topic.id, !topic.taughtInClass)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  topic.taughtInClass
                    ? "bg-app-fg text-white"
                    : "border border-app-border bg-white text-app-fg"
                }`}
              >
                {topic.taughtInClass ? "Taught in class" : "Mark taught"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
