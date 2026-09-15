export type Sample=Readonly<{at:number;ok:boolean}>;export function windowSlo(xs:readonly Sample[],now:number,windowMs:number){const w=xs.filter(x=>x.at>=now-windowMs&&x.at<=now);return{count:w.length,availability:w.length?w.filter(x=>x.ok).length/w.length:0};}
export function burnRate(actual:number,target:number){if(target>=1)return Infinity;return(1-actual)/(1-target);}
