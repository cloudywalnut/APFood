-- Fixture stall hours cover a full day so rehearsals can run after campus hours.
insert into public.zones (id,name) values
  ('main-food-court','Main Food Court'), ('annex-cafeteria','Annex Cafeteria')
on conflict (id) do nothing;

insert into public.vendors (id,zone_id,name,description,category,image,capacity,lead_minutes,opens_at,closes_at) values
  ('campus-noodle-bar','main-food-court','Campus Noodle Bar','Wok-tossed campus favourites, made to order.','Noodles & rice','noodles',5,10,'00:00','24:00'),
  ('brew-and-bites','main-food-court','Brew & Bites','Good coffee and quick bites between classes.','Coffee & light bites','coffee',6,5,'00:00','24:00'),
  ('green-bowl-kitchen','annex-cafeteria','Green Bowl Kitchen','Colourful bowls, crunchy greens and warm rice.','Rice bowls & greens','bowl',7,10,'00:00','24:00')
on conflict (id) do nothing;

insert into public.menu_items (id,vendor_id,name,description,price_sen,discount_sen,stock,work_units) values
  ('chicken-noodles','campus-noodle-bar','Chicken Noodle Bowl','Soy-glazed chicken, spring onions and wok-tossed noodles.',1100,200,18,1),
  ('chilli-rice','campus-noodle-bar','Chilli Chicken Rice','Fragrant rice, crispy chicken and house sambal.',1250,0,12,1),
  ('mushroom-noodles','campus-noodle-bar','Mushroom Noodles','Shiitake, greens and a savoury mushroom glaze.',1050,0,5,1),
  ('iced-coffee','brew-and-bites','Iced Kopi','Bold local coffee poured over ice.',650,100,20,1),
  ('egg-toast','brew-and-bites','Egg & Kaya Toast','Toasted bread with kaya and a soft egg.',850,0,11,1),
  ('toastie','brew-and-bites','Cheese Toastie','Golden toast and melted cheddar.',900,0,4,1),
  ('tofu-bowl','green-bowl-kitchen','Sesame Tofu Bowl','Crispy tofu, sesame greens and steamed rice.',1300,150,14,1),
  ('ginger-bowl','green-bowl-kitchen','Ginger Chicken Bowl','Tender ginger chicken, carrots and greens.',1400,0,10,1),
  ('harvest-bowl','green-bowl-kitchen','Harvest Rice Bowl','Seasonal vegetables and a bright lime dressing.',1200,0,3,1)
on conflict (id) do nothing;
