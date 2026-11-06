# Profile and Account Management Implementation Plan

**Date**: 2026-11-03  
**Status**: For review  
**Scope**: Employee, Manager, HR, Auditor, and Admin account/profile settings

## Summary

Improve the existing Settings experience into a secure internal-company account center. The work preserves the current profile update flow while adding account security, session/device control, notification preferences, accessibility preferences, privacy/data controls, and role-aware administration.

The implementation must keep organization-wide policy configuration separate from personal settings. No user may edit their role, employment status, department, salary, leave balances, permissions, manager, or audit history from personal settings.

## Current-State Findings

- [Settings.jsx](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/frontend/src/pages/Settings.jsx:1) currently mixes profile, password, appearance, browser-local preferences, and admin global configuration.
- Profile updates are supported through `PUT /api/users/me` in [userController.js](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/backend/controllers/userController.js:170).
- Password changes require the current password, but there is no dedicated security/session center.
- Notification toggles are stored only in browser local storage, so preferences do not follow the user across devices.
- `/api/settings` is a global organization setting endpoint, not a personal account-settings endpoint.
- The User model already contains lockout and password-change fields, but MFA, sessions/devices, privacy preferences, locale/timezone, and notification preferences are absent.
- Existing audit infrastructure can record security-sensitive account changes through [auditService.js](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/backend/services/auditService.js:3).

## Product Scope

### In scope

1. Personal profile and contact details.
2. Password and account security.
3. MFA-ready security settings.
4. Active sessions and logout-all-sessions.
5. Notification preferences across devices.
6. Appearance, accessibility, timezone, locale, and date format.
7. Privacy, data export, and account deletion/request controls.
8. Role-aware settings navigation and API authorization.
9. Admin-only organization settings kept separate.
10. Audit events and authorization-boundary tests.

### Out of scope for this phase

- Full enterprise SSO/OIDC provider integration.
- Payroll, attendance, performance, onboarding, or approval workflow modules.
- User self-service role, department, manager, salary, or employment-status changes.
- Permanent account deletion without retention/legal-policy approval.

## Functional Requirements

### Account and profile

- **REQ-001**: Every authenticated user can view and update only their own permitted profile fields.
- **REQ-002**: The profile shows authoritative read-only employment information: employee ID, role, department, manager, employment type, joining date, and account status.
- **REQ-003**: The profile supports phone, alternate email, address, emergency contact, designation where permitted, timezone, locale, and date format.
- **REQ-004**: Sensitive profile changes show clear validation errors and create an audit event without recording passwords or secrets.

### Security

- **REQ-005**: A user can change their password by providing the current password and a policy-compliant new password.
- **REQ-006**: Password policy is enforced consistently for registration, reset, and profile password changes.
- **REQ-007**: A successful password change invalidates prior sessions and requires re-authentication.
- **REQ-008**: Users can enable, disable, and manage MFA using a recovery-safe flow; disabling MFA requires re-authentication.
- **REQ-009**: Users can view active sessions/devices, revoke one session, and revoke all other sessions.
- **REQ-010**: Security-sensitive events notify the account owner and are recorded in the audit stream.

### Notifications and accessibility

- **REQ-011**: Notification preferences are stored server-side and follow the user across devices.
- **REQ-012**: Users can independently configure in-app, email, push/SMS readiness, leave reminders, approval notifications, task/project notifications, and security alerts.
- **REQ-013**: Security alerts cannot be disabled; delivery fallback is explicit when an optional channel is unavailable.
- **REQ-014**: Users can configure font scale, reduced motion, contrast/theme, timezone, locale, date format, and week-start preference.

### Privacy and data rights

- **REQ-015**: Users can view what personal data is held in their profile and request an export.
- **REQ-016**: Users can request account deactivation/deletion subject to organizational retention rules; the system must not silently delete legally required records.
- **REQ-017**: Privacy requests show status, submission time, reviewer, and resolution note.

### Administration and governance

- **REQ-018**: Admin-only organization settings remain isolated from personal settings.
- **REQ-019**: HR/admin can manage employment-controlled fields through existing user administration, not through self-service profile settings.
- **REQ-020**: All account-setting endpoints enforce ownership or explicit role authorization on the server, independent of frontend visibility.
- **REQ-021**: Automated tests cover unauthorized profile access, sensitive-field tampering, session revocation, password-change invalidation, notification preference ownership, and admin-only settings.

## Recommended Settings Information Architecture

### 1. My Profile

Editable:

- Name
- Work email with verification/change confirmation
- Phone
- Alternate email
- Address
- Emergency contact
- Profile photo, if storage policy is approved

Read-only:

- Employee ID
- Role
- Department(s)
- Manager
- Designation/grade when HR-controlled
- Employment type
- Joining date
- Account status

### 2. Security

- Change password
- Password requirements
- MFA setup/verification/recovery codes
- Active sessions/devices
- Revoke session
- Logout all other sessions
- Recent security activity

### 3. Notifications

- In-app notifications
- Email notifications
- Optional push/SMS channel
- Leave reminders
- Approval and delegation notices
- Task/project updates
- Policy and compliance notices
- Mandatory security alerts

### 4. Appearance and Accessibility

- Theme/contrast
- Font scale
- Reduced motion
- Timezone
- Locale
- Date/time format
- Week starts on Monday/Sunday

### 5. Privacy and Data

- Personal-data summary
- Export my data
- Privacy request history
- Deactivation/deletion request
- Retention explanation

### 6. Organization Settings (Admin only)

Keep the current CEO/global configuration here, but do not render it as a personal setting for non-admin users.

## Implementation Steps

### Phase 1: Foundational contracts and data model

#### P1.1 Define the settings contract

Requirements: REQ-001 through REQ-021  
Define response shapes, editable/read-only field rules, error codes, audit actions, retention rules, and channel capability behavior before UI work.

#### P1.2 Add account security and preference persistence models

Requirements: REQ-007 through REQ-017  
Add separate persisted structures for:

- `UserSession` or equivalent hashed refresh/session records
- `UserSecuritySettings` or MFA fields with encrypted secrets/recovery-code hashes
- `UserNotificationPreferences`
- `UserAppearancePreferences`
- `PrivacyRequest`

Avoid adding all settings as unstructured fields on `User`.

#### P1.3 Add security and privacy service boundaries

Requirements: REQ-004 through REQ-020  
Create focused services for session revocation, MFA lifecycle, preference updates, privacy requests, data export, and security-event notification. Reuse existing audit infrastructure.

### Phase 2: Profile and security experience

#### P2.1 Refactor Settings into sections

Requirements: REQ-001 through REQ-010, REQ-014, REQ-018  
Refactor [Settings.jsx](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/frontend/src/pages/Settings.jsx) into accessible sections or tabbed panels. Keep profile and security actions visually separate from organization settings.

#### P2.2 Harden personal profile APIs

Requirements: REQ-001 through REQ-004, REQ-019, REQ-020  
Split profile reads, profile updates, and security updates into explicit endpoints. Reject forbidden fields such as role, status, department, manager, salary, permissions, and leave balances.

#### P2.3 Implement session/device management

Requirements: REQ-007, REQ-009, REQ-010, REQ-020  
Add active-session listing, single-session revoke, logout-all-other-sessions, token/session versioning, and security notifications.

#### P2.4 Implement MFA-ready account security

Requirements: REQ-008, REQ-010, REQ-020, REQ-021  
Implement the selected MFA method behind a provider/service boundary. The first implementation should use TOTP plus recovery codes unless SSO requirements change the decision.

### Phase 3: Preferences and privacy

#### P3.1 Persist notification preferences

Requirements: REQ-011 through REQ-013, REQ-020  
Replace local-only notification toggles with server-side preferences. Keep local storage only for device-specific presentation state if necessary.

#### P3.2 Persist accessibility and regional preferences

Requirements: REQ-014, REQ-020  
Store preferences server-side, apply them at login, and support safe defaults when a user has no saved preferences.

#### P3.3 Add privacy and data-request workflows

Requirements: REQ-015 through REQ-017, REQ-020, REQ-021  
Add data summary, export request/status, and deactivation/deletion request flows. Export must exclude passwords, tokens, MFA secrets, and internal security metadata.

### Phase 4: Governance, migration, and validation

#### P4.1 Separate organization settings from personal settings

Requirements: REQ-018, REQ-019, REQ-020  
Keep `/api/settings` for organization-wide settings and add a separate personal settings API namespace. Verify role authorization on both.

#### P4.2 Migrate existing preferences safely

Requirements: REQ-011, REQ-014  
On first load, migrate existing local notification/accessibility values to server-side preferences only when the user has not already saved a server preference. Do not overwrite an existing server choice.

#### P4.3 Add authorization and workflow tests

Requirements: REQ-004, REQ-007 through REQ-010, REQ-020, REQ-021  
Cover positive and negative API tests, including cross-user access attempts and sensitive-field injection.

#### P4.4 Update documentation and operational guidance

Requirements: REQ-005, REQ-008, REQ-009, REQ-015, REQ-016, REQ-018  
Document account recovery, MFA recovery, session revocation, privacy retention behavior, and admin-versus-personal settings boundaries.

## Task Breakdown

### Phase 1

- [ ] T001 [Plan:1.1] Define account-settings API response/error contract in `backend` documentation and controller conventions.
- [ ] T002 [P] [Plan:1.2] Add `UserSession` model with hashed token/session identifier, device metadata, timestamps, revocation state, and indexes.
- [ ] T003 [P] [Plan:1.2] Add persisted notification and appearance preference models with safe defaults.
- [ ] T004 [P] [Plan:1.2] Add `PrivacyRequest` model with request type, status, reviewer, timestamps, and resolution note.
- [ ] T005 [Plan:1.3] Add security/session, preference, privacy, and export service modules under `backend/services`.

### Phase 2

- [ ] T006 [P] [US1] [Plan:2.1] Refactor `frontend/src/pages/Settings.jsx` into Profile, Security, Notifications, Appearance, Privacy, and Organization Settings sections.
- [ ] T007 [US1] [Plan:2.2] Add explicit self-profile read/update endpoints and reject employment-controlled field tampering in `backend/controllers/userController.js`.
- [ ] T008 [US1] [Plan:2.2] Add frontend service methods and validation for profile updates in `frontend/src/services/userService.js`.
- [ ] T009 [US2] [Plan:2.3] Add session listing/revoke/logout-all endpoints under `backend/routes` and `backend/controllers`.
- [ ] T010 [US2] [Plan:2.3] Update authentication token/session handling so password changes and revocation invalidate prior sessions.
- [ ] T011 [US2] [Plan:2.3] Add active-session UI and confirmation flows in `frontend/src/pages/Settings.jsx`.
- [ ] T012 [US2] [Plan:2.4] Add MFA setup, verify, disable, and recovery-code endpoints behind a security service boundary.
- [ ] T013 [US2] [Plan:2.4] Add MFA setup and recovery UI with re-authentication requirements.

### Phase 3

- [ ] T014 [US3] [Plan:3.1] Add server-side notification preference endpoints with ownership enforcement.
- [ ] T015 [US3] [Plan:3.1] Replace local-only notification toggles with persisted preference loading and saving.
- [ ] T016 [US3] [Plan:3.2] Add server-side appearance/regional preference endpoints and apply them during session initialization.
- [ ] T017 [US4] [Plan:3.3] Add privacy summary, export request, request-status, and deactivation/deletion request endpoints.
- [ ] T018 [US4] [Plan:3.3] Add privacy/data controls UI and safe export download flow.

### Phase 4

- [ ] T019 [Plan:4.1] Separate personal settings API routes from admin organization settings and enforce `admin` authorization for global configuration.
- [ ] T020 [Plan:4.2] Add one-time migration from existing local preference keys without overwriting server values.
- [ ] T021 [P] [Plan:4.3] Add backend authorization tests for profile ownership, forbidden fields, sessions, MFA, preferences, and admin settings.
- [ ] T022 [P] [Plan:4.3] Add frontend tests for settings navigation, validation, loading/error states, and role-aware visibility.
- [ ] T023 [Plan:4.4] Update [README.md](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/README.md) and [explanation.md](C:/Users/bonur/OneDrive/Documents/prasad_projects/project-EMS/explanation.md) with the account-settings operating model.

## Project Structure

```text
backend/
  models/
    UserSession.js
    UserNotificationPreferences.js
    UserAppearancePreferences.js
    PrivacyRequest.js
  services/
    accountSecurityService.js
    userPreferencesService.js
    privacyService.js
    dataExportService.js
  controllers/
    accountSecurityController.js
    userPreferencesController.js
    privacyController.js
  routes/
    accountSecurityRoutes.js
    userPreferencesRoutes.js
    privacyRoutes.js
frontend/src/
  pages/Settings.jsx
  services/accountSecurityService.js
  services/userPreferencesService.js
  services/privacyService.js
```

## Testing Strategy

- **appType**: mixed REST API and React SPA.
- **Critical user journeys**:
  1. User edits permitted profile data and sees forbidden fields remain unchanged.
  2. User changes password and the previous session is rejected.
  3. User revokes one session and logs out all other sessions.
  4. User configures notifications on one device and sees them on another.
  5. User requests an export and receives no secrets or internal security data.
  6. Non-admin cannot read or change organization settings.
- **Primary validation**: Jest/Supertest backend tests plus frontend production build and focused UI tests.
- **Test data strategy**: isolated users and sessions per test; use deterministic fake timestamps; clean created records after each suite.
- **Acceptance criteria**: every critical journey passes for employee, manager, HR, and admin role boundaries; unauthorized cross-user requests return stable `403` responses.
- **Known gap**: actual MFA provider and email/push delivery need integration tests once infrastructure is selected.

## Assumptions and Decisions for Review

1. TOTP MFA is the initial local-authentication choice; SSO/OIDC may supersede it for enterprise deployments.
2. Security alerts remain mandatory and cannot be disabled.
3. Account deletion is a request workflow, not immediate physical deletion.
4. Employment-controlled fields remain HR/admin-owned.
5. The current `/api/settings` endpoint remains the organization-settings endpoint.
6. Session records should store hashes or opaque identifiers, never reusable raw tokens.

## Requirement Mapping

| REQ ID | Description | Plan Items | Implementation Evidence |
|---|---|---|---|
| REQ-001 | Own profile editing | P1.1, P2.2 | user profile controller/routes |
| REQ-002 | Read-only employment information | P2.1, P2.2 | Settings UI and profile response |
| REQ-003 | Contact and regional profile fields | P1.2, P2.2, P3.2 | User/preferences models and APIs |
| REQ-004 | Validation and safe audit events | P1.1, P1.3, P4.3 | audit service and tests |
| REQ-005 | Secure password change | P2.4 | account security service/controller |
| REQ-006 | Consistent password policy | P1.1, P2.4 | shared validation |
| REQ-007 | Prior-session invalidation | P1.2, P2.3 | UserSession and auth middleware |
| REQ-008 | MFA lifecycle | P2.4 | MFA endpoints/UI |
| REQ-009 | Session/device control | P1.2, P2.3 | session endpoints/UI |
| REQ-010 | Security notifications/audit | P1.3, P2.3, P2.4 | audit and notification services |
| REQ-011 | Cross-device preferences | P1.2, P3.1 | preference model/API |
| REQ-012 | Channel/category preferences | P3.1 | notification preference UI/API |
| REQ-013 | Mandatory security alerts | P1.1, P3.1 | preference validation |
| REQ-014 | Accessibility/regional settings | P1.2, P3.2 | appearance model/UI |
| REQ-015 | Personal data export | P3.3 | privacy/export service |
| REQ-016 | Retention-aware deletion request | P1.2, P3.3 | PrivacyRequest workflow |
| REQ-017 | Privacy request status | P3.3 | privacy UI/API |
| REQ-018 | Isolated organization settings | P2.1, P4.1 | settings routes/UI |
| REQ-019 | HR/admin employment control | P2.2, P4.1 | authorization rules |
| REQ-020 | Server-side authorization | P1.3, P2.2, P2.3, P3.1, P4.1 | middleware/controllers |
| REQ-021 | Authorization-boundary tests | P4.3 | backend/frontend tests |
