import{describe,it,expect}from"vitest";
import{readerFor,SESSION_COOKIE}from"../../apps/web/lib/http-command";

function req(headers:Record<string,string>){return new Request("http://l/api",{headers});}

describe("session cookie fallback (EPIC L hardening)",()=>{
 it("resuelve authorization desde la cookie httpOnly cuando no hay header",()=>{
  const r=readerFor(req({cookie:`${SESSION_COOKIE}=tok-123`}));
  expect(r("authorization")).toBe("Bearer tok-123");
 });
 it("el header Authorization tiene prioridad sobre la cookie",()=>{
  const r=readerFor(req({authorization:"Bearer from-header",cookie:`${SESSION_COOKIE}=from-cookie`}));
  expect(r("authorization")).toBe("Bearer from-header");
 });
 it("sin header ni cookie -> null",()=>{
  expect(readerFor(req({}))("authorization")).toBeNull();
 });
 it("ignora otras cookies y pasa otros headers tal cual",()=>{
  const r=readerFor(req({cookie:`other=x; ${SESSION_COOKIE}=tok-9; foo=bar`,"x-request-id":"rid-1"}));
  expect(r("authorization")).toBe("Bearer tok-9");
  expect(r("x-request-id")).toBe("rid-1");
 });
});
