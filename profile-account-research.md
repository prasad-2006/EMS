# Profile and Account Plan Research

## Resolved Unknowns

### Decision: Keep organization settings separate from personal settings

**Rationale:** The existing `/api/settings` endpoint stores global deduction configuration and is admin-only for writes. Mixing this with personal settings would create a privacy and authorization boundary problem.

**Alternatives considered:** Expand the global settings document with per-user preferences; rejected because it creates unbounded user data in a global document and complicates ownership enforcement.

### Decision: Use separate settings models instead of expanding User indefinitely

**Rationale:** Security sessions, notification preferences, appearance preferences, and privacy requests have different lifecycle, retention, and indexing needs. Separate models also reduce accidental exposure from broad User serialization.

**Alternatives considered:** Add every setting to `User`; rejected because it increases coupling and makes sensitive security data easier to return accidentally.

### Decision: TOTP as the initial MFA implementation

**Rationale:** It supports local authentication without requiring a third-party provider and can later be placed behind an OIDC/SSO boundary. Recovery codes provide an operational recovery path.

**Alternatives considered:** SMS-only MFA; rejected as weaker and dependent on delivery infrastructure. Full SSO first; deferred because the current application already supports local JWT authentication and SSO requires an organization identity-provider decision.

### Decision: Privacy deletion is request-based

**Rationale:** HR records, approvals, audit events, payroll-related data, and project history may have retention obligations. Immediate deletion would risk compliance and workflow integrity.

**Alternatives considered:** Immediate hard delete; rejected.
