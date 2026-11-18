function isPhone(userAgent = "") {
  return /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent);
}
function assertMobileCall(userAgent, body = {}) {
  if (
    body.callOutcome &&
    (!body.activityType || body.activityType === "call") &&
    (!isPhone(userAgent) || body.mobileDialStarted !== true)
  )
    throw Object.assign(
      new Error(
        "To log a call, use the mobile website and tap the contact phone number first.",
      ),
      { status: 403 },
    );
}
module.exports = { isPhone, assertMobileCall };
