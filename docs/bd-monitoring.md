# BD activity workspace

The BD, Manager and Admin dashboard routes open the shared activity workspace.
The view uses the existing user's role to load permitted database records.
Attendance work remains in the later phase.

## User workflows

- Use **Record activity** to find an approved company and contact.
- Contact details and post-call feedback also open the structured communication form.
- Record a call when a call occurred. Each saved call adds one attempt.
- Confirm manually sent WhatsApp, email and LinkedIn messages in the form. Opening a link has no effect on sent counts.
- Mark unsuitable channels Not Applicable and record a reason. An explained non-call outreach is supported.
- Busy and No Answer schedule a callback at the entered time or 10 AM IST on the next configured working day.
- Callback Requested requires the client's requested future time.
- Wrong Number opens a recovery checklist. Unavailable and not applicable steps require an explanation.
- LinkedIn requests and acceptance are recorded separately. Pending requests create review tasks.
- Contact timelines retain communication snapshots, actor and timestamp.
- Record a proposal after sending it, using a stable unique reference and evidence. Reusing the reference returns a conflict.
- Enter the actual send or activation time for business outcomes. The server retains a separate audit timestamp.
- Record client feedback separately. Onboarding requires configured confirmations and is unique per company.
- Confirmed proposals advance New/Contacted companies to Proposal Sent. Verified onboarding advances the company to Onboarded. Both transitions retain activity history.
- Opportunity planning records qualified opportunities awaiting proposals and expected future onboardings.
- Submit the daily report after completing worked-contact records. Later updates require resubmission. Late reports require a reason and retain history.
- Saved provider-confirmed email logs contribute to email totals. External email sends require manual confirmation. Record meaningful two-way conversations explicitly to resolve an unreached-contact window.
- Managers can remind an executive, reassign a follow-up, or resolve an escalation with a reason. Reassignment grants the selected executive company access through the existing assignment field.

## Dashboards

The eight KPI cards cover calls, connections, WhatsApp, personalized email,
LinkedIn requests, acceptance, daily proposals and monthly onboardings.
The view includes progress bars, recording completeness, follow-up compliance, submissions,
team comparisons, contact queues, lifecycle reviews, proposal feedback, conversions and 7/30-day trends.
Queue filters and stalled-company search run on the server. Results are paginated.
Targets use the latest effective employee setting.
Non-working days have no daily proposal target.
Conversions use distinct companies with confirmed business events.
Superseded reminders and resolved escalation tasks are excluded from follow-up compliance.

Current stage labels remain visible in the pipeline. Target totals use confirmed events.
Historical proposals and activations cannot be established from stage labels alone.
Legacy Contacted call outcomes retain the application's prior interpretation of a connected call.
Unrecorded historical stage-entry dates remain unknown.

## Configuration and deployment

Use the existing MONGO_URI, JWT_SECRET, VAPID and email settings.
Manual tracking and in-app notifications require no new integration credentials.
MongoDB must support transactions, such as Atlas or a replica set.
Deploy the backend before the frontend.

Admin settings configure the working calendar, holidays, 18:30 IST cutoff,
daily proposal target (5), monthly onboarding target (10), LinkedIn review interval (3 days),
wrong-number escalation interval (3 days), and callback advance notice (15 minutes).
The initial calendar is Monday through Friday.
Admin can save effective-dated employee targets and required onboarding confirmations.

The job checks every minute while the backend runs.
Use an always-running backend instance for timely reminders.
Notifications have a unique recipient/event key and support multiple backend instances.
Notifications are delivered in the app and can be marked read.
Existing task push reminders continue to operate.

## Additive migration

New collections hold contact state, immutable events, submissions, business events,
settings, targets and notifications. Existing models gain optional fields and indexes.
Startup initializes new model indexes.

The job imports unsynchronized calls from the last 24 hours. To import older calls,
run these commands from Backend with MONGO_URI configured.

    node scripts/migrate-bd-monitoring.js --from=2026-11-01
    node scripts/migrate-bd-monitoring.js --from=2026-11-01 --apply

The first previews the count. The second is restartable and preserves source records.
Unconfirmed channels remain pending or unknown.
Unsuccessful imported calls can generate review/retry tasks. Import a deliberate date range.

## Verification

Run backend tests from Backend.

    node --test tests/bdMonitoringRules.test.js tests/bdWorkspace.integration.test.js tests/leadPocFilter.test.js tests/linkedinContactApproval.test.js

Run the frontend build from Frontend.

    npm run build

Set MONITORING_TEST_URI to run integration tests against a randomly named crm_bd_test_* database.
The suite runs real API requests and drops only that temporary database.
Without that variable, the integration test is explicitly skipped.


## BD Executive reference design

The BD layout follows the supplied Stitch reference with Inter typography, navy navigation, pale blue background, blue actions, compact KPIs, targets, tasks, action queue, recovery widgets, pipeline, LinkedIn tracker and analytics. Responsive layouts collapse navigation and contain horizontal table scrolling.

Queue filters, column visibility, full filtered CSV export, selected-contact bulk follow-up scheduling, task completion and lifecycle review use real CRM records. Bulk scheduling checks ownership and is idempotent. CSV values escape spreadsheet formulas. Record Sent Proposal opens the confirmed business-event form. Email uses the existing Send Email flow. Onboarding queue shows Won companies pending activation.

Accountability weights: communication 25, timely follow-up 25, overdue resolution 15, lifecycle review 15, timely report submission 20. Inapplicable components are excluded and applicable weights normalized. The score is provisional before pending deadlines. Delivery and email-open metrics are explicitly untracked. Attendance remains deferred.


## Contact command workspace

Contact detail uses the supplied three-column reference and Hanken Grotesk typography. Profile and quick actions appear beside Overview, Activities & Timeline, and Proposals & Requirements, with company information, related contacts, hiring requirements and recent history on the right. Unknown contact location, compliance clearance, outreach SLA, fulfillment rate and mandate deadline are not invented from the sample image.

Calls, channel confirmations, business outcomes, remarks, email, calendar links, contact edits and company master reuse existing flows. Task creation now passes the contact ID, and scoped contact-task completion uses the existing workspace endpoint. Timeline supports search, type filters, expansion and loading older communication records. Company events are included alongside contact events.

Opportunity plans persist optional whole openRequirements (0–100000) and probability (0–100) values. POST /api/bd-workspace/requirements/:leadId saves up to 50 named company requirements, position and designation counts, with scope validation, request replay protection and audit events. This uses existing company hiring fields and does not create a separate recruitment tracking system.
