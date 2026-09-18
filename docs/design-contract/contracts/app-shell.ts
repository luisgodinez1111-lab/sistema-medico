export type Priority="P0"|"P1"|"P2"|"P3"|"P4"|"P5"|"P6"|"P7"|"P8";
export const appShellContract = {
 desktop:{nav:[72,240],contextRail:[320,360,400],workspace:"fluid"},
 tablet:{navigation:"compact",contextRail:"governed-drawer",workspace:"full-available"},
 mobile:{mode:"information-architecture-transform",persistent:["patient","critical-state","current-task","primary-action"]},
 laws:["P0_P1_P2_NOT_HIDDEN","PATIENT_VISIBLE_FOR_C5","NO_DESKTOP_SQUEEZE"]
} as const;
