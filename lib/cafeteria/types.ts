import type { DemoState, Item, Vendor } from '../demo';
export type Bounds={x:number;y:number;width:number;height:number};
export type CafeteriaArea=Bounds&{id:string;name:string;subtitle:string;fill:string};
export type StallLocation=Bounds&{id:string;stallId:string;areaId:string;label:string;photo:string;photoAlt:string};
export type CafeteriaLayout={id:string;name:string;sample:boolean;width:number;height:number;areas:CafeteriaArea[];locations:StallLocation[]};
export type StallAvailability={canOrder:boolean;label:string;stock:number;loadPercent:number;pickupSlots:number[];bestPickup?:number};
export type CafeteriaServices={
 getLayout:()=>Promise<CafeteriaLayout>;getAreas:()=>Promise<CafeteriaArea[]>;
 getStalls:(areaId:string)=>Promise<Vendor[]>;getStall:(id:string)=>Promise<Vendor>;
 getMenu:(id:string)=>Promise<Item[]>;getAvailability:(id:string,units?:number)=>Promise<StallAvailability>;
 getPickupRecommendations:(id:string,units?:number)=>Promise<number[]>;
};
export type CatalogueSnapshot=Pick<DemoState,'vendors'|'items'>;
