import{describe,it,expect}from"vitest";
import{validateCurp,curpCheckDigit,normalizeName,isMinor,ageYearsAt}from"../../packages/mx-identity/src";
// Auditoría 2026-09-19 (L-06): la CURP se valida de verdad (formato, dígito verificador, coherencia con nacimiento y sexo).
describe("CURP (L-06)",()=>{
 it("acepta la CURP de ejemplo de la documentación oficial y calcula su dígito verificador",()=>{
  expect(curpCheckDigit("HEGG560427MVZRRL0")).toBe(4);
  expect(validateCurp(" hegg560427mvzrrl04 ")).toEqual({ok:true,curp:"HEGG560427MVZRRL04",birthDate:"1956-04-27",sex:"FEMALE",state:"VZ"});
 });
 it("rechaza formato, dígito verificador y fechas inexistentes",()=>{
  expect(validateCurp("HEGG560427MVZRRL0")).toEqual({ok:false,issue:"FORMAT"});
  expect(validateCurp("HEGG560427MVZRRL05")).toEqual({ok:false,issue:"CHECK_DIGIT"});
  const bad="HEGG560230MVZRRL0";expect(validateCurp(bad+curpCheckDigit(bad))).toEqual({ok:false,issue:"INVALID_DATE"}); // 30 de febrero
 });
 it("coherencia con la fecha de nacimiento y el sexo declarados; siglo por el diferenciador de homonimia",()=>{
  expect(validateCurp("HEGG560427MVZRRL04",{birthDate:"1956-04-27",sexAtBirth:"FEMALE"}).ok).toBe(true);
  expect(validateCurp("HEGG560427MVZRRL04",{birthDate:"1956-04-28"})).toEqual({ok:false,issue:"BIRTHDATE_MISMATCH"});
  expect(validateCurp("HEGG560427MVZRRL04",{sexAtBirth:"MALE"})).toEqual({ok:false,issue:"SEX_MISMATCH"});
  const y2k="LOPJ050315HDFPRNA";const v=validateCurp(y2k+curpCheckDigit(y2k));expect(v.ok&&v.birthDate).toBe("2005-03-15"); // homoclave alfabética => 2005
 });
 it("nombre normalizado para duplicados: acentos fuera, ñ se conserva, espacios colapsados",()=>{
  expect(normalizeName("  José  Ñúñez PÉREZ ")).toBe("jose ñuñez perez");
 });
 it("menor de edad por edad cumplida",()=>{
  expect(ageYearsAt("2008-09-23","2026-09-22T12:00:00Z")).toBe(17);expect(isMinor("2008-09-23","2026-09-22T12:00:00Z")).toBe(true);
  expect(isMinor("2008-09-22","2026-09-22T12:00:00Z")).toBe(false);expect(isMinor("x","2026-09-22T12:00:00Z")).toBeUndefined();
 });
});
