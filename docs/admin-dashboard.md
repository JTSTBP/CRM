# Admin Executive Command Center

`/admin/dashboard` uses the Executive Command Center design. Admin navigation, Manager/BD dashboards and attendance pages remain unchanged.

## Data and scope

- `GET /api/bd-workspace/admin/dashboard` requires a currently active Admin account. Managers and BD executives are rejected.
- Reporting periods use IST dates and the existing monitoring calendar: today, week-to-date, month-to-date or up to 93 inclusive custom days ending today or earlier.
- Manager, executive and company territory filters combine. Manager filters include the active direct reporting team and the manager's company scope. The unfiltered Admin portfolio also includes approved companies without an active BD assignment.
- Outreach/proposals use the reporting period and active BD accounts. Pipeline, risk queues, assignment counts, stage dwell, recovery and compliance are current portfolio snapshots. Client activations use the current month. Roster and filter-option headcounts describe current active staff.
- Manager matrix company counts are unique within each manager's team; shared companies may appear in more than one team's assignment count. Calls/connections retain their recorded actor after reassignment.
- Stage dwell uses the latest matching recorded stage transition, or company creation for New. Unknown dwell is displayed as not recorded. Pipeline conversion follows the same worked-company cohort rather than dividing unrelated stage snapshots.
- Hiring requirement totals use non-cancelled Mandate records, their filled positions and current Open/Sourcing state. No revenue, pricing, receipt/read status, external enrichment result or financial yield is inferred.
- Fast-track proposal cards show up to 30 recent In Review/Approved/Sent records and link to the existing company proposal review/dispatch workflow. Qualified opportunities link to their company onboarding plan.

## Actions and audit

`POST /api/bd-workspace/admin/directive` creates in-app directives or meeting invitations/tasks for 1–200 explicitly selected active Managers/BD executives. A title, message and request identifier are required; meetings require a future timestamp. Writes and their audit event are transactional; duplicate submissions return the prior result. No external email or push delivery is claimed.

Territory-filtered directives preselect portfolio owners and their reporting managers. Recipients remain reviewable before sending. Reassignment, reminders, lifecycle reviews and research tasks use the existing audited manager action service, which also authorizes Admins. Bulk contact writes are limited to 100 records. Research tasks require the recipient to be assigned to the company; reassignment explicitly grants that company assignment.

The dashboard exports CSV with formula escaping, a typed-string Excel board workbook (report, pipeline, live alerts) and a print layout for browser Save as PDF. Print layouts omit navigation without changing the application sidebar. Global monitoring rules and effective-dated executive targets remain available through the existing Admin settings component.

## Validation

`Backend/tests/adminWorkspace.integration.test.js` exercises role isolation, combined filters, inclusion of unassigned companies, proposal queues, active-recipient validation, directives, meeting tasks and idempotent writes in a disposable random test database.

Browser checks use isolated preview records: territory/period filtering, directive and meeting saves, bulk reassignment, audit visibility, Excel download/worksheet content, desktop layout and 390px mobile overflow. No live staff records are modified during these checks.
