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

-- Fictional catalogue expansion for the dedicated hackathon environment.
-- Existing stock, prices, stall settings, and historical snapshots are preserved.
update public.vendors set name = 'Chinese' where id = 'campus-noodle-bar' and name = 'Campus Noodle Bar';
update public.vendors set name = 'Malay' where id = 'brew-and-bites' and name = 'Brew & Bites';
update public.vendors set name = 'Japan & Korea' where id = 'green-bowl-kitchen' and name = 'Green Bowl Kitchen';
insert into public.vendors (id,zone_id,name,description,category,image,capacity,lead_minutes,opens_at,closes_at) values
  ('indian','main-food-court','Indian','Rice, curries and freshly made roti.','Indian cuisine','bowl',8,10,'00:00','24:00'),
  ('arab-shawarma','annex-cafeteria','Arab Shawarma','Shawarma wraps and fragrant rice plates.','Middle Eastern','noodles',6,10,'00:00','24:00'),
  ('drinks-counter','main-food-court','Let’s Kopitiam','Kopi and cold drinks between classes.','Drinks','coffee',6,5,'00:00','24:00'),
  ('local-corner-left','main-food-court','Local cuisine','Rice plates and seasonal vegetables.','Local rice dishes','bowl',6,10,'00:00','24:00'),
  ('local-corner-right','main-food-court','Local corner','Freshly cooked noodles and rice.','Local noodles & rice','noodles',6,10,'00:00','24:00'),
  ('western','main-food-court','Western','Grilled favourites and freshly cooked pasta.','Western cuisine','lunch',6,10,'00:00','24:00'),
  ('fried-chicken','main-food-court','Fried Chicken','Crispy chicken and satisfying sides.','Chicken & sides','lunch',6,10,'00:00','24:00')
on conflict (id) do nothing;

insert into public.menu_items (id,vendor_id,name,description,price_sen,stock,work_units) values
  ('chicken-curry','indian','Chicken Curry Rice','Chicken curry, steamed rice and vegetables.',1200,16,1),
  ('roti-set','indian','Roti Canai Set','Two pieces of roti with dhal and curry.',650,20,1),
  ('vegetable-biryani','indian','Vegetable Biryani','Spiced basmati rice and seasonal vegetables.',1000,12,1),
  ('chicken-shawarma','arab-shawarma','Chicken Shawarma','Grilled chicken, greens and garlic sauce in a warm wrap.',1150,16,1),
  ('falafel-wrap','arab-shawarma','Falafel Wrap','Chickpea falafel, salad and tahini.',1050,10,1),
  ('shawarma-rice','arab-shawarma','Shawarma Rice','Chicken shawarma over fragrant rice.',1400,12,1),
  ('nasi-lemak','brew-and-bites','Nasi Lemak','Coconut rice, sambal, egg and crispy anchovies.',950,16,1),
  ('iced-lemon-tea','drinks-counter','Iced Lemon Tea','Fresh lemon tea over ice.',390,20,1),
  ('kopitiam-kopi','drinks-counter','Kopi Ice','Rich kopi served over ice.',450,20,1),
  ('crispy-dumplings','campus-noodle-bar','Crispy Dumplings','Vegetable dumplings with soy dipping sauce.',800,10,1),
  ('local-left-chicken-rice','local-corner-left','Chicken Rice','Chicken, fragrant rice, cucumber and chilli sauce.',1000,20,1),
  ('local-left-vegetable-rice','local-corner-left','Vegetable Rice','Rice with seasonal vegetables and tofu.',850,20,1),
  ('local-right-mee-goreng','local-corner-right','Mee Goreng','Noodles with vegetables and egg.',950,20,1),
  ('local-right-nasi-goreng','local-corner-right','Nasi Goreng','Fried rice with vegetables and a fried egg.',1000,20,1),
  ('western-chicken-chop','western','Chicken Chop','Grilled chicken, fries and black pepper sauce.',1500,20,1),
  ('western-pasta','western','Tomato Pasta','Pasta in a tomato and herb sauce.',1100,20,1),
  ('fried-chicken-set','fried-chicken','Crispy Chicken Set','Crispy chicken with rice and slaw.',1200,20,1),
  ('chicken-tenders','fried-chicken','Chicken Tenders','Chicken tenders with a dipping sauce.',850,20,1)
on conflict (id) do nothing;
