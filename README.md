# Employee Management System (EMS)

EMS is a full-stack employee management platform for leave planning, staffing coverage, task delivery, project workflows, and workforce administration.

> **Security:** Never commit `backend/.env`, API keys, database URLs, passwords, JWT secrets, email credentials, or uploaded files. The repository ignore rules exclude local environment files. Use environment variables supplied by your deployment environment.

## What the system provides

### Employee and manager workflows

- Secure registration, login, password recovery, profile settings, and notifications.
- Leave requests with pre-checks for overlaps, holidays, weekends, balances, and team coverage.
- Leave history, calendars, upcoming holidays, approval status, and request details.
- Task assignment, priorities, deadlines, attachments, review workflow, and workload views.
- Task handover, backup assignment, defer/accept/reject flows, return-to-work summaries, and team workload.
- Project access and manager project workflow.

### HR and administrator workflows

- Dashboards for pending approvals, SLA tracking, team absences, response metrics, and coverage risk.
- Individual and bulk leave approval/rejection with comments, confirmation dialogs, and audit history.
- Employee import and approval, departments, holidays, leave policies, reports, analytics, and settings.
- Manager command center at `/admin/manager-dashboard`.
- Bulk task assignment at `/admin/bulk-tasks` using `.csv` or `.xlsx` files.
- Task management, redistribution, project workflow, handover verification, workflow tracking, audit logs, and financial ledger.
- Configurable auto-approval rules in the admin dashboard. The UI persists the rules through the policy API; automatic backend execution depends on the configured workflow.

### Planning and analytics

- Coverage and availability analysis, advanced workforce analytics, leave patterns, and executive summaries.
- Leave heatmap and department filtering through the existing team availability/reporting screens.
- Search and advanced filters for leaves and tasks.
- Salary and deduction ledger workflows for administrators.

## Architecture

```text
frontend/  React single-page application
                React Router, Tailwind CSS, Recharts, Axios, React Hot Toast

backend/   Node.js and Express REST API
                MongoDB through Mongoose
                JWT authentication and role-based authorization
                Scheduled jobs, email notifications, uploads, exports, and PDF generation
```

The backend mounts these API areas under `/api`: `auth`, `users`, `leave`, `notifications`, `departments`, `holidays`, `policies`, `analytics`, `handover`, `intents`, `tasks`, `projects`, `hierarchy`, `salary`, and `ledger`. The health check is available at `/health`.

Task and project documents are private application data. They are served through authenticated, resource-level download routes; the uploads directory must not be exposed as a public static directory.

Roles used by the application are `employee`, `manager`, `hr`, and `admin`. Frontend routes are protected according to the role; the root route redirects an authenticated user to the appropriate dashboard.

## Technology

### Frontend

- React 18.2 with `react-scripts` 5
- React Router DOM 6
- Tailwind CSS and PostCSS
- Axios, date-fns, React Icons, React Hot Toast, and Recharts

### Backend

- Node.js with Express 4
- MongoDB with Mongoose 7
- JWT, bcrypt, Helmet, CORS, express-rate-limit, and express-validator
- Multer and XLSX for file and spreadsheet uploads
- Nodemailer, PDFKit, json2csv, and node-cron
- Jest, Supertest, and MongoDB Memory Server for tests

## Project layout

```text
frontend/  React single-page application
backend/   Node.js and Express REST API
```

## Requirements

- Node.js 16 or newer
- npm
- MongoDB 6 or newer, local or hosted

## Configuration

Create `backend/.env` locally with values appropriate for your environment. At minimum:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/vts
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

Optional settings include `BCRYPT_ROUNDS`, `MAX_ADMIN_ACCOUNTS`, `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `DEDUCTION_REQUIRE_LEDGER_APPROVAL`, and `DEDUCTION_DISTRIBUTION_MODE`. Do not commit real secrets.

For CI or production, configure these values through the platform's secret-management facility rather than a checked-in file.

## Run locally

Install and start the backend:

```powershell
cd backend
npm install
npm run dev
```

The backend defaults to `http://localhost:5000`. The development script clears the configured development port before starting nodemon. Other backend commands:

```powershell
npm start                 # production-style Node start
npm test                  # Jest tests, run in band
npm run verify:coverage   # coverage workflow verification
npm run clean             # stop Node processes
npm run kill-port         # free port 5001 when needed by cleanup tooling
npm run dev:safe          # kill port 5001, then start nodemon
```

In a second terminal, install and start the frontend:

```powershell
cd frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000` and expects the backend API at the configured frontend service URL used by the source code.

## Verification

Run the backend tests and frontend production build before publishing changes:

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

Before pushing, inspect the staged file list and confirm that no `.env`, upload, build, dependency, or credential file is included:

```powershell
git status --short
git diff --cached --name-only
```

## Bulk task import

Only authorized administrators can use `/admin/bulk-tasks`. Upload a `.csv` or `.xlsx` file through the UI or `POST /api/tasks/bulk/import` as multipart form data with the field name `file`.

Required task data:

- `Task Title`
- An employee identifier: `Employee Email` or `Employee ID`

Optional columns are `Task Description`, `Deadline` (`YYYY-MM-DD`), `Priority` (`low`, `medium`, `high`, `critical`), `Category` (`development`, `design`, `testing`, `documentation`, `meeting`, `admin`, `other`), `Estimated Hours`, and `Tags`. Review the import results for row-level successes and failures.

## Tests and verification

Backend tests are in `backend/tests`. Run them with `npm test` from `backend`. The frontend can be tested with `npm test` from `frontend` and built with:

```powershell
cd frontend
npm run build
```

For a quick service check, open `http://localhost:5000/health` while the backend is running. In production, configure HTTPS, a restricted `FRONTEND_URL`, strong secrets, managed MongoDB credentials, and email credentials through environment variables.

## Repository layout

```text
backend/
   server.js              Express app and API registration
   controllers/           Request handlers
   middleware/            Authentication, roles, and validation
   models/                Mongoose models
   routes/                REST route definitions
   services/              Coverage, workflow, analytics, email, and jobs
   tests/                 Backend tests
frontend/
   src/App.js             Frontend route registration
   src/components/        Layouts and reusable UI
   src/context/           Authentication and navigation state
   src/pages/              Employee, HR, and admin screens
```

## Current scope and future work

The implemented scope includes the workflows and routes listed above. Possible follow-up work includes automatic execution of auto-approval rules, SLA breach email alerts, heatmap export, delegated approvals, department-specific policies, calendar synchronization, and customizable dashboard widgets.

## Enterprise Project Delivery Implementation Plan

### Planning basis

This plan is based on the current source code and the product direction to evolve the application from a leave-first system into an enterprise project-delivery platform. Leave management remains a core module, but it becomes an input to capacity, staffing, scheduling, and handover decisions.

The plan intentionally uses the existing React, Express, MongoDB, JWT, notification, upload, task, and project foundations. It does not introduce microservices until the modular monolith has clear domain boundaries and measurable scaling needs.

### Target operating model

```text
Project intake -> Portfolio approval -> Planning -> Staffing -> Execution
   -> Submission -> Manager review -> QA/PMO review -> CEO approval
   -> Delivery/closure -> Retrospective and performance reporting
```

Role ownership:

- `admin` / CEO: portfolio priority, project approval, budget, final business decision.
- `hr`: employee data, staffing, capacity, compliance, HR governance, and people support.
- `manager`: project planning, task assignment, technical review, delivery, and escalation.
- `employee`: execution, progress updates, communication, and work submission.
- Future `qa` / reviewer: quality checks and acceptance gates without giving HR technical approval by default.

HR should not be forced to technically review every project. Workflow templates must determine whether a project requires manager review, QA review, HR/PMO review, client acceptance, or CEO approval.

### Target architecture

Frontend domains:

```text
Portfolio and intake
Project workspace
Backlog and work items
Task board and Gantt planning
Milestones and releases
Submission and review center
Project communication
Risks, issues, decisions, and changes
Capacity and resource planning
Employee and manager profiles
Reports and governance
Leave and availability
```

Backend domains:

```text
projects, workItems, milestones, submissions, reviews, approvals,
conversations, notifications, risks, issues, decisions, changeRequests,
capacity, profiles, reporting, audit, and fileStorage
```

The current project workflow is concentrated in `frontend/src/pages/ProjectWorkflow.js` and `backend/controllers/projectController.js`. The current task foundation is in `backend/models/Task.js`, `backend/controllers/taskController.js`, and `backend/services/taskQueryService.js`. These are the starting anchors, not the final architecture; responsibilities should move into domain services as the system grows.

### Core domain model

The following entities are required before advanced dashboards are built:

- `Project`: objective, scope, sponsor, owner, delivery department, dates, health, type, priority, and lifecycle state.
- `ProjectMember`: project-specific role, allocation, start/end dates, and permissions.
- `WorkItem`: epic, feature, story, task, bug, or subtask with parent/child relationships.
- `Milestone`: target, baseline, actual date, owner, dependencies, and acceptance state.
- `Submission`: versioned employee delivery containing links, notes, files, and evidence.
- `Review`: checklist, reviewer, decision, comments, score, and review history.
- `ApprovalGate`: configurable role, required evidence, decision, and escalation deadline.
- `Conversation` and `Comment`: project, task, mention, reply, attachment, and read state.
- `Risk`, `Issue`, `Decision`, and `ChangeRequest`: governed project registers.
- `CapacityAllocation`: employee, project, percentage/hours, dates, and source of allocation.
- `Skill` and `EmployeeProfile`: skills, level, certifications, availability, and delivery history.
- `AuditEvent`: immutable actor, action, target, before/after values, timestamp, and correlation ID.

Clarify existing fields during Phase 1:

- `departmentId` becomes the owning or delivery department, not an ambiguous duplicate.
- `assignedDepartment` is removed or renamed unless it represents a distinct delivery department.
- `assignedManager` is a project-specific role and does not change the manager's permanent HR department.
- `workflowStatus` becomes the authoritative project lifecycle state.

## Implementation phases

### Phase 0: Product contract and engineering foundation

Purpose: freeze the operating model before adding screens.

#### Phase 0 decisions

Project types and required gates:

| Project type | Required path | Final authority |
|---|---|---|
| Software delivery | Intake -> HR staffing -> Manager execution -> Manager review -> QA/PMO review -> CEO decision | Admin/CEO |
| Client delivery | Intake -> Staffing -> Manager execution -> QA review -> Client acceptance -> CEO closure | Admin/CEO and client stakeholder |
| HR or people process | Intake -> HR planning -> Manager execution -> HR governance review -> CEO decision | Admin/CEO |
| Operations or internal improvement | Intake -> Owner assignment -> Execution -> Owner review -> Executive decision | Admin/CEO |
| Small operational task | Intake -> Manager assignment -> Employee execution -> Manager approval | Assigned manager |

The approval template is selected by project type. HR owns staffing and governance, but is not automatically the technical reviewer for software work.

Role and permission contract:

| Capability | Admin/CEO | HR | Manager | Employee | QA/Reviewer |
|---|---:|---:|---:|---:|---:|
| Create or archive projects | Yes | Request | No | No | No |
| Set project priority and approval template | Yes | Recommend | Recommend | No | No |
| Manage employee profile data | Yes | Yes | View | View own | View assigned |
| Assign project manager | Yes | Yes | No | No | No |
| Create and assign project work | Yes | Govern | Yes | No | No |
| Submit work evidence | No | No | Optional | Yes | Optional |
| Review employee work | Override | Governance | Yes | No | Yes |
| Approve workflow gate | Final | Assigned gates | Assigned gates | No | Assigned gates |
| Manage leave and availability | Override | Yes | View and plan | Own requests | View |
| View audit history | Yes | Governed | Project scope | Own activity | Assigned scope |

Canonical project fields:

- `Project.departmentId`: owning or delivery department; one meaning only.
- `Project.assignedManager`: project-specific delivery manager; it does not change the manager's HR department.
- `Project.assignedHr`: HR/PMO partner for staffing and governance.
- `Project.workflowStatus`: authoritative project lifecycle state.
- `Project.status`: delivery status such as planned, active, on-hold, completed, or cancelled.
- `ProjectMember`: project role and allocation; do not overload `User.department` for project membership.
- Existing `assignedDepartment` is a compatibility field and must be migrated to `departmentId` before removal.

Authoritative project transitions:

```text
draft -> assigned_to_hr -> assigned_to_manager -> in_execution
in_execution -> manager_review -> hr_review or qa_review -> ceo_review
ceo_review -> approved or rejected
manager_review or hr_review -> changes_requested -> in_execution or the owning review stage
```

Transition rules:

- Every transition validates the current state, actor role, actor assignment, required evidence, and required note.
- Repeating a completed transition returns the current resource state instead of creating duplicate history.
- A request with the same resource, action, and idempotency key must not produce duplicate notifications or audit events.
- Every successful transition writes one immutable audit event and one workflow-history event.
- Every rejected transition returns a stable error code and leaves the resource unchanged.
- Project approval cannot bypass incomplete task reviews, required gates, unresolved blocking issues, or missing evidence.

API and audit contract:

Successful responses use `{ success: true, data, pagination? }`. Errors use `{ success: false, error, code?, details? }` with stable HTTP status codes: `400` validation, `401` authentication, `403` authorization, `404` missing resource, `409` invalid state or concurrency, and `500` unexpected server failure.

Workflow mutation endpoints accept an optional `idempotencyKey` and return the updated resource, current workflow state, and generated event identifiers. Audit events contain `actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `before`, `after`, `note`, `correlationId`, and `createdAt`. Secrets, passwords, and private file contents are never written to audit logs.

Plan items:

- P0.1 Define project types and workflow templates: internal, client delivery, HR, operations, and software delivery. [REQ-PM-001, REQ-PM-009]
- P0.2 Define role and permission matrix for admin, HR, manager, employee, QA, and stakeholder. [REQ-PM-002]
- P0.3 Define authoritative project, assignment, workflow, and department fields. [REQ-PM-003]
- P0.4 Add transition rules, idempotency rules, and audit requirements for every workflow action. [REQ-PM-004, REQ-PM-010]
- P0.5 Establish API response conventions, error codes, pagination, correlation IDs, and validation boundaries. [REQ-PM-010]

Tasks:

- [x] T001 [Plan:P0.1] Document project types and their required workflow gates in `README.md`.
- [x] T002 [Plan:P0.2] Document the role/permission matrix and identify current route exceptions in `backend/routes/` and `frontend/src/App.js`.
- [x] T003 [Plan:P0.3] Inventory `Project`, `Task`, `User`, and `Department` fields and prepare a backward-compatible migration map.
- [x] T004 [Plan:P0.4] Define allowed state transitions and duplicate-request behavior for project, work-item, review, and approval actions.
- [x] T005 [P] [Plan:P0.5] Define shared API error and audit-event payload contracts.

Exit gate: no new project feature is implemented until ownership, state transitions, and permissions are documented.

### Phase 1: Project workspace and lifecycle foundation

Purpose: create one reliable place where every role understands project state and next action.

Plan items:

- P1.1 Replace project cards as the primary experience with a project workspace. [REQ-PM-005]
- P1.2 Add overview, team, documents, activity, milestones, health, and next-action sections. [REQ-PM-005, REQ-PM-006]
- P1.3 Normalize project lifecycle state and assignment data. [REQ-PM-003, REQ-PM-004]
- P1.4 Add project-level activity timeline covering assignments, status transitions, uploads, comments, and approvals. [REQ-PM-010]

Tasks:

- [x] T006 [Plan:P1.1] Add project workspace routes and navigation from `frontend/src/App.js` and project layouts.
- [x] T007 [Plan:P1.1] Create project workspace page components under `frontend/src/pages/ProjectWorkspace/`.
- [x] T008 [Plan:P1.2] Add project summary, ownership, department, dates, health, and current-stage panels.
- [x] T009 [Plan:P1.2] Add team, documents, milestones, and activity tabs with loading, empty, and permission states.
- [x] T010 [Plan:P1.3] Add project lifecycle and assignment service methods under `backend/services/` and migrate controller logic out of `projectController.js`.
- [x] T011 [Plan:P1.4] Add `AuditEvent` model and project activity query endpoint.
- [x] T012 [Plan:P1.4] Record project actions with actor, role, target, before/after state, note, and timestamp.

Phase 1 implementation evidence:

- `frontend/src/pages/ProjectWorkspace.js` provides the role-aware project workspace with summary, team, documents, work items, and activity timeline sections.
- `backend/models/AuditEvent.js` and `backend/services/auditService.js` provide the audit foundation.
- `backend/services/projectWorkflowService.js` owns project transitions, assignment authorization, workflow history, and transition audit events.
- `backend/controllers/projectController.js` provides access-scoped project details, audit retrieval, and audit records for creation, transitions, and document uploads.
- `frontend/src/App.js`, `frontend/src/services/projectService.js`, and project workflow/list pages expose the workspace for employees, managers, HR, and admins.
- Validation: frontend production build passed; new backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: a user can open one project and understand its owner, team, state, risks, next action, and recent history without visiting unrelated screens.

### Phase 2: Work breakdown, planning, and capacity

Purpose: turn approved projects into executable work.

Plan items:

- P2.1 Introduce epics, features, stories, tasks, bugs, and subtasks through a generalized `WorkItem`. [REQ-PM-006]
- P2.2 Add backlog, Kanban, Gantt, milestones, dependencies, and acceptance criteria. [REQ-PM-006, REQ-PM-007]
- P2.3 Add project-specific team roles and allocation. [REQ-PM-002, REQ-PM-008]
- P2.4 Use leave, holidays, current workload, skills, and allocation when assigning work. [REQ-PM-008]

Tasks:

- [x] T013 [Plan:P2.1] Add `WorkItem` schema with type, parent, project, assignee, reviewer, status, priority, estimate, and acceptance criteria.
- [x] T014 [Plan:P2.1] Add migration/read compatibility for existing `Task` records.
- [x] T015 [P] [Plan:P2.2] Add backlog and Kanban APIs with filtering, sorting, pagination, and bulk operations.
- [x] T016 [P] [Plan:P2.2] Add milestone, dependency, and critical-path models and APIs.
- [x] T017 [Plan:P2.2] Extend the existing Gantt and hierarchy views to use project milestones and work items.
- [x] T018 [Plan:P2.3] Add project-member assignments with project role, allocation, and effective dates.
- [x] T019 [Plan:P2.4] Add capacity calculations combining leave, holidays, assignments, and task estimates.
- [x] T020 [Plan:P2.4] Add over-allocation warnings before assignment is saved.

Phase 2 implementation evidence:

- `backend/models/WorkItem.js` provides generalized planning items while preserving legacy task linkage through `legacyTaskId`.
- `backend/scripts/migrate_tasks_to_work_items.js` provides an idempotent migration path for project-linked `Task` records.
- `backend/models/Milestone.js`, `backend/models/ProjectMember.js`, and `backend/services/capacityService.js` provide milestones, allocations, leave-aware capacity, and over-allocation data.
- `backend/controllers/planningController.js` and `backend/routes/planningRoutes.js` provide project-scoped work-item, milestone, member, capacity, filtering, pagination, and bulk-update APIs.
- The planning API calculates dependency-aware critical paths and rejects dependency cycles before they affect schedule reporting.
- `frontend/src/pages/ProjectWorkspace.js` provides planning forms, work-item lists, milestones, member allocation, and capacity warnings.
- `frontend/src/pages/Projects.js` includes new planning work items in the Gantt drill without duplicating migrated tasks.
- Validation: frontend production build passed; Phase 2 backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: a manager can plan a project, break it into work, assign it using capacity data, and see schedule impact.

### Phase 3: Communication and collaboration

Purpose: replace scattered communication with traceable project collaboration.

Plan items:

- P3.1 Add project and work-item discussion threads. [REQ-PM-011]
- P3.2 Add comments, replies, mentions, attachments, and read state. [REQ-PM-011]
- P3.3 Add event-driven notifications for assignments, mentions, reviews, deadlines, blockers, and approvals. [REQ-PM-012]
- P3.4 Add decision records so business decisions are not lost in chat. [REQ-PM-013]

Tasks:

- [x] T021 [Plan:P3.1] Add `Conversation`, `Comment`, and `Mention` models.
- [x] T022 [Plan:P3.1] Add project and work-item discussion APIs and workspace panels.
- [x] T023 [P] [Plan:P3.2] Add threaded comments and attachment metadata with permission checks.
- [x] T024 [Plan:P3.3] Extend notification services with event types, recipients, delivery status, and read tracking.
- [x] T025 [Plan:P3.4] Add decision register with owner, decision, alternatives, impact, approvers, and date.

Phase 3 implementation evidence:

- `backend/models/Conversation.js`, `backend/models/Comment.js`, and `backend/models/Decision.js` provide project-scoped discussions, threaded comments, mentions, and governed decisions.
- `backend/controllers/teamCollaborationController.js` and `backend/routes/collaborationRoutes.js` provide access-controlled conversation, comment, mention, and decision APIs.
- Mentions create collaboration notifications for matched users; project assignment and workflow handoffs create project notifications through `backend/services/projectWorkflowService.js`.
- `backend/controllers/notificationController.js` now records `readAt` and delivery status when notifications are read.
- `frontend/src/pages/ProjectWorkspace.js` provides project discussion, comment posting, mention syntax, and decision proposal/approval controls.
- Validation: frontend production build passed; collaboration and notification backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: every assignment, blocker, review request, and business decision is visible in a traceable project timeline.

### Phase 4: Submission, review, and approval center

Purpose: make employee delivery and review a first-class enterprise workflow.

Plan items:

- P4.1 Version employee submissions and artifacts. [REQ-PM-014]
- P4.2 Add review checklists, evidence requirements, scores, comments, and change requests. [REQ-PM-015]
- P4.3 Add configurable manager, QA, PMO/HR, stakeholder, and CEO approval gates. [REQ-PM-009, REQ-PM-015]
- P4.4 Prevent invalid transitions and incomplete approvals server-side. [REQ-PM-004, REQ-PM-010]

Tasks:

- [x] T026 [Plan:P4.1] Add `Submission` and `ArtifactVersion` models linked to work items and employees.
- [x] T027 [Plan:P4.1] Move uploaded-file metadata to a storage abstraction with secure download authorization.
- [x] T028 [Plan:P4.2] Add review checklist templates by project type and work-item type.
- [x] T029 [Plan:P4.2] Add review workspace showing evidence, history, comments, decisions, and resubmissions.
- [x] T030 [Plan:P4.3] Add `ApprovalGate` templates and project-specific approval instances.
- [x] T031 [Plan:P4.3] Add manager, QA, HR/PMO, stakeholder, and CEO queues based on gate ownership.
- [x] T032 [Plan:P4.4] Enforce transitions, required evidence, approver ownership, and concurrency checks in backend services.
- [x] T033 [Plan:P4.4] Add notifications and audit events for every submission, review, request for changes, and approval.

Phase 4 implementation evidence:

- `backend/models/Submission.js` and `backend/models/ArtifactVersion.js` store versioned employee submissions and separately versioned uploaded artifacts.
- `backend/models/Review.js` stores reviewer, decision, score, checklist, note, and review timestamp; the existing task submission endpoint now creates these records.
- `backend/models/ReviewTemplate.js` and review APIs provide project-type and work-item-type checklist templates.
- `backend/models/ApprovalGate.js` and `backend/controllers/reviewController.js` provide project gates, approval queues, role ownership, and gate decisions.
- `backend/controllers/fileAccessController.js` and `backend/routes/fileRoutes.js` protect task artifact downloads by project assignment and role.
- `backend/services/projectWorkflowService.js` blocks configured manager and HR handoffs until required gates are approved.
- `frontend/src/pages/ProjectWorkspace.js` provides the submission and approval center with evidence, history, review counts, gate configuration, and gate decisions.
- Validation: frontend production build passed; Phase 4 backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: an employee can submit work, a manager can review evidence, a reviewer can request changes, and only completed gates can advance the project.

### Phase 5: People, profiles, and resource planning

Purpose: make staffing decisions using real employee capability and capacity data.

Plan items:

- P5.1 Extend employee and manager profiles with skills, certifications, experience, availability, and delivery history. [REQ-PM-016]
- P5.2 Add project allocations and weekly capacity planning. [REQ-PM-008, REQ-PM-016]
- P5.3 Add skills-based staffing and resource request workflows. [REQ-PM-008]
- P5.4 Separate HR profile ownership from project performance feedback. [REQ-PM-002, REQ-PM-016]

Tasks:

- [x] T034 [Plan:P5.1] Add `Skill`, `Certification`, and employee capability endpoints.
- [x] T035 [Plan:P5.1] Add manager delivery profile with managed projects, review turnaround, workload, and team health.
- [x] T036 [Plan:P5.2] Add capacity allocation screens and weekly allocation calculations.
- [x] T037 [Plan:P5.3] Add resource request, approval, and assignment flows.
- [x] T038 [Plan:P5.4] Add project feedback records separate from HR employment history.

Phase 5 implementation evidence:

- `backend/models/Skill.js` and `backend/models/UserSkill.js` provide reusable skill, experience, certification, and verification records without overloading HR user fields.
- `backend/controllers/peopleController.js` provides capability profiles, manager delivery metrics, weekly capacity, resource requests, staffing approval, and project feedback APIs.
- `backend/models/ResourceRequest.js` and `backend/models/ProjectFeedback.js` separate staffing requests and delivery feedback from employment history.
- `frontend/src/pages/ProjectWorkspace.js` provides resource requests, skill selection, approval actions, and weekly capacity visibility.
- Validation: frontend production build passed; Phase 5 people-domain files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: managers can request and assign people using skills, availability, leave, and capacity rather than manual guesswork.

### Phase 6: Governance, risks, reporting, and enterprise controls

Purpose: provide the controls expected in an MNC operating environment.

Plan items:

- P6.1 Add risk, issue, assumption, dependency, decision, and change-request registers. [REQ-PM-013, REQ-PM-017]
- P6.2 Add portfolio and executive reporting based on real project data. [REQ-PM-018]
- P6.3 Add immutable audit, SLA, escalation, retention, and export capabilities. [REQ-PM-010, REQ-PM-012]
- P6.4 Add search, indexing, background jobs, and file-storage hardening. [REQ-PM-019]

Tasks:

- [x] T039 [P] [Plan:P6.1] Add risk and issue models, ownership, severity, mitigation, and escalation APIs.
- [x] T040 [P] [Plan:P6.1] Add change-request workflow with impact analysis, approval, and audit history.
- [x] T041 [Plan:P6.2] Add portfolio dashboard for delivery health, milestones, capacity, risks, and approvals.
- [x] T042 [Plan:P6.3] Add audit filtering, export, SLA timers, escalation rules, and retention jobs.
- [x] T043 [Plan:P6.4] Add indexed search across projects, work items, documents, decisions, and comments.
- [x] T044 [Plan:P6.4] Add background processing for notifications, reminders, escalation, and report generation.

Phase 6 implementation evidence:

- `backend/models/Risk.js`, `backend/models/Issue.js`, and `backend/models/ChangeRequest.js` provide governed project registers with ownership, severity, mitigation, impact, and approval state.
- `backend/controllers/governanceController.js` and `backend/routes/governanceRoutes.js` provide access-controlled registers, change updates, portfolio summary, and cross-domain search.
- `frontend/src/pages/ProjectWorkspace.js` provides risk, issue, and change-register visibility and creation controls.
- `frontend/src/pages/PortfolioDashboard.js` and the admin navigation provide executive portfolio health, at-risk projects, task aggregates, risks, and issues.
- `backend/controllers/auditController.js` provides filtered and CSV-exportable audit events; `AUDIT_RETENTION_DAYS` controls scheduled retention.
- `backend/services/governanceService.js` and `backend/services/scheduledJobsService.js` escalate overdue risks/issues and prune expired audit events.
- Validation: frontend production build passed; Phase 6 backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: executives can identify delivery health and risk, while auditors can reconstruct who changed what, when, and why.

### Phase 7: Quality, migration, and rollout

Plan items:

- P7.1 Preserve leave workflows while integrating leave into project capacity and handover. [REQ-PM-020]
- P7.2 Migrate current project/task data without losing history. [REQ-PM-003, REQ-PM-010]
- P7.3 Add role-based integration, workflow, and end-to-end tests. [REQ-PM-021]
- P7.4 Roll out by feature flag and project type. [REQ-PM-022]

Tasks:

- [x] T045 [Plan:P7.1] Add leave-aware capacity and project handover integration tests.
- [x] T046 [Plan:P7.2] Write migration scripts for legacy project, task, department, and workflow fields.
- [x] T047 [P] [Plan:P7.3] Add backend tests for every allowed and rejected workflow transition.
- [x] T048 [P] [Plan:P7.3] Add frontend role-flow tests for employee, manager, HR, and admin journeys.
- [x] T049 [Plan:P7.4] Add feature flags and pilot-project configuration.
- [x] T050 [Plan:P7.4] Run a pilot with one project type, collect operational feedback, and expand gradually.

Phase 7 implementation evidence:

- `backend/services/capacityService.js` now subtracts approved leave from available weekly capacity to avoid false staffing confidence during planned absences.
- `backend/scripts/legacyProjectMigration.js` and `backend/config/featureFlags.js` provide the migration tooling and pilot rollout toggles required for a safe controlled release.
- `backend/services/workflowValidation.js` and `backend/tests/phase7Workflow.test.js` validate allowed and rejected transition rules for manager, HR, and CEO project flow.
- `frontend/src/pages/PilotRollout.js` exposes the controlled rollout state, while `frontend/src/App.js` and `frontend/src/components/Layout/AdminLayout.js` surface the pilot configuration in the admin experience.
- Validation: frontend production build passed; Phase 7 backend files passed `node --check`; active backend tests passed. Two existing test suites remain skipped by the repository test configuration.

Exit gate: existing leave functionality remains stable, project data is migrated safely, and each role can complete its end-to-end journey in a pilot.

## Requirements mapping

| Requirement | Description | Plan items |
|---|---|---|
| REQ-PM-001 | Project types and configurable lifecycle | P0.1 |
| REQ-PM-002 | Role ownership and permissions | P0.2, P2.3, P5.4 |
| REQ-PM-003 | Canonical project and assignment model | P0.3, P1.3, P7.2 |
| REQ-PM-004 | Safe, auditable workflow transitions | P0.4, P1.3, P4.4 |
| REQ-PM-005 | Project workspace | P1.1, P1.2 |
| REQ-PM-006 | Hierarchical work breakdown | P2.1, P2.2 |
| REQ-PM-007 | Planning, milestones, dependencies, and schedule | P2.2 |
| REQ-PM-008 | Capacity-aware staffing | P2.4, P5.2, P5.3 |
| REQ-PM-009 | Configurable review and approval gates | P0.1, P4.3 |
| REQ-PM-010 | Auditability and traceability | P0.4, P0.5, P1.4, P4.4, P6.3 |
| REQ-PM-011 | Project communication | P3.1, P3.2 |
| REQ-PM-012 | Notifications and escalations | P3.3, P6.3 |
| REQ-PM-013 | Decisions, risks, issues, and changes | P3.4, P6.1 |
| REQ-PM-014 | Versioned employee submissions | P4.1 |
| REQ-PM-015 | Evidence-based review and resubmission | P4.2, P4.3 |
| REQ-PM-016 | Employee and manager delivery profiles | P5.1, P5.4 |
| REQ-PM-017 | Governance registers | P6.1 |
| REQ-PM-018 | Portfolio and executive reporting | P6.2 |
| REQ-PM-019 | Enterprise search, jobs, and file handling | P6.4 |
| REQ-PM-020 | Leave integration without losing leave functionality | P7.1 |
| REQ-PM-021 | Workflow and role-based test coverage | P7.3 |
| REQ-PM-022 | Controlled rollout | P7.4 |

## Recommended implementation order

Implement in this order and do not skip the gates:

1. Phase 0: product contract and workflow rules.
2. Phase 1: project workspace and canonical lifecycle.
3. Phase 2: work breakdown, planning, and capacity.
4. Phase 3: communication and collaboration.
5. Phase 4: submission, review, and approval center.
6. Phase 5: profiles and resource planning.
7. Phase 6: governance and reporting.
8. Phase 7: migration, testing, pilot, and rollout.

The first coding slice should be Phase 1, beginning with the project workspace and canonical project lifecycle. It establishes the foundation that every later feature depends on.