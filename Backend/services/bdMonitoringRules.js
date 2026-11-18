const DAY = 86400000;
const OUTCOMES = [
  "Connected",
  "Busy",
  "No Answer",
  "Wrong Number",
  "Not Interested",
  "Callback Requested",
];
const CHANNELS = ["Sent", "Pending", "Failed", "Not Applicable"];
const CONNECTIONS = [
  "Not Sent",
  "Sent",
  "Pending",
  "Accepted",
  "Rejected",
  "Unknown",
];
const RECOVERY = [
  "alternativeFound",
  "alternativeVerified",
  "emailAvailable",
  "emailSent",
  "linkedinAvailable",
  "linkedinSent",
  "linkedinAccepted",
  "decisionMaker",
];
const RECOVERY_STATUSES = [
  "Completed",
  "Pending",
  "Not Available",
  "Not Applicable",
];

function dayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function dayStart(day) {
  return new Date(`${day}T00:00:00+05:30`);
}
function validDay(day) {
  return (
    typeof day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(+dayStart(day)) &&
    dayKey(dayStart(day)) === day
  );
}
function cutoffAt(day, settings) {
  return new Date(`${day}T${settings.cutoff}:00+05:30`);
}
function workingDay(day, settings) {
  return (
    settings.workingDays.includes(
      new Date(`${day}T12:00:00+05:30`).getUTCDay(),
    ) && !settings.holidays.includes(day)
  );
}
function nextBusinessDay(now, settings) {
  let date = dayKey(new Date(now.getTime() + DAY));
  for (let i = 0; i < 370; i++) {
    if (workingDay(date, settings)) return new Date(`${date}T10:00:00+05:30`);
    date = dayKey(new Date(dayStart(date).getTime() + DAY));
  }
  throw new Error("No working day is available in the configured calendar.");
}
function missing(state) {
  const items = [];
  if (state.needsDailyUpdate) items.push("Communication review");
  if (!OUTCOMES.includes(state.callOutcome) && !state.callNotApplicable)
    items.push("Call outcome");
  if (!state.whatsapp || state.whatsapp === "Pending")
    items.push("WhatsApp update");
  if (!state.email || state.email === "Pending") items.push("Email update");
  if (!state.linkedin || state.linkedin === "Unknown")
    items.push("LinkedIn update");
  if (
    (!state.nextAction || !state.dueAt) &&
    !(state.resolvedAt && state.resolution)
  )
    items.push("Next follow-up");
  return items;
}
function recoveryPending(state) {
  const recovery =
    state.recovery instanceof Map
      ? Object.fromEntries(state.recovery)
      : state.recovery || {};
  return (
    Boolean(state.wrongNumberAt || state.callOutcome === "Wrong Number") &&
    !state.reachedAt &&
    RECOVERY.some((key) => !recovery[key] || recovery[key] === "Pending")
  );
}
function alerts(state, now, settings) {
  if (state.resolvedAt) return [];
  const result = [];
  if (state.dueAt && new Date(state.dueAt) < now)
    result.push("Overdue follow-up");
  if (state.callOutcome === "Busy") result.push("Busy callback");
  if (state.callOutcome === "No Answer") result.push("No Answer retry");
  if (recoveryPending(state)) result.push("Wrong Number recovery");
  if (
    ["Sent", "Pending"].includes(state.linkedin) &&
    state.linkedinReviewAt &&
    new Date(state.linkedinReviewAt) <= now
  )
    result.push("LinkedIn review");
  if (
    state.firstUnsuccessfulAt &&
    !state.reachedAt &&
    now - new Date(state.firstUnsuccessfulAt) >= 5 * DAY
  )
    result.push("Five-day escalation");
  if (
    recoveryPending(state) &&
    state.wrongNumberAt &&
    now - new Date(state.wrongNumberAt) >= settings.recoveryDays * DAY
  )
    result.push("Recovery escalation");
  return result;
}
module.exports = {
  DAY,
  OUTCOMES,
  CHANNELS,
  CONNECTIONS,
  RECOVERY,
  RECOVERY_STATUSES,
  dayKey,
  dayStart,
  validDay,
  cutoffAt,
  workingDay,
  nextBusinessDay,
  missing,
  recoveryPending,
  alerts,
};
