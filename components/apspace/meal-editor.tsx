'use client';
import { MealVisual } from "./meal-visual";
import { useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { addonPrice, available, money, slots, type Item } from '../../lib/demo';
import { itemStock, useDemo } from '../../lib/demo-store';
import { itemSavings, offerPrice } from '../../lib/promotions';
import { foodServices } from '../../services';
import { Modal, ErrorMessage } from '../shared';
export function MealEditor({item,close,added,embedded=false}:{item:Item;close:()=>void;added:()=>void;embedded?:boolean}){
 const state=useDemo();const [quantity,setQuantity]=useState(1),[extra,setExtra]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const vendor=state.vendors.find(v=>v.id===item.vendorId);const stock=itemStock(state,item);const valid=Number.isInteger(quantity)&&quantity>=1&&quantity<=stock;const canOrder=!!vendor&&item.active&&valid&&slots.some(s=>available(state,vendor,s,quantity*item.work));
 const total=quantity*(offerPrice(item)+(extra?addonPrice:0));
 async function add(){setError('');if(!canOrder){setError('This item or pickup capacity is unavailable.');return}setBusy(true);try{await foodServices.basket.add({itemId:item.id,quantity,extra});window.dispatchEvent(new CustomEvent('apfoods-notice',{detail:item.name+' added to cart'}));added()}catch(e){setError((e as Error).message);}finally{setBusy(false)}}
 const details=<div className="caf-item-detail"><div className="caf-item-intro"><MealVisual item={item}/><div><small>CUSTOMISE YOUR MEAL</small><h3>{item.name}</h3><p>{item.description}</p><strong>{money(offerPrice(item))}</strong>{itemSavings(item)>0&&<del>{money(item.price)}</del>}<p className={'small '+(stock?'muted':'error')}>{stock?stock+' portions available':'Sold out'}</p></div></div>
 <label className="caf-extra"><span><strong>Add a side</strong><small>One side per meal · {money(addonPrice)}</small></span><input type="checkbox" checked={extra} onChange={e=>setExtra(e.target.checked)} disabled={!stock}/></label>
 <div className="line spread caf-quantity"><span>Quantity</span><div className="ap-inline-stepper"><button aria-label="Decrease quantity" disabled={quantity<=1} onClick={()=>setQuantity(n=>n-1)}><Minus size={16}/></button><input aria-label="Quantity" type="number" min="1" max={stock||1} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/><button aria-label="Increase quantity" disabled={quantity>=stock} onClick={()=>setQuantity(n=>n+1)}><Plus size={16}/></button></div></div>
 <dl className="caf-price"><div><dt>{quantity} × meal{itemSavings(item)>0?' (deal applied)':''}</dt><dd>{money(quantity*offerPrice(item))}</dd></div>{extra&&<div><dt>{quantity} × side</dt><dd>{money(quantity*addonPrice)}</dd></div>}<div className="total"><dt>Total</dt><dd aria-live="polite">{money(total)}</dd></div></dl>
 <ErrorMessage message={error}/><button className="button primary caf-add" disabled={!canOrder||busy} onClick={()=>add()}><ShoppingBag size={18}/>{busy?'Adding…':!stock?'Sold out':vendor?.paused?'Stall closed':!canOrder?'Pickup unavailable':'Add to cart · '+money(total)}</button></div>;
 if(embedded)return details;
 return <Modal title={item.name} close={close}>{details}</Modal>;
}
