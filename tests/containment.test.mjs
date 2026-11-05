import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema storage; create table storage.buckets(id text primary key,public boolean); create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant all on storage.objects to anon,authenticated; create policy old_open_storage on storage.objects for all using(true) with check(true); insert into storage.buckets values('teacher-attachments',true),('unrelated',true); insert into storage.objects values('teacher-attachments','fixture'),('unrelated','other');`);
for(const t of ['tasks','task_templates','task_attachments','ai_config']) await db.exec(`create table public.${t}(id int); alter table public.${t} enable row level security; grant all on public.${t} to anon,authenticated; create policy old_open on public.${t} for all using(true) with check(true); insert into public.${t} values(1);`);
await db.exec(readFileSync('docs/security/production-containment.sql','utf8'));
for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  for(const t of ['tasks','task_templates','task_attachments','ai_config']) {
    assert.equal((await db.query(`select * from ${t}`)).rows.length,0);
    await assert.rejects(db.exec(`insert into ${t} values(2)`));
    assert.equal((await db.query(`update ${t} set id=3 returning id`)).rows.length,0);
    assert.equal((await db.query(`delete from ${t} returning id`)).rows.length,0);
  }
  assert.deepEqual((await db.query('select bucket_id from storage.objects')).rows,[{bucket_id:'unrelated'}]);
  await assert.rejects(db.exec(`insert into storage.objects values('teacher-attachments','new')`));
  await db.exec('reset role');
}
assert.equal((await db.query("select public from storage.buckets where id='teacher-attachments'")).rows[0].public,false);
assert.equal((await db.query('select count(*)::int as n from tasks')).rows[0].n,1);
await db.close(); console.log('PASS: temporary containment overrides existing permissive policies, preserves rows, leaves other bucket unaffected');
