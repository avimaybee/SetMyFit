create table if not exists outfit_templates (
  id text primary key,
  name text not null,
  description text,
  style_tags text[],
  cover_image text,
  requirements text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table outfit_templates enable row level security;
create policy "Templates are viewable by everyone." on outfit_templates for select using (true);

insert into outfit_templates (id, name, description, style_tags, cover_image, requirements) values
('t1', 'Office Core', 'Professional yet approachable. Optimized for climate-controlled environments.', ARRAY['Smart', 'Minimal'], 'https://picsum.photos/300/200?random=20', ARRAY['1x Blazer/Jacket', '1x Trousers', '1x Leather Shoes']),
('t2', 'Weekend Warrior', 'Maximum mobility for urban exploration. Durable fabrics.', ARRAY['Utility', 'Street'], 'https://picsum.photos/300/200?random=21', ARRAY['1x Cargo/Denim', '1x Hoodie', '1x Sneakers']),
('t3', 'Date Night', 'High-contrast aesthetics for evening social protocols.', ARRAY['Elegant', 'Sharp'], 'https://picsum.photos/300/200?random=22', ARRAY['1x Statement Top', '1x Dark Bottoms', '1x Accessory']),
('t4', 'Rain Defense', 'Water-resistant layering for high humidity forecasts.', ARRAY['Techwear', 'Functional'], 'https://picsum.photos/300/200?random=23', ARRAY['1x Waterproof Outer', '1x Boots', '1x Hat'])
on conflict (id) do nothing;
