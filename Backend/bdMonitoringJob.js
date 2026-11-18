const { runMonitoring } = require("./services/bdMonitoringService");
function startBDMonitoringJob() {
  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      await runMonitoring();
    } catch (error) {
      console.error("[BD monitoring]", error.message);
    } finally {
      running = false;
    }
  }
  void run();
  const timer = setInterval(run, 60000);
  timer.unref();
  return timer;
}
module.exports = { startBDMonitoringJob };
