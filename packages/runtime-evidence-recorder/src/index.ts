import crypto from"node:crypto";
export type CommandEvidence=Readonly<{command:string;exitCode:number;stdout:string;stderr:string;environment:string}>;
export function recordEvidence(x:CommandEvidence){return{command:x.command,exitCode:x.exitCode,environment:x.environment,stdoutHash:crypto.createHash("sha256").update(x.stdout).digest("hex"),stderrHash:crypto.createHash("sha256").update(x.stderr).digest("hex"),state:x.exitCode===0?"EXECUTED_PASS":"EXECUTED_FAIL"}}
