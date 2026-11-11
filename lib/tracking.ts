import type { Audit, Order, Status } from './demo';
export const trackingStages=['placed','accepted','preparing','ready','collected'] as const;
export const trackingCopy:Record<Status,{title:string;description:string;art:'order_placed'|'order_received'|'preparing_order'|'ready_for_pickup'|'order_completed'|'invalid_session'}>={
 placed:{title:'Your order is on its way to the kitchen.',description:'Waiting for the stall to accept your order. Your pickup time is reserved.',art:'order_placed'},
 accepted:{title:'You’re on the kitchen’s schedule.',description:'The stall has confirmed your order. We’ll show you when preparation begins.',art:'order_received'},
 preparing:{title:'Something good is cooking.',description:'The kitchen is preparing your food. Your pickup code will appear when it’s ready.',art:'preparing_order'},
 ready:{title:'Your meal is ready. See you at the counter!',description:'Head to your stall and show the QR or text code below to collect your food.',art:'ready_for_pickup'},
 collected:{title:'All yours. Enjoy your meal!',description:'Your order has been collected. You can find the receipt details and updates below.',art:'order_completed'},
 cancelled:{title:'This order was cancelled.',description:'There is no pickup to collect for this order. You can explore the cafeteria for another meal.',art:'invalid_session'},
 rejected:{title:'The stall couldn’t accept this order.',description:'This order will not be prepared. Choose another stall or try again later.',art:'invalid_session'}
};
export function canStudentCancel(status:Status){return status==='placed'||status==='accepted'}
export function canShowPickup(status:Status){return status==='ready'}
export function eventStage(event:Audit):Status|undefined{if(event.action==='Placed order')return 'placed';return trackingStages.find(stage=>event.action.toLowerCase()==='order '+stage)}
export function orderProgress(order:Order,events:Audit[]){const terminal=order.status==='cancelled'||order.status==='rejected';const current=trackingStages.findIndex(s=>s===order.status);const recorded=Math.min(3,Math.max(0,...events.map(e=>trackingStages.findIndex(s=>s===eventStage(e)))));return trackingStages.map((status,index)=>({status,treatment:terminal?(index<=recorded?'done':'upcoming'):index<current?'done':index===current?'current':'upcoming',at:events.find(e=>eventStage(e)===status&&Number.isFinite(Date.parse(e.at)))?.at}))}
export function codeRemaining(expiresAt:number|undefined,now:number){return expiresAt===undefined?0:Math.max(0,Math.ceil((expiresAt-now)/1000))}
