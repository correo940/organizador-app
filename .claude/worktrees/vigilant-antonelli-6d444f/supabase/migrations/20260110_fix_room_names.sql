-- Update room names and icons from English/Legacy to Spanish/Emojis

-- Kitchen -> Cocina
UPDATE rooms SET name = 'Cocina', icon = '🍳' WHERE name = 'Kitchen';
UPDATE rooms SET icon = '🍳' WHERE icon = 'ChefHat' OR icon = 'kitchen';

-- Living Room -> Salón
UPDATE rooms SET name = 'Salón', icon = '🛋️' WHERE name = 'Living Room' OR name = 'Living';
UPDATE rooms SET icon = '🛋️' WHERE icon = 'Tv' OR icon = 'living';

-- Bedroom -> Dormitorio
UPDATE rooms SET name = 'Dormitorio', icon = '🛏️' WHERE name = 'Bedroom';
UPDATE rooms SET icon = '🛏️' WHERE icon = 'Bed' OR icon = 'bedroom';

-- Bathroom -> Baño
UPDATE rooms SET name = 'Baño', icon = '🚿' WHERE name = 'Bathroom';
UPDATE rooms SET icon = '🚿' WHERE icon = 'Droplet' OR icon = 'bathroom';

-- Garage -> Garaje
UPDATE rooms SET name = 'Garaje', icon = '🚗' WHERE name = 'Garage';
UPDATE rooms SET icon = '🚗' WHERE icon = 'Car' OR icon = 'garage';

-- Office -> Oficina
UPDATE rooms SET name = 'Oficina', icon = '💼' WHERE name = 'Office';
UPDATE rooms SET icon = '💼' WHERE icon = 'FolderOpen' OR icon = 'office';

-- Other -> Otro
UPDATE rooms SET name = 'Otro', icon = '🏠' WHERE name = 'Other';
UPDATE rooms SET icon = '🏠' WHERE icon = 'Home' OR icon = 'other';
