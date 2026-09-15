import {describe,it,expect} from "vitest";
import fs from "node:fs";
import {AiTaskCard} from "../../packages/ai-gateway/src/task-card";
const tasks=JSON.parse(fs.readFileSync("ai-tasks/catalog.json","utf8"));
describe("AI Task Card authority",()=>{
 it("all task cards satisfy governed schema",()=>{for(const t of tasks) expect(AiTaskCard.safeParse(t).success,t.id).toBe(true)});
 it("all C4/C5 tasks require kill switch",()=>{for(const t of tasks.filter((x:any)=>["C4","C5"].includes(x.risk))) expect(t.killSwitch).toBe(true)});
 it("all tasks have explicit ENG authority",()=>{for(const t of tasks) expect(t.authority.length).toBeGreaterThan(0)});
});
