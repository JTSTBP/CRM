# Manager command dashboard

Only `/manager/dashboard` uses the new manager design. Admin, BD executive, navigation and attendance pages are unchanged.

## Scope and reporting

- Active BD executives reporting to the signed-in manager; inactive staff and other teams are excluded.
- Company territory and executive filters apply to the selected portfolio. Territory values come from company profiles.
- Reporting periods use Asia/Kolkata dates: today, Monday-to-today, month-to-today or an inclusive custom range up to 93 days ending today or earlier.
- Outreach charts, calls, communication confirmations and proposals use the selected period. Live contact queues, open/overdue tasks and daily compliance use today. Onboardings use the current calendar month.
- Targets use each executive's effective-dated settings and the working-day calendar. Targets are not apportioned by company territory.
- Call-based company counts and funnel stages count unique companies. Funnel conversion follows the same worked-company cohort within the selected period.
- Team accountability averages applicable executive scores. Per-executive weights: communication 25%, on-time follow-ups 25%, overdue resolution 15%, current lifecycle review 15%, on-time daily reporting 20%. N/A dimensions are excluded and weights normalized; today's score remains provisional until the reporting cutoff.
- Escalations retain the existing five-calendar-day rule. Stalled accounts require an actual recorded Contacted transition older than 48 hours.

## Manager actions

`GET /api/bd-workspace/manager/dashboard` supplies the dashboard. `POST /api/bd-workspace/manager/action` accepts task, research, reassign, remind, compliance, corep and lifecycle actions. Both require an active Manager or Admin session. Only the Manager UI is changed.

Writes require a unique request identifier and a reason. They run transactionally with an audit event; retries return the original result. Reassignment checks every contact before saving, updates monitoring-task ownership and adds the active recipient to company assignments. Research and ordinary tasks require the selected executive to be assigned to the company. Supporting-executive assignment is a separate explicit action. Lifecycle review creates a follow-up task plus the existing lifecycle-review record.

Reminders create CRM in-app notifications. They do not send email or external push messages. LinkedIn panels use CRM-recorded statuses and do not claim an external integration. The dashboard does not infer live presence or financial revenue from missing data.

Exports are CSV with spreadsheet-formula escaping. Browser polling runs every minute while visible and no dialog is open.

## Validation

`Backend/tests/managerWorkspace.integration.test.js` uses a disposable random database when `MONITORING_TEST_URI` is set. It checks manager isolation, active users, period/territory/executive filtering, invalid dates, restricted writes, future task dates, idempotency, reassignment rollback, lifecycle scoring, notifications and audit visibility. It never drops the configured production database.

Frontend validation: `npm run build` in Frontend. Browser verification uses isolated preview records, including task assignment, callback selection/reminders, filtering, CSV export and desktop/mobile layout.
