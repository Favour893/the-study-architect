import { describe, expect, it } from "vitest";
import {
  parsePersonalTimetableStorage,
  personalTimetableStorageKey,
  serializePersonalTimetableStorage,
} from "../../lib/personal-timetable-storage";

describe("personal-timetable-storage", () => {
  it("builds a scoped storage key per user", () => {
    expect(personalTimetableStorageKey("uid-1")).toBe("tsa.personal-timetable.v1:uid-1");
  });

  it("round-trips entries", () => {
    const raw = serializePersonalTimetableStorage({
      "Monday-09:00": {
        courseId: "",
        courseName: "Gym",
        lecturerName: "",
        location: "Campus",
        durationHours: 2,
      },
    });
    const parsed = parsePersonalTimetableStorage(raw);
    expect(parsed?.entries["Monday-09:00"]?.courseName).toBe("Gym");
    expect(parsed?.entries["Monday-09:00"]?.durationHours).toBe(2);
  });
});
