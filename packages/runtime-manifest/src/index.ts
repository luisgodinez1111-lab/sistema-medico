export type RuntimeManifest=Readonly<{releaseId:string;commit:string;node:string;databaseSchema:string;capabilityCatalogHash:string;testManifestHash:string}>;
export function validateManifest(x:RuntimeManifest){for(const[k,v]of Object.entries(x))if(!v)throw new Error(`RUNTIME_MANIFEST_MISSING:${k}`);return true;}
