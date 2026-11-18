export const isPhoneBrowser = () =>
  /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent);
const key = (leadId: string, pocId: string) => `mobile-dial:${leadId}:${pocId}`;
export function startMobileDial(leadId: string, pocId: string) {
  if (!isPhoneBrowser()) return false;
  sessionStorage.setItem(key(leadId, pocId), String(Date.now()));
  return true;
}
export function hasMobileDial(leadId: string, pocId: string) {
  const at = Number(sessionStorage.getItem(key(leadId, pocId)));
  return (
    isPhoneBrowser() &&
    at > 0 &&
    Date.now() - at >= 0 &&
    Date.now() - at < 2 * 60 * 60 * 1000
  );
}
export function clearMobileDial(leadId: string, pocId: string) {
  sessionStorage.removeItem(key(leadId, pocId));
}
