import assert from 'node:assert/strict';
import { secureRoute } from '../src/lib/api-security';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-public-key';
const memberRole='child', memberBoard='a'; let authorized=true, quota=true; let quotaCalls=0, handlerCalls=0;
globalThis.fetch=async (input) => {
  const url=String(input);
  if(url.includes('/auth/v1/user')) return Response.json(authorized ? {id:'fixture-user',is_anonymous:false} : {message:'invalid'}, {status:authorized?200:401});
  if(url.includes('/rest/v1/board_members')) return Response.json([{board_id:memberBoard,role:memberRole}]);
  if(url.includes('/rpc/consume_ai_quota')) {quotaCalls++;return Response.json(quota);}
  throw new Error('Unexpected network request: '+url);
};
const handler=async (r:Request)=>{handlerCalls++;return Response.json(await r.json());};
const guarded=secureRoute(handler);
function request(token=true, body='{"board":"a"}') {return new Request('https://app.invalid/api/test',{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer fixture-token'}:{})},body});}
assert.equal((await guarded(request(false))).status,401);
authorized=false;assert.equal((await guarded(request())).status,401);authorized=true;
assert.equal((await secureRoute(handler,true)(request())).status,403);
assert.equal((await guarded(request(true,'{"board":{}}'))).status,400);
assert.equal((await guarded(request(true,'[]'))).status,400);
assert.equal((await guarded(request(true,'{"board":"other"}'))).status,403);
assert.equal((await secureRoute(handler,false,true,5)(request())).status,413);
quota=false;assert.equal((await guarded(request())).status,429);quota=true;
const result=await guarded(request());assert.equal(result.status,200);assert.match(result.headers.get('cache-control')!,/no-store/);assert.equal((await result.json()).board,'a');
assert.equal(handlerCalls,1); assert.equal(quotaCalls,2);
console.log('PASS: missing/invalid identity, role denial, bad payloads, streaming body limit, quota, no-store, authorized handler');

for (const name of ['daily-plan','daily-summary','ocr-homework','parse-homework','task-help','weekly-review','writing-feedback','writing-help','writing-images','writing-mindmap','writing-sample']) {
  const route = await import('../src/app/api/'+name+'/route.ts');
  assert.equal((await route.POST(request(false))).status,401, name);
}
console.log('PASS: all eleven AI route exports reject unauthenticated requests');
