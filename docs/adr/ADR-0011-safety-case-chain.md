# ADR-0011 — Safety Case Chain

Status: ACCEPTED FOR ARCHITECTURE / NOT A RELEASE CERTIFICATION

Decision:
Every clinically consequential capability must be traceable through:
Authority → Hazard → Control → Invariant → Implementation → Test → Execution Evidence → Release Gate.

Consequences:
- A passing test without authority is insufficient.
- An invariant without a test is insufficient.
- A hazard without a control blocks affected release scope.
- Missing execution evidence remains BLOCKED.
- No document freeze implies production safety certification.
