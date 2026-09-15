export interface ClinicalClock{now():Date}
export const systemClinicalClock:ClinicalClock={now:()=>new Date()};
export class FixedClinicalClock implements ClinicalClock{constructor(private readonly at:Date){}now(){return new Date(this.at)}}
