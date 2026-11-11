import type { CafeteriaLayout } from './types';
// Geometry is illustrative, not a survey of the university. Replace at the API boundary.
const photo='/cafeteria/sample-storefront.webp';
export const sampleLayout:CafeteriaLayout={id:'campus-sample',name:'Campus cafeteria',sample:true,width:600,height:660,
 areas:[
 {id:'north',name:'North Court',subtitle:'Chinese · Indian',x:160,y:58,width:300,height:144,fill:'#f8e6b1'},
 {id:'central',name:'Central Court',subtitle:'Japanese & Korean',x:165,y:230,width:270,height:215,fill:'#edf0de'},
 {id:'noodle',name:'Noodle Lane',subtitle:'Arab Shawarma',x:145,y:470,width:325,height:140,fill:'#f5e4c5'},
 {id:'drinks',name:'Drinks Corner',subtitle:'Malay · Drinks',x:30,y:220,width:125,height:220,fill:'#e8e9dd'},
 {id:'dessert',name:'Dessert Bar',subtitle:'Coming soon',x:450,y:240,width:125,height:155,fill:'#f0e4db'}],
 locations:[
 {id:'n1',stallId:'campus-noodle-bar',areaId:'north',label:'Chinese',x:175,y:115,width:105,height:78,photo,photoAlt:'Sample physical cafeteria counter with glass display and mustard menu boards'},
 {id:'n2',stallId:'indian',areaId:'north',label:'Indian',x:315,y:115,width:105,height:78,photo,photoAlt:'Sample cafeteria storefront; placeholder for the Indian stall'},
 {id:'c1',stallId:'green-bowl-kitchen',areaId:'central',label:'Japanese & Korean',x:175,y:350,width:110,height:78,photo,photoAlt:'Sample cafeteria storefront; placeholder for the Japanese and Korean stall'},
 {id:'l1',stallId:'arab-shawarma',areaId:'noodle',label:'Arab Shawarma',x:195,y:520,width:110,height:78,photo,photoAlt:'Sample cafeteria storefront; placeholder for the shawarma stall'},
 {id:'d1',stallId:'brew-and-bites',areaId:'drinks',label:'Malay',x:40,y:255,width:100,height:76,photo,photoAlt:'Sample cafeteria storefront; placeholder for the Malay stall'},
 {id:'d2',stallId:'drinks-counter',areaId:'drinks',label:'Drinks',x:40,y:355,width:100,height:76,photo,photoAlt:'Sample cafeteria storefront; placeholder for the closed drinks counter'}]};
