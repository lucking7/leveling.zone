const {test}=require('node:test');
const assert=require('node:assert/strict');
const {queryVisitor}=require('../src/modules/query/visitor.ts');
const {GET}=require('../src/app/api/myip/route.ts');
const result={ip:'ignored',status:'partial',generation:'test',timestamp:'2026-09-12',sources:{maxmind:{label:'MaxMind',location:{latitude:0,longitude:0},network:{asn:'AS123'}}},errors:{dbip:'Database unavailable or query failed'}};
test('visitor query uses exact request address for every row and disables external calls',async()=>{
 for(const ip of ['203.0.113.8','2001:db8::8']){
 let observed;
 const r=await queryVisitor(new Headers({'x-real-ip':ip} ),async(address,options)=>{observed={address,options};return result;});
 assert.deepEqual(observed,{address:ip,options:{external:false}});
 assert.equal(r.status,200);assert.equal(r.body.ip,ip);assert.equal(r.body.sources.maxmind.ip,ip);
 assert.equal(r.body.observation.semantics,'request-ip');assert.equal(r.body.observation.serverEgressSourceCount,0);
 assert.equal(r.body.sources.maxmind.observation.scope,'request-ip');assert.equal(r.body.sources.maxmind.location.latitude,0);
 assert.deepEqual(r.body.observation.failures,[{source:'dbip',reason:'lookup-failed'}]);
 }
});
test('unidentified visitor does not fall back to server IP or invoke databases',async()=>{
 const r=await queryVisitor(new Headers(),()=>{throw Error('must not run');});assert.equal(r.status,400);
 const response=await GET({headers:new Headers()});assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('visitor query preserves valid IP and provenance on empty database result',async()=>{
 const r=await queryVisitor(new Headers({'x-real-ip':'203.0.113.8'}),async()=>({...result,sources:{}}));assert.equal(r.status,503);assert.equal(r.body.ip,'203.0.113.8');assert.equal(r.body.ipSource,'x-real-ip');assert.deepEqual(r.body.sources,{});
});
test('visitor distinguishes a missing database from a lookup failure',async()=>{
 const {queryIP}=require('../src/modules/query/index.ts');
 const r=await queryVisitor(new Headers({'x-real-ip':'8.8.8.8'}),async(ip,options)=>queryIP(ip,{...options,databases:async()=>({records:{},generation:'test',errors:{ipinfo:'Database not installed',broken:'/private/path read failed'}})}));
 assert.deepEqual(r.body.observation.failures,[{source:'ipinfo',reason:'not-installed'},{source:'broken',reason:'lookup-failed'}]);
 assert.ok(!JSON.stringify(r.body).includes('/private/path'));
});
