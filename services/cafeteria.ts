'use client';
import { available, loadFor, slots, type DemoState } from '../lib/demo';
import { getDemoSnapshot, itemStock } from '../lib/demo-store';
import { sampleLayout } from '../lib/cafeteria/layout';
import type { CafeteriaServices } from '../lib/cafeteria/types';
// Replace this adapter with authenticated API calls. No production responses are fabricated.
export function createCafeteriaServices(read:()=>DemoState=getDemoSnapshot):CafeteriaServices{
 async function fetchLocal<T>(fn:()=>T):Promise<T>{await new Promise(resolve=>setTimeout(resolve,120));if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('You appear to be offline. Reconnect and try again.');return fn()}
 const find=(id:string)=>{const vendor=read().vendors.find(v=>v.id===id);if(!vendor)throw new Error('This stall is no longer available.');return vendor};
 const availability=(id:string,units=1)=>{const state=read(),v=find(id);const pickupSlots=slots.filter(s=>available(state,v,s,units));const first=pickupSlots[0];return {canOrder:pickupSlots.length>0,label:v.status!=='approved'?'Unavailable':v.paused?'Closed · intake paused':pickupSlots.length?'Open':'Pickup full',stock:state.items.filter(i=>i.vendorId===id&&i.active).reduce((n,i)=>n+itemStock(state,i),0),loadPercent:Math.round(loadFor(state,v,first??0).units/v.capacity*100),pickupSlots,bestPickup:first}};
 return {getLayout:()=>fetchLocal(()=>sampleLayout),getAreas:()=>fetchLocal(()=>sampleLayout.areas),getStalls:areaId=>fetchLocal(()=>read().vendors.filter(v=>sampleLayout.locations.some(l=>l.areaId===areaId&&l.stallId===v.id))),getStall:id=>fetchLocal(()=>find(id)),getMenu:id=>fetchLocal(()=>{find(id);return read().items.filter(i=>i.vendorId===id&&i.active)}),getAvailability:(id,units)=>fetchLocal(()=>availability(id,units)),getPickupRecommendations:(id,units)=>fetchLocal(()=>availability(id,units).pickupSlots)};
}
export const cafeteriaServices=createCafeteriaServices();
