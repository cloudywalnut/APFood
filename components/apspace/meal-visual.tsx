import type { Item } from '../../lib/demo';
import { WarmIllustration } from './illustration';
const supplied:Record<string,{src:string;alt:string;illustration?:boolean}>={
 'chicken-noodles':{src:'/food/noodles.webp',alt:'Chicken noodle bowl'},
 'tofu-bowl':{src:'/food/bowl.webp',alt:'Tofu and vegetable rice bowl'},
 'iced-coffee':{src:'/food/coffee.webp',alt:'Iced coffee'},
 'chicken-curry':{src:'/illustrations/student.webp',alt:'Illustration of chicken curry, rice and vegetables',illustration:true},
 'chilli-rice':{src:'/food/lunch.webp',alt:'Chicken and rice meal'},
 'nasi-lemak':{src:'/food/lunch.webp',alt:'Malaysian rice meal'}
};
// A backend menu image can replace these local assets. Do not show an unrelated
// dish photograph when no appropriate asset exists for a menu item.
export function MealVisual({item}:{item:Item}){const media=item.image?{src:item.image,alt:item.imageAlt??item.name}:supplied[item.id];return <div className={'meal-visual '+(!media?'placeholder':media.illustration?'illustrated':'')}>{media?<img src={media.src} alt={media.alt} width="400" height="240" loading="lazy"/>:<><WarmIllustration name="preparing_order"/><span>Menu photo coming soon</span></>}</div>}
