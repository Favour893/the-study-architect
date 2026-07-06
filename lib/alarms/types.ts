export type ScheduledAlarm = {
  id: string;
  fireAt: string;
  title: string;
  body: string;
  href?: string;
};

export const ALARM_MAX_FUTURE_MS = 30 * 24 * 60 * 60 * 1000;
export const ALARM_CHECK_INTERVAL_MS = 30_000;
