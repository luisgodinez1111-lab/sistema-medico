export const stressContent = {
 patientName:{normal:40,stress:120},
 problemCount:{normal:8,stress:30},
 activeMedicationCount:{normal:12,stress:30},
 allergyCount:{normal:4,stress:12},
 obligationCount:{normal:6,stress:25},
 timelineEvents:{normal:100,stress:10000},
 resultRows:{normal:100,stress:10000},
 laws:["TRUNCATION_HAS_ACCESSIBLE_FULL_VALUE","VIRTUALIZATION_CANNOT_HIDE_CRITICAL_COUNT","LONG_TEXT_CANNOT_DISPLACE_P0_P1_P2"]
} as const;
