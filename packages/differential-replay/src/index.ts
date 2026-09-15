import{canonicalize}from"../../canonical-json/src";import crypto from"node:crypto";
export const fp=(x:unknown)=>crypto.createHash("sha256").update(canonicalize(x)).digest("hex");
export function differentialReplay(live:unknown,replayed:unknown){const liveHash=fp(live),replayHash=fp(replayed);return{match:liveHash===replayHash,liveHash,replayHash}}
