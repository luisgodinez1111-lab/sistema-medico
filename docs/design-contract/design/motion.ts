export const motion = {
  duration:{instant:0,fast:120,normal:180,slow:240},
  reducedMotionRule:"All semantic state changes remain perceivable with motion disabled.",
  forbidden:["critical-pulse-loop","decorative-shake-on-clinical-error","motion-only-state-change"]
} as const;
