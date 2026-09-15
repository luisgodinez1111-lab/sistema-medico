export type RoleProof=Readonly<{role:string;rolsuper:boolean;rolbypassrls:boolean;canLogin:boolean}>;
export function roleViolations(xs:readonly RoleProof[]){const e:string[]=[];for(const x of xs){if(["medical_os_runtime","medical_os_worker","medical_os_readonly"].includes(x.role)&&(x.rolsuper||x.rolbypassrls))e.push(`RLS_BYPASS:${x.role}`)}return e}
