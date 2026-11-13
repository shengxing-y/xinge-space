'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const cards=require('./src/entry-presentation.js');
const rows=[{id:'recent',category:'life',day:'2026-11-13'},{id:'pin',category:'work',pinned:true,day:'2026-01-01'},{id:'private',category:'diary',pinned:true,featured:true},{id:'chosen',category:'art',featured:true},{id:'both',category:'music',pinned:true,featured:true}];
test('homepage pins are stable and never apply to diary',()=>{
 assert.deepEqual(cards.ordered(rows,true).map(e=>e.id),['pin','both','recent','private','chosen']);
 assert.deepEqual(cards.ordered(rows,false),rows);
});
test('selections are explicit public records, absent flags default false',()=>{
 assert.deepEqual(cards.selections(rows).map(e=>e.id),['chosen','both']);
 assert.deepEqual(cards.selections([{category:'life',featured:'true'}]),[]);
});
test('card markup is escaped, legal and retains independent playback',()=>{
 const html=cards.card({id:'x',category:'music',title:'<script>',body:'正文',audio:'audio/x.mp3',pinned:true,featured:true},{music:'音乐'});
 assert.ok(html.startsWith('<article'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('置顶')&&html.includes('精选'));
 assert.equal((html.match(/<button/g)||[]).length,2);assert.ok(!html.includes('<button class="entry'));
 assert.ok(!cards.card({category:'diary',pinned:true,featured:true},{}).includes('entry-badge'));
});
