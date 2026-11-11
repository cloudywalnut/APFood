const {test,beforeEach}=require('node:test');const assert=require('node:assert/strict');
const {sampleLayout}=require('../.test-build/lib/cafeteria/layout');
const {select,requestResource}=require('../.test-build/lib/cafeteria/selection');
const {seedDemo,cartDetails,available,slots,addonPrice}=require('../.test-build/lib/demo');
const {createCafeteriaServices}=require('../.test-build/services/cafeteria');
const store=require('../.test-build/lib/demo-store');
const {offerPrice}=require('../.test-build/lib/promotions');
const memory=new Map();global.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};global.window=new EventTarget();global.sessionStorage={getItem:k=>memory.get("session:"+k)??null,setItem:(k,v)=>memory.set("session:"+k,v),removeItem:k=>memory.delete("session:"+k)};
beforeEach(()=>store.clearDemo());
test('hover and focus preview do not overwrite committed selection; leaving clears only preview',()=>{const selected={areaId:'north',stallId:'campus-noodle-bar',itemId:'chicken-noodles'};const hovered=select(selected,{type:'hover-stall',id:'indian'},sampleLayout);assert.equal(hovered.stallId,selected.stallId);assert.equal(hovered.hoveredStall,'indian');assert.deepEqual(select(hovered,{type:'hover-stall'},sampleLayout),{...selected,hoveredStall:undefined})});
test('area changes clear incompatible descendants but keep compatible selections',()=>{const selected={areaId:'drinks',stallId:'campus-noodle-bar',itemId:'chicken-noodles'};assert.equal(select(selected,{type:'area',id:'drinks'},sampleLayout).itemId,'chicken-noodles');const next=select(selected,{type:'area',id:'central'},sampleLayout);assert.equal(next.stallId,undefined);assert.equal(next.itemId,undefined)});
test('stall selection resolves its area and resets the previous menu item',()=>{const next=select({areaId:'north',stallId:'indian',itemId:'roti-set'},{type:'stall',id:'brew-and-bites'},sampleLayout);assert.equal(next.areaId,'noodle');assert.equal(next.itemId,undefined)});
test('unknown geometry IDs cannot commit an area or stall',()=>{const state={areaId:'north'};assert.equal(select(state,{type:'area',id:'unknown'},sampleLayout),state);assert.equal(select(state,{type:'stall',id:'unknown'},sampleLayout),state)});
test('re-rendering and hover keep the selected item',()=>{const state={areaId:'north',stallId:'campus-noodle-bar',itemId:'chicken-noodles'};assert.equal(select(state,{type:'hover-area',id:'central'},sampleLayout).itemId,'chicken-noodles')});
test('area service filters stalls and menu service filters items by stable IDs',async()=>{const services=createCafeteriaServices();const stalls=await services.getStalls('north');assert.deepEqual(stalls.map(v=>v.id),['arab-shawarma','local-corner-left','local-corner-right']);const menu=await services.getMenu('indian');assert.ok(menu.length);assert.ok(menu.every(i=>i.vendorId==='indian'))});
test('empty area is an explicit successful result',async()=>{assert.deepEqual(await createCafeteriaServices().getStalls('dessert'),[])});
test('menu detail price and discounts use the same cart calculations including sides and quantity',()=>{const item=store.getDemoSnapshot().items.find(i=>i.id==='chicken-noodles');assert.equal(offerPrice(item),900);store.addToCart({itemId:item.id,quantity:2,extra:true});const [line]=cartDetails(store.getDemoSnapshot());assert.equal(line.unit,offerPrice(item)+addonPrice);assert.equal(line.unit*line.quantity,2200)});
test('basket keeps meals from multiple stalls and checkout creates a scoped order for each',()=>{store.addToCart({itemId:'chicken-noodles',quantity:1,extra:false});store.addToCart({itemId:'roti-set',quantity:1,extra:false});const state=store.getDemoSnapshot();assert.equal(state.cart.length,2);const first=store.placeOrder(2,'demo');const orders=store.getDemoSnapshot().orders.filter(o=>o.id===first||o.id.startsWith('AP-D')&&!state.orders.some(previous=>previous.id===o.id));assert.equal(orders.length,2);assert.deepEqual(new Set(orders.map(o=>o.vendorId)),new Set(['campus-noodle-bar','indian']));for(const o of orders){assert.ok(o.lines.every(l=>state.items.find(i=>i.id===l.itemId).vendorId===o.vendorId));assert.equal(o.total,o.lines.reduce((n,l)=>n+l.quantity*l.unit,0));assert.equal(o.slot,2)}assert.equal(store.getDemoSnapshot().cart.length,0)});
test('multi-stall checkout commits nothing if any stall has no pickup capacity',()=>{store.addToCart({itemId:'chicken-noodles',quantity:1,extra:false});store.addToCart({itemId:'roti-set',quantity:1,extra:false});store.saveVendor('indian',{paused:true},'Vendor','Paused for test');const before=JSON.stringify(store.getDemoSnapshot());assert.throws(()=>store.placeOrder(2,'counter'),/pickup window/);assert.equal(JSON.stringify(store.getDemoSnapshot()),before)});
test('changing map selection cannot change basket contents',()=>{store.addToCart({itemId:'chicken-noodles',quantity:1,extra:false});const saved=JSON.stringify(store.getDemoSnapshot().cart);select({areaId:'north'},{type:'stall',id:'brew-and-bites'},sampleLayout);assert.equal(JSON.stringify(store.getDemoSnapshot().cart),saved)});
test('closed stall has no orderable pickup window',async()=>{const services=createCafeteriaServices();const availability=await services.getAvailability('drinks-counter');assert.equal(availability.canOrder,false);assert.deepEqual(availability.pickupSlots,[]);assert.match(availability.label,/Closed/)});
test('out of stock items cannot enter the existing cart',()=>{assert.throws(()=>store.addToCart({itemId:'crispy-dumplings',quantity:1,extra:false}),/portions left/);assert.equal(store.getDemoSnapshot().cart.length,0)});
test('unavailable pickup windows are excluded using existing capacity rules',async()=>{const state=store.getDemoSnapshot(),v=state.vendors[0];const availability=await createCafeteriaServices().getAvailability(v.id,5);assert.deepEqual(availability.pickupSlots,slots.filter(s=>available(state,v,s,5)));assert.equal(availability.pickupSlots.includes(0),false)});
test('cart contents remain serialised for page reloads',()=>{store.addToCart({itemId:'chicken-noodles',quantity:2,extra:true});const saved=JSON.parse(localStorage.getItem(store.storageKey));assert.deepEqual(saved.cart,[{itemId:'chicken-noodles',quantity:2,extra:true}]);assert.equal(cartDetails(saved)[0].unit,1100)});
test('load error and retry publish complete loading/error/ready states',async()=>{let fail=true;const states=[];const read=async()=>{if(fail)throw new Error('Connection interrupted');return sampleLayout};await requestResource(read,v=>states.push(v));assert.deepEqual(states.map(v=>v.status),['loading','error']);assert.equal(states[1].error,'Connection interrupted');fail=false;await requestResource(read,v=>states.push(v));assert.deepEqual(states.map(v=>v.status),['loading','error','loading','ready']);assert.equal(states[3].data.id,sampleLayout.id)});
test('services expose errors rather than inventing unknown stall data',async()=>{await assert.rejects(createCafeteriaServices().getStall('not-real'),/no longer available/)});
test('every stall uses a real visible SVG rectangle and a configurable storefront asset',()=>{for(const l of sampleLayout.locations){assert.ok(sampleLayout.areas.some(a=>a.id===l.areaId));assert.ok(l.width>=100&&l.height>=70);assert.match(l.photo,/storefront/);assert.ok(l.x+l.width<=sampleLayout.width);assert.ok(l.y+l.height<=sampleLayout.height)}});

const auth=require('../.test-build/lib/preview-auth');
test('vendor preview sign-in binds a stall and refuses a different role',async()=>{const session=await auth.signInPreview('indian@apfoods.local','APFoods123!','vendor');assert.equal(session.vendorId,'indian');assert.equal(auth.getPreviewSession().role,'vendor');await assert.rejects(auth.signInPreview('indian@apfoods.local','APFoods123!','admin'),/does not match/);auth.signOutPreview();assert.equal(auth.getPreviewSession(),undefined)});
test('preview credentials discover student, vendor and admin roles without a selector',async()=>{for(const[email,role]of[['student@apfoods.local','student'],['indian@apfoods.local','vendor'],['admin@apfoods.local','admin']])assert.equal((await auth.signInPreview(email,'APFoods123!')).role,role);await assert.rejects(auth.signInPreview('admin@apfoods.local','wrong'),/does not match/);auth.signOutPreview()});
test('vendor signup stores a salted hash and can sign in again',async()=>{await auth.signUpVendor('Sample Cook','sample.cook@apfoods.local','SamplePass123!','arab-shawarma');const stored=localStorage.getItem('apfoods-preview-accounts');assert.ok(!stored.includes('SamplePass123!'));const record=JSON.parse(stored).find(a=>a.email==='sample.cook@apfoods.local');assert.ok(record.salt&&record.hash.length===64);auth.signOutPreview();const session=await auth.signInPreview('sample.cook@apfoods.local','SamplePass123!','vendor');assert.equal(session.vendorId,'arab-shawarma');await assert.rejects(auth.signInPreview('sample.cook@apfoods.local','wrong','vendor'),/does not match/);auth.signOutPreview()});

test('all ten physical counters have distinct, non-overlapping hover targets',()=>{const locations=sampleLayout.locations;assert.equal(locations.length,10);assert.equal(new Set(locations.map(l=>l.stallId)).size,10);for(let i=0;i<locations.length;i++)for(let j=i+1;j<locations.length;j++){const a=locations[i],b=locations[j];assert.ok(a.x+a.width+7<=b.x-7||b.x+b.width+7<=a.x-7||a.y+a.height+(a.stallId==='green-bowl-kitchen'?38:26)<=b.y-6||b.y+b.height+(b.stallId==='green-bowl-kitchen'?38:26)<=a.y-6,`${a.label} and ${b.label} hover targets overlap`)}const left=locations.find(l=>l.stallId==='local-corner-left'),right=locations.find(l=>l.stallId==='local-corner-right');assert.notEqual(left.stallId,right.stallId);let state=select({},{type:'hover-stall',id:left.stallId},sampleLayout);state=select(state,{type:'hover-stall',id:right.stallId},sampleLayout);assert.equal(state.hoveredStall,right.stallId)});
test('reference layout keeps the shared glass counter above six central tables and the entrance below',()=>{const {glassCounter,seatingPositions,entrancePosition}=require('../.test-build/lib/cafeteria/layout');assert.equal(seatingPositions.length,6);const left=sampleLayout.locations.filter(l=>l.areaId==='drinks');assert.deepEqual(left.map(l=>l.label),['Japan & Korea','Let’s Kopitiam','Fried Chicken','Chinese']);const right=sampleLayout.locations.filter(l=>l.areaId==='noodle');assert.deepEqual(right.map(l=>l.label),['Western','Malay','Indian']);for(const seat of seatingPositions){assert.ok(seat.x>175&&seat.x<735);assert.ok(seat.y>glassCounter.y+glassCounter.height);assert.ok(seat.y<entrancePosition.y)}assert.equal(entrancePosition.x,sampleLayout.width/2)});


test('both Local Corners support independent menu, item and checkout drilldown',async()=>{
 const services=createCafeteriaServices();
 for(const id of ['local-corner-left','local-corner-right']){
  const selected=select({},{type:'stall',id},sampleLayout);
  assert.equal(selected.stallId,id);
  assert.equal((await services.getStall(selected.stallId)).id,id);
  const menu=await services.getMenu(id);
  assert.ok(menu.length>0);
  assert.ok(menu.every(i=>i.vendorId===id&&i.active));
  store.addToCart({itemId:menu[0].id,quantity:1,extra:false});
 }
 const before=store.getDemoSnapshot();
 store.placeOrder(2,'counter');
 const orders=store.getDemoSnapshot().orders.filter(o=>!before.orders.some(old=>old.id===o.id));
 assert.deepEqual(new Set(orders.map(o=>o.vendorId)),new Set(['local-corner-left','local-corner-right']));
 assert.equal(store.getDemoSnapshot().cart.length,0);
});
test('existing browser catalogue gains Local Corner menus without resetting saved activity or edits',()=>{
 const {migrateCatalogue}=require('../.test-build/lib/demo');
 const saved=structuredClone(seedDemo());
 saved.vendors=saved.vendors.filter(v=>!v.id.startsWith('local-corner-'));
 saved.items=saved.items.filter(i=>!i.vendorId.startsWith('local-corner-'));
 saved.vendors[0].capacity=23;
 saved.items[0].price=1740;
 saved.cart=[{itemId:saved.items[0].id,quantity:2,extra:true}];
 const next=migrateCatalogue(saved);
 assert.equal(next.vendors[0].capacity,23);assert.equal(next.items[0].price,1740);
 assert.deepEqual(next.cart,saved.cart);assert.deepEqual(next.orders,saved.orders);assert.deepEqual(next.entries,saved.entries);
 assert.equal(next.vendors.filter(v=>v.id.startsWith('local-corner-')).length,2);
 assert.equal(next.items.filter(i=>i.vendorId.startsWith('local-corner-')).length,4);
 assert.deepEqual(migrateCatalogue(next),next);
});
