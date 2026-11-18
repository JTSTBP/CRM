const channels = ["whatsapp", "email", "linkedin", "linkedinFollowup"];
function activityPatch(input, state = {}) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (!["call", ...channels].includes(input.activityType))
    fail("Choose a valid activity type.");
  if (input.activityType === "call" && !input.callOutcome)
    fail("Choose a call outcome.");
  const stored =
    typeof state.toObject === "function"
      ? state.toObject({ flattenMaps: true })
      : state;
  const body = {
    ...stored,
    ...input,
    recovery: stored.recovery || {},
    callOutcome: input.activityType === "call" ? input.callOutcome : "",
    callNotApplicable: stored.callNotApplicable || false,
    meaningfulContactConfirmed: false,
  };
  for (const channel of channels) {
    if (channel !== input.activityType)
      body[channel] =
        stored[channel] || (channel === "linkedin" ? "Unknown" : "Pending");
    body[channel + "Confirmed"] =
      channel === input.activityType && input[channel + "Confirmed"] === true;
  }
  for (const field of [
    "emailSubject",
    "linkedinUrl",
    "alternativePhone",
    "alternativeContact",
    "recoveryReason",
    "strategy",
  ])
    if (!(
      (field === "emailSubject" && input.activityType === "email") ||
      (field === "linkedinUrl" &&
        ["linkedin", "linkedinFollowup"].includes(input.activityType)) ||
      (field.startsWith("alternative") && input.activityType === "call")
    ))
      body[field] = stored[field] || "";
  return body;
}
module.exports = { activityPatch };
