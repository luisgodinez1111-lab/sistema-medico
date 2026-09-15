# ADR-0110 — Golden Vertical Slice Before Horizontal Expansion
Status: ACCEPTED

v11 deliberately concentrates engineering effort on one coherent clinical path:
patient → encounter → assessment/plan → medication/order/result → obligation → inbox/timeline → signing/audit.
New capability volume is subordinate to proving atomicity, ownership, provenance, recovery and authority across this path.
HTTP clinical routes remain fail-closed until a verified identity/session adapter is connected.
