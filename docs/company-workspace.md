# Company 360 workspace

The company detail screen follows the supplied company reference with Hanken Grotesk typography, blue actions, pale account panels, journey stages, six account metrics, and a main/account-intelligence layout. Existing navigation and sidebars are unchanged. List view actions and legacy `?openLead=` links open `/:role/leads/:id`. Create and edit company forms retain their existing behavior.

## Functional sections

- Overview uses recorded stage changes, tasks, communication, business events and mandate counts. Unknown stage dates, location, SLAs and verification details remain unknown. No benchmark, delivery/read receipt, or outreach deadline is inferred from the sample design.
- Contacts supports contact creation, existing approval/rejection workflows, primary-contact selection, decision-maker flags, and links to the contact communication workspace. Only one primary contact is saved per company.
- Hiring keeps legacy company hiring summaries and adds structured mandates with owner, location, priority, status, positions, submissions, interviews, placements, target date and optional sourcing SLA. Counts are manually entered from confirmed recruitment activity. Remaining openings exclude filled positions. Revisions prevent stale overwrites.
- Proposal scopes support draft creation/editing, recipient selection, internal review submission, approval/rejection reasons, and confirmed dispatch linking. Drafts and internal approvals never count toward sent-proposal targets. Only the assigned manager or an admin can review. Dispatch must match a confirmed business event with the same company, owner and reference. Existing email composition and business-outcome confirmation remain separate explicit actions. Review requests and decisions create in-app notifications.
- Follow-ups use scoped company tasks and the existing completion endpoint. Client activation uses the existing agreement/handover-confirmed business workflow.
- Notes and documents save company notes and HTTP(S) links to existing documents. Binary file storage and external document-sharing permissions are not managed by this feature.
- The activity timeline combines company changes, approved scope history, communication, calls, business outcomes and notes, with search, type filters and pagination. Company-level governance events are shared with users authorized for the company. Individual communication retains its owner/team scope.

## Persistence and deployment

Optional `Lead.companyProfile` fields hold company intelligence and account governance. Optional contact flags identify decision makers and the primary contact. New `Mandate` and `CompanyProposal` collections use indexed company IDs. Startup initializes their indexes. Existing company records require no backfill. Legacy requirement descriptions are not automatically converted into detailed mandates.

Company endpoints are mounted under `/api/bd-workspace`:

- `GET /company/:leadId` and `/company/:leadId/timeline`
- `POST /company/:leadId/profile`, `/stage`, `/note`, `/mandates`, `/proposals`
- `PATCH /company/:leadId/contact/:pocId`, `/mandates/:id`, `/proposals/:id`

Writes validate the current database role/status, company access, request identifier, field ranges and workflow state. Retried requests are idempotent and audited. Mandates and proposals use revisions. Company task creation validates parent-company access.

## Verification

`Backend/tests/companyWorkspace.integration.test.js` uses a random isolated `crm_company_test_*` database. It covers isolation, field validation, mandate progress/replay/stale writes, stakeholder roles, company tasks, stage evidence, note links, draft targets, review permissions, notifications, confirmed dispatch and timeline scope/filtering. Cleanup is guarded to that test database. Frontend verification uses the production TypeScript/Vite build and browser checks against isolated preview records.
