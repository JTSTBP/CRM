const express = require("express"),
  service = require("../services/bdMonitoringService"),
  executive = require("../services/adminWorkspaceService");
const router = express.Router();
const handle = (fn) => async (req, res) => {
  try {
    const access = await service.scope(req.user);
    executive.requireAdmin(access);
    res.json(await fn(req, access));
  } catch (error) {
    const status =
      error.status ||
      (["ValidationError", "CastError"].includes(error.name)
        ? 400
        : error.code === 11000
          ? 409
          : 500);
    if (status === 500) console.error("Executive dashboard:", error);
    res
      .status(status)
      .json({
        message:
          status === 500
            ? "Could not load the executive workspace."
            : error.message,
      });
  }
};
router.get(
  "/admin/dashboard",
  handle((req, access) => executive.dashboard(access, req.query)),
);
router.post(
  "/admin/directive",
  handle((req, access) => executive.directive(access, req.body)),
);
module.exports = router;
