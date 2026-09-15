export type Step="CLAIM"|"WRITE"|"COMMIT"|"PUBLISH"|"ACK"|"CRASH"|"RETRY";
export function interleave(a:readonly Step[],b:readonly Step[]){const out:Step[][]=[];function go(i:number,j:number,p:Step[]){if(i===a.length&&j===b.length){out.push(p);return}if(i<a.length)go(i+1,j,[...p,a[i]]);if(j<b.length)go(i,j+1,[...p,b[j]])}go(0,0,[]);return out}
