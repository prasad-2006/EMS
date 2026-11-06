# EMS Project Process: Create, Assign, Execute, Review

This is a test guide for the project workflow currently implemented in EMS. Use separate test users for Admin/CEO, HR, Manager, and Employee so each permission boundary is exercised.

## 1. Roles and screens

| Role | Main project screens | Actions in this flow |
| --- | --- | --- |
| Admin/CEO | `/admin/projects`, `/admin/project-workflow`, `/admin/projects/:id` | Create/edit a project, assign HR, upload documents, make the final decision |
| HR | `/hr/projects`, `/hr/projects/:id` | Select the manager and department, review the handoff, send the project to CEO, request changes |
| Manager | `/manager/projects`, `/projects/:id` | Start execution, assign project tasks, review employee submissions, send the project to HR |
| Employee | `/projects`, `/projects/:id`, `/tasks` | View assigned work and submit evidence for review |

Project creation and editing are Admin-only. HR does not create the project record in the current UI.

## 2. Understand the two project statuses

EMS stores two different statuses:


The workflow starts as `draft` automatically when an Admin creates a project. Do not confuse a project being `active` with it being in the `in_execution` workflow state.

The normal implemented path is:

```text
draft -> assigned_to_hr -> assigned_to_manager -> in_execution
in_execution -> manager_review -> hr_review -> ceo_review -> approved
```

The project can move to `changes_requested` from manager or HR review. A rejected project can be assigned to HR again, and a project requiring changes can be assigned to a manager again after corrections.

## 3. Account settings

All four roles (admin, HR, manager, and employee) use the shared Settings screen for:

- Profile and emergency-contact updates, with controlled employment fields displayed read-only.
- Password and email security, including current-password verification.
- Active-session review and revocation, with the current session identified separately.
- Authenticator-app MFA setup, one-time recovery codes, MFA login challenges, and protected MFA disablement.
- Server-persisted notification and appearance preferences.
- Personal privacy summaries and export, deactivation, or deletion requests.

Organization-wide configuration remains a separate admin-only section and is not mixed with personal account settings.

## 3. Prepare test data

Before starting, make sure the database has:

1. One active or approved Admin user.
2. One active or approved HR user.
3. One active or approved Manager user.
4. One active Employee user in the department HR will select.
5. One active project department.

The workflow checks selected HR and Manager users by role and active/approved status. It also checks that project tasks are assigned to an Employee in the selected project department.

## 4. Create the project as Admin/CEO

1. Sign in as Admin/CEO.
2. Open **Projects** at `/admin/projects`.
3. Select **Create Project**.
4. Enter the fields shown by the current form:

   - **Project Name**: required.
   - **Project Code**: optional reference such as `ATT-101`.
   - **Description**: explain the intended outcome.
   - **Assign to Department**: optional at creation. HR selects the project department during manager assignment.
   - **Status**: choose `planned`, `active`, `on-hold`, `completed`, or `cancelled`.
   - **Start date** and **End date**: optional, but the end date cannot be before the start date.
   - **Project Document**: optional PDF, Word, Excel, CSV, Markdown, or text file up to 50 MB.

5. Save the form.

Expected result:


Important current limitation: the create form does not ask for project type, owner, priority, risks, assumptions, manager, HR, or workflow status. Those are not fields to fill in on this screen. `projectType` exists in the database model and defaults to `software_delivery`, but it is not exposed by the current create form.

## 5. Assign the project to HR

1. Stay signed in as Admin/CEO.
2. Open `/admin/project-workflow`.
3. Find the project with status **Draft**.
4. Select the active/approved HR user.
5. Add an optional handoff note.
6. Select **Assign to HR**.

Expected result:


The selected user must have the `hr` role and an `approved` or `active` status.

## 6. HR assigns the Manager and department

1. Sign out and sign in as the assigned HR user.
2. Open `/hr/projects`.
3. Open the project workflow queue.
4. For the project in **With HR**, select an active/approved `manager` and an active project department.
5. Add an optional handoff note.
6. Select **Assign Manager & Department**.

Expected result:


The HR user must be the HR user assigned to this project. An unrelated HR user cannot perform this handoff.

## 7. Manager starts execution

1. Sign in as the assigned Manager.
2. Open `/manager/projects`.
3. Confirm the project is in **With Manager**.
4. Add an optional note and select **Start Execution**.

Expected result: `workflowStatus` changes to `in_execution`, and the transition is added to workflow history and audit history.

## 8. Set up the project workspace

Open the project workspace at `/projects/:id` or the role-specific Admin/HR path. The workspace currently supports:


Admin, HR, and Manager can plan the workspace. Project membership is separate from the user's normal HR department. Available project roles in the current form include `member`, `lead`, `qa`, `stakeholder`, `developer`, and `designer`. Allocation must be between 1 and 100 percent.

For a focused workflow test, add the Employee as a project member and create at least one task. Milestones, work items, conversations, governance records, and approval gates are optional unless you are testing those features.

## 9. Manager assigns a project task

1. In the Manager project workspace or workflow queue, use **Cascading Assign**.
2. Select the project department.
3. Select the project.
4. Select an Employee. The employee must belong to the selected project department.
5. Enter:

   - **Task title**: required;
   - **Description**: optional;
   - **Deadline**: optional;
   - **Priority**: `low`, `medium`, `high`, or `critical`;
   - **Category**: `development`, `design`, `testing`, `documentation`, `meeting`, `admin`, or `other`.

6. Select **Assign**.

The assignment is leave-aware. Approved leave overlapping the deadline makes an employee ineligible, and the API rejects the assignment if the leave constraint is violated. The Employee receives a task notification.

## 10. Employee submits evidence

1. Sign in as the assigned Employee.
2. Open `/tasks` or the task link from the notification.
3. Open the task submission form.
4. Provide at least one form of evidence:

   - completion notes;
   - documentation links;
   - uploaded documentation files.

Repository and pull request links are also supported. Select **Send to Manager**.

Expected result:


The Employee cannot submit another person's task. A submission without a note, link, or attachment is rejected.

## 11. Manager reviews the task submission

1. Sign in as the assigned Manager.
2. Open `/manager/projects`.
3. In **Employee submissions awaiting review**, inspect the evidence.
4. Choose one outcome:

   - **Approve Task**: the task becomes `done` and `reviewStatus` becomes `approved`.
   - **Request Changes**: enter a review note first; the task becomes `rejected` and `reviewStatus` becomes `changes_requested`.

If changes are requested, the Employee updates the work and submits a new version. Repeat the review until every task for the project is approved.

## 12. Submit the project for Manager Review

When the project has at least one task and every project task has `reviewStatus: approved`:

1. Return to `/manager/projects`.
2. Confirm the task count and approval state.
3. Add an optional project handoff note or upload a project document.
4. Select **Submit for Manager Review**.

Expected result: `workflowStatus` changes from `in_execution` to `manager_review`.

The API blocks this action when there are no project tasks or when even one project task is not approved. This is the most important prerequisite in the test flow.

## 13. Manager forwards the project to HR

1. Review the project workspace, task history, documents, risks, issues, and decisions.
2. From the Manager workflow queue, select **Send to HR**.

Expected result:


The Manager can instead select **Request Changes** from `manager_review`. A note is required, and the project returns to `changes_requested`.

## 14. HR reviews and forwards to CEO

1. Sign in as the assigned HR user.
2. Open `/hr/projects` and the project workspace.
3. Review the Manager handoff, project documents, task approvals, and governance records.
4. If corrections are needed, enter a note and select **Request Changes**.
5. If the project is ready, add an optional note and select **Send to CEO**.

Expected result for forwarding: `workflowStatus` changes from `hr_review` to `ceo_review`.

## 15. CEO makes the final decision

1. Sign in as Admin/CEO.
2. Open `/admin/project-workflow`.
3. Open the project in **CEO Review**.
4. Review the workspace, documents, workflow history, audit events, and latest review note.
5. Choose one outcome:

   - **Approve Project**: the workflow becomes `approved`.
   - **Reject Project**: enter a rejection note first; the workflow becomes `rejected`.

The final decision is recorded with the actor, previous state, new state, action, and note where provided.

## 16. Verify the complete test

Open the project workspace and confirm:


Also verify these negative cases:


## Example: Employee Attendance Automation

Use this example to run the full happy path.

1. **Admin creates the project**
   - Name: `Employee Attendance Automation`
   - Code: `ATT-101`
   - Description: `Automate attendance capture and produce a daily HR report.`
   - Department: leave blank or select `HR`.
   - Status: `planned`.
   - Start date: `2026-10-12`.
   - End date: `2026-11-06`.
   - Upload an optional requirements document.
   - Expected workflow: `draft`.

2. **Admin assigns HR**
   - Select `Anita HR`.
   - Note: `Please confirm staffing and delivery ownership.`
   - Expected workflow: `assigned_to_hr`.

3. **HR assigns the delivery owner**
   - Manager: `Ravi Manager`.
   - Department: `Engineering`.
   - Note: `Engineering will deliver the attendance integration.`
   - Expected workflow: `assigned_to_manager`.

4. **Manager starts execution**
   - Select **Start Execution**.
   - Expected workflow: `in_execution`.

5. **Manager assigns a task**
   - Employee: `Meena Employee` from `Engineering`.
   - Title: `Build attendance import validation`.
   - Description: `Validate employee ID, date, and duplicate attendance entries.`
   - Deadline: `2026-10-23`.
   - Priority: `high`.
   - Category: `development`.

6. **Employee submits evidence**
   - Completion notes: `Validation added and tested with duplicate and invalid employee records.`
   - Documentation link: `https://example.com/attendance-validation`.
   - Expected task state: `review` with `reviewStatus: submitted`.

7. **Manager approves the task**
   - Inspect the evidence and select **Approve Task**.
   - Expected task state: `done` with `reviewStatus: approved`.

8. **Manager submits the project for review**
   - Select **Submit for Manager Review**.
   - Expected workflow: `manager_review`.

9. **Manager sends it to HR**
   - Select **Send to HR**.
   - Expected workflow: `hr_review`.

10. **HR sends it to CEO**
    - Review the project history and select **Send to CEO**.
    - Expected workflow: `ceo_review`.

11. **CEO approves**
    - Select **Approve Project**.
    - Expected final workflow: `approved`.

At the end of this example, the project has a creator, HR owner, delivery manager, department, member/task assignment, employee evidence, manager task approval, HR handoff, CEO decision, workflow history, audit events, and notifications.

## Troubleshooting the test
