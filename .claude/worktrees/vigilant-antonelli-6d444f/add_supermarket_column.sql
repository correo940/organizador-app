-- Add supermarket column to shopping_items table
ALTER TABLE public.shopping_items 
ADD COLUMN IF NOT EXISTS supermarket text;
