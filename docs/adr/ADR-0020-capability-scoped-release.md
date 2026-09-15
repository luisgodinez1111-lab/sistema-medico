# ADR-0020 — Capability-Scoped Release Admission
Status: ACCEPTED

Medical OS evaluates release eligibility per clinical capability, not only as a global binary.
A capability cannot be PASS unless authority, hazard case, controls, invariants, test-source integrity,
execution evidence, and S0/S1 defect state are satisfactory.
A blocked capability must remain unavailable or fail closed in affected release scope.
