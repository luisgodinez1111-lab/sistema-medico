
export type ApplicabilityContext = Readonly<{
  ageYears?:number;
  ageDays?:number;
  pregnancy?:boolean;
  renalFunctionKnown?:boolean;
  unitSystem?:string;
}>;

export type ApplicabilityRule = Readonly<{
  id:string;
  minAgeYears?:number;
  maxAgeYears?:number;
  requiresRenalFunction?:boolean;
  supportedUnitSystems?:readonly string[];
}>;

export function assertClinicalApplicability(rule:ApplicabilityRule, ctx:ApplicabilityContext){
  if(rule.minAgeYears!==undefined && (ctx.ageYears===undefined || ctx.ageYears<rule.minAgeYears))
    throw new Error(`APPLICABILITY_BLOCKED:${rule.id}:MIN_AGE`);
  if(rule.maxAgeYears!==undefined && (ctx.ageYears===undefined || ctx.ageYears>rule.maxAgeYears))
    throw new Error(`APPLICABILITY_BLOCKED:${rule.id}:MAX_AGE`);
  if(rule.requiresRenalFunction && ctx.renalFunctionKnown!==true)
    throw new Error(`APPLICABILITY_BLOCKED:${rule.id}:RENAL_FUNCTION_UNKNOWN`);
  if(rule.supportedUnitSystems && (!ctx.unitSystem || !rule.supportedUnitSystems.includes(ctx.unitSystem)))
    throw new Error(`APPLICABILITY_BLOCKED:${rule.id}:UNSUPPORTED_UNIT_SYSTEM`);
  return true;
}
