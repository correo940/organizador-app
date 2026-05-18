INSERT INTO "public"."marketplace_apps" ("key", "name", "description", "icon_key", "route", "price", "category", "is_active")
VALUES
('huerto', 'Mis Plantas/Huerto', 'Identifica tus plantas con IA, obtén diagnósticos de salud y programa riegos automáticos.', 'Leaf', '/apps/huerto', 2.99, 'lifestyle', true)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon_key" = EXCLUDED."icon_key",
  "route" = EXCLUDED."route",
  "price" = EXCLUDED."price",
  "category" = EXCLUDED."category",
  "is_active" = EXCLUDED."is_active";
