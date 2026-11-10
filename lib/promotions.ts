export const promotions = [
  { itemId: "chicken-noodles", title: "Wok lunch special", savings: 200, tone: "chilli" },
  { itemId: "iced-coffee", title: "Kopi break", savings: 100, tone: "honey" },
  { itemId: "tofu-bowl", title: "The greens break", savings: 150, tone: "herb" },
] as const;

export function itemSavings(item: { id: string; price: number }) {
  const savings = promotions.find(promotion => promotion.itemId === item.id)?.savings ?? 0;
  return item.price > savings ? savings : 0;
}

export function offerPrice(item: { id: string; price: number }) {
  return item.price - itemSavings(item);
}
