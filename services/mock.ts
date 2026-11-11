"use client";
import { buildReport } from "../lib/report-model";
import * as store from "../lib/demo-store";
import { dayKey, money, slotLabel } from "../lib/demo";
import { scopeData } from "../lib/analytics";
import type { FoodServices, ReportScope } from "./contracts";
export const mockFoodServices:FoodServices={
 catalogue:{read:async()=>{const s=store.getDemoSnapshot();return {vendors:s.vendors,items:s.items}},saveItem:async item=>store.saveItem(item),saveVendor:async(id,changes,actor,reason)=>store.saveVendor(id,changes,actor,reason)},
 basket:{add:async(line,replace)=>store.addToCart(line,replace),quantity:async(index,quantity)=>store.changeQuantity(index,quantity)},
 orders:{read:async id=>{await new Promise(resolve=>setTimeout(resolve,100));if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('Your connection is unavailable. Reconnect and try again.');return store.getDemoSnapshot().orders.find(o=>o.id===id)},checkout:async input=>store.placeOrder(input.slot,input.payment),transition:async({orderId,status,actor,...detail})=>store.transition(orderId,status,actor,detail),issueCode:async(id,renew)=>{store.issueCode(id,renew)}},
 finance:{addExpense:async(vendorId,amountSen,label)=>{store.addExpense(vendorId,amountSen,label)},reverseExpense:async(id,reason)=>{store.reverseExpense(id,reason)}},
 scenarios:{select:async scenario=>store.selectScenario(scenario)},
 reports:{generate:async(scope:ReportScope)=>{const state=store.getDemoSnapshot();let timezone='Asia/Kuala_Lumpur';try{if(JSON.parse(localStorage.getItem('ap-food-apspace-preferences')??'{}').localTimezone)timezone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{}return buildReport(state,scope,timezone)}}
};
