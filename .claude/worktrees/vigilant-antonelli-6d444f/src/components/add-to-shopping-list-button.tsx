'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

interface AddToShoppingListButtonProps {
    ingredients: string[];
}

export default function AddToShoppingListButton({ ingredients }: AddToShoppingListButtonProps) {
    const [loading, setLoading] = useState(false);
    const [added, setAdded] = useState(false);
    const { user } = useAuth();

    const handleAddIngredients = async () => {
        if (!user) {
            toast.error('Debes iniciar sesión en Mi Hogar para usar esta función');
            return;
        }

        if (!ingredients || ingredients.length === 0) return;

        setLoading(true);
        try {
            // Prepare items for insertion
            const itemsToInsert = ingredients.map((ingredient) => ({
                user_id: user.id,
                name: ingredient,
                category: 'Recetas', // Categoría especial para identificar origen
                is_checked: false,
            }));

            const { error } = await supabase
                .from('shopping_items')
                .insert(itemsToInsert);

            if (error) throw error;

            toast.success(`${ingredients.length} ingredientes añadidos a la lista`);
            setAdded(true);

            // Reset "added" state after 3 seconds so user can add again if needed
            setTimeout(() => setAdded(false), 3000);

        } catch (error) {
            console.error('Error adding ingredients:', error);
            toast.error('Error al añadir ingredientes');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="my-8 p-6 bg-secondary/20 rounded-xl border border-secondary flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="font-headline text-lg font-bold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    ¿Te animas a probarlo?
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                    Añade los {ingredients.length} elementos necesarios a tu lista de compra en un clic.
                </p>
            </div>

            <Button
                onClick={handleAddIngredients}
                disabled={loading || added}
                size="lg"
                className={added ? "bg-green-600 hover:bg-green-700" : ""}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Añadiendo...
                    </>
                ) : added ? (
                    <>
                        <Check className="mr-2 h-4 w-4" />
                        ¡Añadido!
                    </>
                ) : (
                    <>
                        Añadir a la Lista
                    </>
                )}
            </Button>
        </div>
    );
}
