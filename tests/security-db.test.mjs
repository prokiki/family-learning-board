import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;`);
for (const f of readdirSync('supabase/migrations').sort()) {
  let sql = readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;','');
  sql=sql.replace(/do \$\$\s*begin\s*alter publication[\s\S]*?\$\$;/g,'');
  await db.exec(sql);
}
const migration=readFileSync('docs/security/security-migration.sql','utf8');
const contained=process.env.TEST_CONTAINED==='1';
if (contained) {
  // Mirror the broad production grants, without touching production or its data.
  await db.exec(`grant all on tasks,task_templates,task_attachments,ai_config to anon,authenticated;
    insert into tasks(board_id,due_date,title) values('legacy-fixture','2026-11-04','preserved synthetic task');
    insert into storage.objects(bucket_id,name) values('teacher-attachments','legacy-fixture/preserved.png');`);
  await db.exec(readFileSync('docs/security/production-containment.sql','utf8'));
  // An unreviewed policy must abort atomically, preserving the containment.
  await db.exec('create policy unexpected_policy on tasks for select using(true)');
  await assert.rejects(db.exec(migration), /Unexpected policies/);
  await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('public.board_members') as t")).rows[0].t,null);
  await db.exec('drop policy unexpected_policy on tasks');
  // A familiar name with altered semantics is not an approved guard.
  await db.exec('alter policy security_review_deny_clients on tasks using(true)');
  await assert.rejects(db.exec(migration), /Incomplete or altered containment/);
  await db.exec('rollback');
  await db.exec('alter policy security_review_deny_clients on tasks using(false)');
  // A later failure also rolls back old-policy removal, grants and new objects.
  await assert.rejects(db.exec(migration.replace('create schema if not exists private;', () => "do $$ begin raise exception 'injected late failure'; end $$; create schema if not exists private;")), /injected late failure/);
  await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='security_review_deny_clients'")).rows[0].n,4);
  assert.equal((await db.query("select to_regclass('public.board_members') as t")).rows[0].t,null);
  await db.exec('set role anon');
  assert.equal((await db.query('select * from tasks')).rows.length,0);
  await db.exec('reset role');
}
await db.exec(migration);
if (contained) {
  assert.equal((await db.query("select title from tasks where board_id='legacy-fixture'")).rows[0].title,'preserved synthetic task');
  assert.equal((await db.query("select count(*)::int n from storage.objects where name='legacy-fixture/preserved.png'")).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int n from pg_policies where policyname in ('security_review_deny_clients','security_review_deny_teacher_bucket')")).rows[0].n,0);
}
const parent='00000000-0000-0000-0000-000000000001', child='00000000-0000-0000-0000-000000000002', outsider='00000000-0000-0000-0000-000000000003';
await db.exec(`insert into auth.users values('${parent}'),('${child}'),('${outsider}'); insert into board_members values('family-a','${parent}','parent'),('family-a','${child}','child'),('family-b','${outsider}','parent');`);
async function as(uid, role='authenticated') { await db.exec(`reset role; set role ${role}; set request.jwt.claim.sub='${uid}';`); }
async function denied(sql) { await assert.rejects(db.exec(sql)); }
await as('', 'anon'); await denied('select * from tasks'); await denied('select * from ai_config');
await as(parent);
await denied('truncate tasks');
await db.exec(`insert into tasks(board_id,due_date,title) values('family-a','2026-11-04','fixture'); insert into task_attachments(board_id,due_date,storage_path,public_url,role,visible_to_child) values ('family-a','2026-11-04','family-a/private.png','','parent_only',false),('family-a','2026-11-04','family-a/shared.png','','reference',true); insert into storage.objects(bucket_id,name) values('teacher-attachments','family-a/private.png'),('teacher-attachments','family-a/shared.png');`);
await denied(`insert into board_members values('family-b','${child}','parent')`);
await as(child);
assert.equal((await db.query('select * from tasks')).rows.length,1);
assert.equal((await db.query('select * from task_attachments')).rows.length,1);
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await denied('select * from ai_config');
await denied(`update tasks set title='changed'`);
await denied(`update tasks set board_id='family-b'`);
await denied(`update tasks set status='confirmed_by_parent'`);
await db.exec(`update tasks set status='done_by_child',last_updated_by='child'`);
await db.exec(`insert into tasks(board_id,due_date,title,category,source,status,last_updated_by) values('family-a','2026-11-04','extra','extra','manual','pending','child')`);
await denied(`insert into tasks(board_id,due_date,title) values('family-a','2026-11-04','school')`);
assert.equal((await db.query('delete from tasks returning id')).rows.length,0);
await denied(`insert into storage.objects(bucket_id,name) values('teacher-attachments','family-a/evil.png')`);
await as(outsider);
assert.equal((await db.query('select * from tasks')).rows.length,0);
assert.equal((await db.query('select * from task_attachments')).rows.length,0);
assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await denied(`insert into tasks(board_id,due_date,title) values('family-a','2026-11-04','cross-board')`);
await as(parent); await db.exec(`update tasks set status='confirmed_by_parent'`);
await as(child); assert.equal((await db.query(`update tasks set status='pending' returning id`)).rows.length,0);
for(let i=0;i<6;i++) assert.equal((await db.query('select consume_ai_quota() as allowed')).rows[0].allowed,true);
assert.equal((await db.query('select consume_ai_quota() as allowed')).rows[0].allowed,false);
await denied('select * from private.ai_quota');
await as('', 'anon'); await denied('select consume_ai_quota()');
await db.exec('reset role');
assert.equal((await db.query("select public from storage.buckets where id='teacher-attachments'")).rows[0].public,false);
await db.close();
console.log(`PASS (${contained ? 'contained upgrade + rollback' : 'original baseline'}): anonymous, cross-board, child field/status restrictions, parent-only attachments, storage writes, quota and private bucket`);
