export type Probe=Readonly<{sessionTenant?:string;rowTenant:string;role:"runtime"|"worker"|"migrator";bypassRls:boolean;operation:"SELECT"|"INSERT"|"UPDATE"|"DELETE"}>;
export function expectedRls(x:Probe){if(x.role!=="migrator"&&x.bypassRls)return"DATABASE_ROLE_DEFECT";if(!x.sessionTenant)return"DENY";if(x.role==="migrator")return"ADMIN_PATH";return x.sessionTenant===x.rowTenant?"ALLOW":"DENY"}
