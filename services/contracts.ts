import type { CartLine, DemoState, Item, Payment, Scenario, Status, Vendor, Order } from "../lib/demo";
export type Role="student"|"vendor"|"admin";
export type ReportKind="orders"|"finance"|"stock";
export type ReportScope={kind:ReportKind;days:1|7|14;vendorId:string;zone:string};
export type ReportData={title:string;generatedAt:string;timezone:string;source:string;scope?:{kind:ReportKind;period:string;zone:string;stall:string};summary?:{label:string;value:string}[];sections?:{title:string;paragraphs:string[]}[];columns:string[];rows:string[][]};
export type Preferences={density:"comfortable"|"compact";localTimezone:boolean;inAppUpdates:boolean};
export type CheckoutInput={slot:number;payment:Payment};
export type FulfilmentInput={orderId:string;status:Status;actor:"Student"|"Vendor";code?:string;reason?:string;confirmed?:boolean};
export type FoodServices={
 catalogue:{read:()=>Promise<Pick<DemoState,"vendors"|"items">>;saveItem:(item:Item)=>Promise<void>;saveVendor:(id:string,changes:Partial<Vendor>,actor:"Vendor"|"Admin",reason:string)=>Promise<void>};
 basket:{add:(line:CartLine,replace?:boolean)=>Promise<void>;quantity:(index:number,quantity:number)=>Promise<void>};
 orders:{read:(id:string)=>Promise<Order|undefined>;checkout:(input:CheckoutInput)=>Promise<string>;transition:(input:FulfilmentInput)=>Promise<void>;issueCode:(id:string,renew?:boolean)=>Promise<void>};
 finance:{addExpense:(vendorId:string,amountSen:number,label:string)=>Promise<void>;reverseExpense:(id:string,reason:string)=>Promise<void>};
 reports:{generate:(scope:ReportScope)=>Promise<ReportData>};
 scenarios:{select:(scenario:Scenario)=>Promise<void>};
};
