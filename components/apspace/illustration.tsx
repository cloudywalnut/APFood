export type WarmArt='explore_cafeteria'|'empty_cart'|'no_orders'|'order_placed'|'order_received'|'preparing_order'|'ready_for_pickup'|'order_completed'|'stall_closed'|'item_unavailable'|'session_pending'|'invalid_session';
// Supplied concept cards retain their source pixels. Crop the artwork through CSS;
// all status labels and descriptions are accessible HTML, never the baked-in captions.
export function WarmIllustration({name,className=''}:{name:WarmArt;className?:string}){return <div className={'warm-art '+className} aria-hidden="true"><img src={'/illustrations/warm/'+name+'.png'} alt="" width="360" height="309" loading="lazy"/></div>}
