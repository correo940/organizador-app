-- Add payment_method to settlements
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS payment_method text check (payment_method in ('Bizum', 'Efectivo', 'Transferencia', 'Otro')) default 'Efectivo';
