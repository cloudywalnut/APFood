'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Clock3, MapPin, ShoppingBag, Store } from 'lucide-react';
import { cartDetails, money, slotLabel, type Item, type Vendor } from '../../lib/demo';
import { itemStock, useDemo } from '../../lib/demo-store';
import { offerPrice } from '../../lib/promotions';
import type { CafeteriaServices, CafeteriaLayout } from '../../lib/cafeteria/types';
import { select, requestResource, type Selection, type SelectionAction } from '../../lib/cafeteria/selection';
import { cafeteriaServices } from '../../services/cafeteria';
import { CafeteriaMap } from './map';
import { MealEditor } from '../apspace/meal-editor';
import { Empty } from '../shared';
type Resource<T>={status:'loading'|'ready'|'error';data?:T;error?:string};
function useResource<T>(key:string,read:()=>Promise<T>){const reader=useRef(read);reader.current=read;const [attempt,setAttempt]=useState(0);const [resource,setResource]=useState<Resource<T>&{key:string}>({key:'',status:'loading'});
 useEffect(()=>{let active=true;if(!key)return;void requestResource(()=>reader.current(),value=>{if(active)setResource({...value,key})});return()=>{active=false}},[key,attempt]);return {...(resource.key===key?resource:{status:key?'loading':'ready'} as Resource<T>),retry:()=>setAttempt(n=>n+1)};
}
function ResourceNotice({resource,label}:{resource:Resource<unknown>&{retry:()=>void};label:string}){return resource.status==='loading'?<p className="caf-loading" role="status">Loading {label}…</p>:resource.status==='error'?<div className="caf-request-error" role="alert"><strong>Unable to load {label}</strong><p>{resource.error}</p><button className="button secondary" onClick={resource.retry}>Try again</button></div>:null}
function StepTitle({step,title,selection}:{step:number;title:string;selection?:string}){return <div className="caf-step-title"><span>{step}</span><h2>{title}</h2>{selection&&<small>{selection}</small>}</div>}
export function AreaSelector({layout,selected,onSelect}:{layout:CafeteriaLayout;selected?:string;onSelect:(id:string)=>void}){return <div className="caf-area-options" aria-label="Choose area">{layout.areas.map(area=><button key={area.id} aria-pressed={selected===area.id} onClick={()=>onSelect(area.id)}><MapPin size={15}/>{area.name}{selected===area.id&&<Check size={14}/>}</button>)}</div>}
export function StallSelector({vendors,selected,onSelect}:{vendors:Vendor[];selected?:string;onSelect:(id:string)=>void}){return <div className="caf-stall-options">{vendors.map(v=><button key={v.id} aria-pressed={selected===v.id} onClick={()=>onSelect(v.id)}><span className="caf-stall-icon"><Store size={20}/></span><span><strong>{v.name}</strong><small>{v.category} · {v.paused?'Closed':v.status==='approved'?'Open':'Unavailable'}</small></span>{selected===v.id?<Check size={18}/>:<ChevronRight size={18}/>}</button>)}</div>}
export function MenuItemSelector({items,selected,onSelect}:{items:Item[];selected?:string;onSelect:(id:string)=>void}){const state=useDemo();return <div className="caf-menu-options">{items.map(item=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}><span><strong>{item.name}</strong><small>{!itemStock(state,item)?'Sold out':itemStock(state,item)+' left'}</small></span><strong>{money(offerPrice(item))}</strong>{selected===item.id?<Check size={16}/>:<ChevronRight size={16}/>}</button>)}</div>}
export function CafeteriaPage({services=cafeteriaServices}:{services?:CafeteriaServices}){
 const state=useDemo();const [selection,setSelection]=useState<Selection>({areaId:'north'});const [notice,setNotice]=useState('');
 const layout=useResource('layout',services.getLayout);const revision=state.scenario+':'+(state.audit[0]?.id??'')+':'+state.orders.length;
 const stalls=useResource(selection.areaId?selection.areaId+revision:'',()=>services.getStalls(selection.areaId!));
 const menu=useResource(selection.stallId?selection.stallId+revision:'',()=>services.getMenu(selection.stallId!));
 const availability=useResource(selection.stallId?selection.stallId+revision:'',()=>services.getAvailability(selection.stallId!));
 const selectedVendor=state.vendors.find(v=>v.id===selection.stallId);const selectedItem=menu.data?.find(i=>i.id===selection.itemId);const selectedArea=layout.data?.areas.find(a=>a.id===selection.areaId);const location=layout.data?.locations.find(l=>l.stallId===selection.stallId);
 function dispatch(action:SelectionAction){if(layout.data){setSelection(previous=>select(previous,action,layout.data!));if(action.type==='area'||action.type==='stall'||action.type==='item')setNotice('')}}
 const lines=cartDetails(state);const count=lines.reduce((n,l)=>n+l.quantity,0),total=lines.reduce((n,l)=>n+l.quantity*l.unit,0);
 return <><div className="student-heading"><div><p className="caf-eyebrow">EXPLORE • CHOOSE • COLLECT</p><h1>Find your next favourite.</h1><p>Your campus food court, one counter at a time.</p></div><Link className="button secondary" href="/app/vendors">List view <ArrowRight size={16}/></Link></div>
 <ol className="caf-progress" aria-label="Ordering progress">{['Choose area','Choose stall','Choose item','Customise & add'].map((step,i)=><li key={step} aria-current={i===(selection.itemId?3:selection.stallId?2:selection.areaId?1:0)?'step':undefined}><span>{i+1}</span>{step}</li>)}</ol>
 <ResourceNotice resource={layout} label="cafeteria map"/>{layout.data&&<div className="caf-layout"><div className="caf-map-column"><CafeteriaMap layout={layout.data} vendors={state.vendors} selection={selection} dispatch={dispatch}/></div><div className="caf-cascade">
 <section className="panel caf-step"><StepTitle step={1} title="Choose area" selection={selectedArea?.name}/><AreaSelector layout={layout.data} selected={selection.areaId} onSelect={id=>dispatch({type:'area',id})}/></section>
 <section className="panel caf-step"><StepTitle step={2} title="Choose stall" selection={selectedVendor?.name}/>{!selection.areaId?<p className="muted">Choose an area on the map to see its stalls.</p>:<><ResourceNotice resource={stalls} label="stalls"/>{stalls.data&&(stalls.data.length?<StallSelector vendors={stalls.data.map(v=>state.vendors.find(live=>live.id===v.id)??v)} selected={selection.stallId} onSelect={id=>dispatch({type:'stall',id})}/>:<Empty title="No stalls here yet" detail="Choose another area to find an open counter."/>)}</>}</section>
 {selectedVendor&&<section className="panel caf-step"><StepTitle step={3} title="Choose item"/><div className="caf-selected-stall"><img src={location?.photo} alt={location?.photoAlt??'Stall storefront'} width="90" height="60"/><div><strong>{selectedVendor.name}</strong><p>{selectedVendor.hours}</p><small>Stall storefront · {selectedArea?.name}</small></div></div><ResourceNotice resource={availability} label="availability"/>{availability.data&&!availability.data.canOrder&&<p className="caf-closed" role="status">{availability.data.label}. You can browse the menu; ordering is unavailable.</p>}<ResourceNotice resource={menu} label="menu"/>{menu.data&&(menu.data.length?<MenuItemSelector items={menu.data} selected={selection.itemId} onSelect={id=>dispatch({type:'item',id})}/>:<p className="muted">This menu is being updated. Try another stall.</p>)}</section>}
 {selectedItem&&<section className="panel caf-step"><StepTitle step={4} title="Make it yours"/><MealEditor key={selectedItem.id} item={selectedItem} embedded close={()=>{}} added={()=>setNotice(selectedItem.name+' added to your cart.')}/></section>}
 {notice&&<div className="caf-success" role="status"><Check size={18}/>{notice}<Link href="/app/cart">View cart →</Link></div>}
 {selectedVendor&&availability.data&&<section className="caf-recommendation"><Clock3 size={23}/><div><strong>{availability.data.bestPickup===undefined?'No pickup windows available':'Best pickup: '+slotLabel(availability.data.bestPickup)}</strong><p>{availability.data.loadPercent}% kitchen load · Based on pickup bookings</p><small>Availability is checked again for your quantity and at checkout.</small></div></section>}
 </div></div>}
 {count>0&&<div className="ap-basket-dock caf-cart-dock"><span className="ap-basket-icon"><ShoppingBag size={24}/><b>{count}</b></span><div><strong>{money(total)}</strong><small>{count} {count===1?'item':'items'} in your cart</small></div><Link className="button primary" href="/app/cart">View cart <ArrowRight size={17}/></Link></div>}
 </>
}
