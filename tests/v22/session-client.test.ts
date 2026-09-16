import{describe,it,expect}from"vitest";
import{parseSessionResponse,exchangeForSession,storeSession,getStoredSession,clearStoredSession,authHeader}from"../../apps/web/lib/session-client";

function fakeStore():Storage{const m=new Map<string,string>();return{get length(){return m.size;},clear:()=>m.clear(),getItem:k=>m.get(k)??null,key:i=>[...m.keys()][i]??null,removeItem:k=>{m.delete(k);},setItem:(k,v)=>{m.set(k,v);}};}
const future=Math.floor(Date.now()/1000)+900;
const sample={token:"jwt.abc.def",sessionId:"sess-1",expiresAt:future,tokenType:"Bearer"};
function fetchOk(body:unknown):typeof fetch{return(async()=>({ok:true,status:201,json:async()=>body})) as unknown as typeof fetch;}
function fetchErr(status:number,code:string):typeof fetch{return(async()=>({ok:false,status,json:async()=>({error:{code}})})) as unknown as typeof fetch;}

describe("session-client bridge (EPIC J)",()=>{
 it("parses a valid session response",()=>{
  const s=parseSessionResponse(sample);expect(s.token).toBe("jwt.abc.def");expect(s.tokenType).toBe("Bearer");
 });
 it("rejects an invalid session response",()=>{
  expect(()=>parseSessionResponse({token:1})).toThrow(/INVALID_SESSION_RESPONSE/);
  expect(()=>parseSessionResponse(null)).toThrow(/INVALID_SESSION_RESPONSE/);
 });
 it("exchanges an IdP token for a medical-os session",async()=>{
  const s=await exchangeForSession("idp-token",fetchOk(sample));expect(s.sessionId).toBe("sess-1");
 });
 it("surfaces the error code when the exchange is rejected",async()=>{
  await expect(exchangeForSession("bad",fetchErr(401,"UNAUTHENTICATED"))).rejects.toThrow(/401:UNAUTHENTICATED/);
 });
 it("stores, reads and clears the session (per-tab)",()=>{
  const store=fakeStore();
  storeSession(sample,store);
  expect(getStoredSession(store)?.sessionId).toBe("sess-1");
  clearStoredSession(store);
  expect(getStoredSession(store)).toBeNull();
 });
 it("treats an expired stored session as absent",()=>{
  const store=fakeStore();
  storeSession({...sample,expiresAt:Math.floor(Date.now()/1000)-10},store);
  expect(getStoredSession(store)).toBeNull();
 });
 it("builds an Authorization header from a session",()=>{
  expect(authHeader(sample).authorization).toBe("Bearer jwt.abc.def");
  expect(authHeader(null)).toEqual({});
 });
});
