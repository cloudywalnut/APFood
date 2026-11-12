import type { hostedData } from "../../lib/backend/client";
import { isValidImageSrc } from "../../lib/backend/contracts";

export type Catalogue = Awaited<ReturnType<typeof hostedData.catalogue>>;
export type Meal = Catalogue["items"][number];
export type Stall = Catalogue["vendors"][number];
export const cuisines = [
  { id: "all", label: "All food", image: "/food/lunch.webp" },
  { id: "rice", label: "Rice & bowls", image: "/food/bowl.webp" },
  { id: "noodles", label: "Noodles", image: "/food/noodles.webp" },
  { id: "drinks", label: "Coffee & drinks", image: "/food/coffee.webp" },
  { id: "chicken", label: "Chicken", image: "/food/lunch.webp" },
  { id: "indian", label: "Indian", image: "/cafeteria/stalls/indian-storefront.jpg" },
  { id: "wraps", label: "Wraps", image: "/cafeteria/stalls/arab-shawarma-storefront.jpg" },
  { id: "western", label: "Western", image: "/cafeteria/stalls/western-storefront.jpg" },
];
export function cuisineMatches(stall: Stall, meals: Meal[], cuisine: string) {
  const text = (stall.category + " " + stall.name + " " + meals.map(item => item.name).join(" ")).toLowerCase();
  const patterns: Record<string, RegExp> = { rice: /rice|bowl|biryani/, noodles: /noodle|mee/, drinks: /coffee|kopi|tea|drinks/, chicken: /chicken/, indian: /indian|roti|biryani/, wraps: /wrap|shawarma|falafel/, western: /western|pasta|toastie/ };
  return cuisine === "all" || Boolean(patterns[cuisine]?.test(text));
}

// Use vendor-supplied dish photo first, falling back to bundled dish photos.
export function mealPhoto(item: Meal) {
  const photos: Record<string, string> = { "chicken-noodles": "/food/noodles.webp", "chilli-rice": "/food/lunch.webp", "nasi-lemak": "/food/lunch.webp", "tofu-bowl": "/food/bowl.webp", "iced-coffee": "/food/coffee.webp" };
  const custom = item.image?.trim();
  return (custom && isValidImageSrc(custom) ? custom : undefined) || photos[item.id];
}
