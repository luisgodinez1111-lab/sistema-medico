import{describe,it,expect}from"vitest";
import{foldEncounter,assertTransition}from"../../packages/encounter-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const opened={sequence:1,payload:{kind:"OPENED",patientId:"p-1"}};
const assessed={sequence:2,payload:{kind:"ASSESSED",assessment:"a",plan:"pl"}};
const signed={sequence:3,payload:{kind:"SIGNED",authorId:"u-1"}};

describe("encounter fold (EPIC D)",()=>{
 it("empty stream -> not exists",()=>{expect(foldEncounter([]).exists).toBe(false);});
 it("opened -> OPEN v1 with patient",()=>{const f=foldEncounter([opened]);expect(f.status).toBe("OPEN");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");});
 it("opened+assessed -> READY_TO_SIGN v2 with content",()=>{const f=foldEncounter([opened,assessed]);expect(f.status).toBe("READY_TO_SIGN");expect(f.version).toBe(2);expect(f.assessment).toBe("a");expect(f.plan).toBe("pl");});
 it("opened+assessed+signed -> SIGNED v3",()=>{const f=foldEncounter([opened,assessed,signed]);expect(f.status).toBe("SIGNED");expect(f.version).toBe(3);});
 it("unordered input is folded by sequence",()=>{const f=foldEncounter([signed,opened,assessed]);expect(f.status).toBe("SIGNED");expect(f.version).toBe(3);});
 it("compat: first event without kind is treated as OPENED",()=>{const f=foldEncounter([{sequence:1,payload:{patientId:"p-2"}}]);expect(f.status).toBe("OPEN");expect(f.patientId).toBe("p-2");});
});

describe("encounter transition guard (formal SM)",()=>{
 it("allows OPEN -> READY_TO_SIGN",()=>{expect(()=>assertTransition("OPEN","READY_TO_SIGN")).not.toThrow();});
 it("allows READY_TO_SIGN -> SIGNED",()=>{expect(()=>assertTransition("READY_TO_SIGN","SIGNED")).not.toThrow();});
 it("blocks illegal OPEN -> SIGNED",()=>{
  const err=(()=>{try{assertTransition("OPEN","SIGNED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);
  expect((err as ClinicalError).code).toBe("CONFLICT");
 });
 it("blocks mutation of a SIGNED encounter",()=>{expect(()=>assertTransition("SIGNED","READY_TO_SIGN")).toThrow();});
});
