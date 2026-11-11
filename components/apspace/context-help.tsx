'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
const descriptions:Record<string,string>={
 'apfoods':'Your starting point for meals, pickup suggestions and campus offers.',
 'dashboard':'See today’s activity and the next actions for your workspace.',
 'stalls':'Explore the cafeteria map and select a counter to see its menu.',
 'orders':'Follow your orders and open the collection code when a meal is ready.',
 'kitchen':'Accept new orders, prepare meals and confirm each collection.',
 'menu & stock':'Update your stall’s meals, prices and remaining portions.',
 'capacity':'Set how many meals your stall can prepare in each pickup window.',
 'activity':'See available pickup times and how busy each kitchen is.',
 'financials':'See money received, expenses and the balance after costs.',
 'products':'Compare meal sales and check which items are running low.',
 'vendors':'Review stalls, approvals and food court assignments.',
 'traffic & capacity':'See booked pickups and how much room each kitchen has left.',
 'audit trail':'See who changed something, what changed and when.',
 'reports':'Choose the information you need, preview it and download a PDF or CSV.',
 'more':'Find extra tools and reports for your workspace.',
 'settings':'Change display options and preferences for this browser.',
 'order updates':'Read recent order and workspace updates.',
 'updates':'Read recent order and workspace updates.',
 'search apfoods':'Find a page or dish. Meal searches take you to the cafeteria map.',
 'sign out':'Leave this preview account and return to sign-in.',
 'your pickup recommendation':'An available stall and pickup time based on the meals already booked.',
 'campus deals':'Discounted sample meals. The displayed saving is applied in your cart.',
 'kitchen load':'How much of the kitchen’s meal capacity is already booked.',
 'sample net flow':'Money received minus recorded expenses for the selected period.',
 'pickups due today':'Orders scheduled for collection today that are still active.',
 'active orders':'Orders that are waiting, being prepared or ready for collection.',
 'active pickups':'Meals still moving through your kitchen before collection.',
 'ready to collect':'Meals marked ready and waiting for the student.',
 'low-stock products':'Meals with only a few portions left.',
 'low-stock items':'Meals with only a few portions left at your stall.',
 'collected receipts':'Payments recorded when meals were handed over.',
 'paid expenses':'Costs already recorded in the selected period.',
 'cashflow over time':'Compare money received and costs across the selected days.',
 'cashflow ledger':'Review individual receipts and costs, including reversals.',
 'stall performance':'Compare orders, pickup capacity and money after costs for each stall.',
 'upcoming pickups':'See the next meals due for collection at your counter.',
 'recent updates':'Read the latest recorded changes for this order.',
 'pickup settings':'Set your opening hours, preparation time and meal capacity.',
 'order intake':'Pause new orders or allow students to order again.',
 'how are the stalls doing?':'Compare orders or money after costs. Choose a stall for its product details.',
 'what’s happening in the kitchens?':'See how many orders are waiting, cooking or ready to collect.',
 'net flow':'Money received minus recorded expenses for the selected period.',
 'revenue':'The value of collected meals in the selected period.',
 'expenses':'Costs recorded for the selected stall and dates.',
 'order progress':'Follow the recorded steps from placing an order to collecting it.',
 'pickup information':'Where and when to collect this order.',
 'order details & updates':'See the items, prices and recorded changes for this order.',
 'your cart':'Review meals from all selected stalls before choosing pickup.',
 'order summary':'Review your meals and total. Each stall receives its own order.',
 'pickup preference':'Choose the earliest available pickup or a less busy kitchen.',
 'soonest':'Suggest the earliest pickup time with space for an order.',
 'lower load':'Prefer a kitchen with fewer meals already booked.',
 'sample payment':'Complete a demonstration checkout. No real money is charged.',
 'pay at counter':'Pay each stall when you collect your meal.',
 'find a cuisine or dish':'Search highlights matching counters on the map.',
 'refine the map':'Narrow the highlighted stalls by food court, meal type or availability.',
 'explore the cafeteria':'Open the map to find a stall and start your order.',
};
export function helpText(label:string){const key=label.toLowerCase().trim();if(descriptions[key])return descriptions[key];if(/cart|basket/.test(key))return 'Review selected meals, change quantities and continue to pickup.';if(/increase|add.*quantity/.test(key))return 'Add one more portion of this meal.';if(/decrease/.test(key))return 'Reduce this meal’s quantity by one.';if(/remove/.test(key))return 'Remove this item from your selection.';if(/add to cart/.test(key))return 'Keep this meal in your basket. You can add meals from other stalls too.';if(/pickup code|qr/.test(key))return 'Show this code to the stall when your meal is ready to collect.';if(/cancel/.test(key))return 'Cancel an eligible order before preparation has started.';if(/filter|data source/.test(key))return 'Choose which sample records are included in this view.';if(/export|download/.test(key))return 'Save the information currently selected in this report.';if(/stock/.test(key))return 'The number of portions still available for ordering.';if(/pickup|window/.test(key))return 'Choose a 15-minute collection window with space at every selected stall.';if(/menu|stall|cafeteria/.test(key))return 'Explore the campus map, select a counter and browse its meals.';if(/search/.test(key))return 'Type a name or keyword to find matching results.';if(/copy/.test(key))return 'Copy this value so you can paste it elsewhere.';if(/back/.test(key))return 'Return to the previous step.';if(/continue|next/.test(key))return 'Review the next step before confirming.';if(/ready/.test(key))return 'Let the student know their meal can be collected.';if(/prepar/.test(key))return 'Move the order into the cooking stage.';if(/accept/.test(key))return 'Confirm the kitchen can prepare this order.';if(/collect|verify/.test(key))return 'Check the pickup code and confirm that the meal was handed over.';return ''}
function actionHelp(target:Element,label:string){if(!label)return '';const href=target.getAttribute('href')??'';if(href.includes('/reports'))return descriptions.reports;if(href.includes('/orders'))return descriptions.orders;if(href.includes('/vendors'))return descriptions.stalls;if(href.includes('/settings'))return descriptions.settings;if(href.includes('/notifications'))return descriptions.updates;if(href.includes('/cashflow'))return descriptions.financials;if(href.includes('/products'))return descriptions.products;if(target.matches('input[type="checkbox"]'))return 'Turn this option on or off.';if(target.matches('input,select'))return 'Choose or enter a value to update this view.';if(target.matches('button[role="tab"],button[aria-pressed]'))return 'Show the information for this selection.';if(target.matches('summary'))return 'Open or close the details in this section.';if(target.matches('a')&&href.includes('/item/'))return 'See this meal’s price, choose a quantity and add it to your cart.';return ''}
export function ContextHelp(){
 const [tip,setTip]=useState<{title:string;text:string;left:number;top:number}>();const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{let current:Element|null=null,described:Element|null=null,previous:string|null=null;
 const clear=()=>{if(timer.current)clearTimeout(timer.current);if(described){if(previous===null)described.removeAttribute('aria-describedby');else described.setAttribute('aria-describedby',previous)}described=null;current=null;setTip(undefined)};
 function show(event:Event){const node=event.target instanceof Element?event.target:null;if(!node||node.closest('.caf-map-stage,.caf-preview,.context-help-tooltip'))return;
 const target=node.closest('[data-help],button,a,input,select,summary,[role="tab"],.metric,section,.panel,article');if(target===current)return;clear();if(!target)return;
 const heading=target.querySelector('h1,h2,h3');const label=target.getAttribute('data-help-label')??target.getAttribute('aria-label')??(target.matches('.metric')?target.querySelector('span')?.textContent:target.matches('section,.panel,article')?heading?.firstChild?.textContent:target.matches('input,select')?target.closest('label')?.firstChild?.textContent:target.textContent)??'';
 const title=label.trim().replace(/\s+/g,' ').slice(0,80);const summary=target.matches('section,.panel,article')?target.querySelector('p')?.textContent?.trim():undefined;const text=target.getAttribute('data-help')??(helpText(title)||summary||actionHelp(target,title));if(!text||!title)return;current=target;
 timer.current=setTimeout(()=>{const r=target.getBoundingClientRect();const width=Math.min(280,window.innerWidth-24);const top=r.bottom+95<window.innerHeight?r.bottom+9:Math.max(12,r.top-100);described=target;previous=target.getAttribute('aria-describedby');target.setAttribute('aria-describedby',[previous,'apfoods-context-help'].filter(Boolean).join(' '));setTip({title,text,left:Math.max(12,Math.min(window.innerWidth-width-12,r.left)),top})},event.type==='focusin'?0:400)}
 const out=(event:MouseEvent)=>{if(current&&event.relatedTarget instanceof Node&&current.contains(event.relatedTarget))return;clear()};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')clear()};
 document.addEventListener('mouseover',show);document.addEventListener('mouseout',out);document.addEventListener('focusin',show);document.addEventListener('focusout',clear);document.addEventListener('keydown',esc);window.addEventListener('scroll',clear,true);window.addEventListener('resize',clear);
 return()=>{clear();document.removeEventListener('mouseover',show);document.removeEventListener('mouseout',out);document.removeEventListener('focusin',show);document.removeEventListener('focusout',clear);document.removeEventListener('keydown',esc);window.removeEventListener('scroll',clear,true);window.removeEventListener('resize',clear)};
 },[]);
 return tip?createPortal(<div id="apfoods-context-help" role="tooltip" className="context-help-tooltip" style={{left:tip.left,top:tip.top}}><strong>{tip.title}</strong><span>{tip.text}</span></div>,document.body):null
}
export function SectionHelp({title}:{title:string}){const text=helpText(title);return text?<button type="button" className="section-help" aria-label={'About '+title} data-help-label={title} data-help={text}>i</button>:null}
