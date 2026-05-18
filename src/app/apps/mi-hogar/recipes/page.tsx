'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChefHat, Sparkles, Clock, BarChart, ShoppingCart, ArrowLeft, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api-utils';
// import { generateRecipeAction, RecipeData } from '@/app/actions/generate-recipe';
// Moved type definition here to avoid importing the server action file
export interface RecipeData {
    title: string;
    description: string;
    ingredients: { name: string; quantity: string; has_it: boolean }[];
    steps: string[];
    cooking_time: string;
    difficulty: string;
}

export default function RecipesPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pantryItems, setPantryItems] = useState<string[]>([]);
    const [recipe, setRecipe] = useState<RecipeData | null>(null);
    const [addingToCart, setAddingToCart] = useState(false);

    useEffect(() => {
        if (user) {
            fetchPantryItems();
        }
    }, [user]);

    const fetchPantryItems = async () => {
        const { data } = await supabase
            .from('shopping_items')
            .select('name')
            .eq('user_id', user?.id)
            .eq('is_checked', true); // Items in 'Despensa' (in_stock)

        if (data) {
            setPantryItems(data.map(i => i.name));
        }
    };

    const handleGenerateRecipe = async () => {
        if (pantryItems.length === 0) {
            toast.error("Tu despensa está vacía. Marca productos como 'Comprado' primero.");
            return;
        }

        setLoading(true);
        setRecipe(null);
        try {
            // const result = await generateRecipeAction(pantryItems);
            const response = await fetch(getApiUrl('api/mi-hogar/generate-recipe'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pantryItems })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                setRecipe(result.data);
                toast.success("¡Receta creada por el Chef!");
            } else {
                toast.error(result.error || "Error al generar receta");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const addMissingIngredients = async () => {
        if (!recipe || !user) return;

        const missing = recipe.ingredients.filter(i => !i.has_it);
        if (missing.length === 0) {
            toast.info("¡Ya tienes todos los ingredientes!");
            return;
        }

        setAddingToCart(true);
        try {
            const itemsToAdd = missing.map(ing => ({
                user_id: user.id,
                name: ing.name, // Simplified: just name, or "Name (Quantity)"
                category: 'Recetas',
                is_checked: false // to_buy
            }));

            const { error } = await supabase
                .from('shopping_items')
                .insert(itemsToAdd);

            if (error) throw error;

            toast.success(`Añadidos ${missing.length} ingredientes a la lista`);
        } catch (error) {
            console.error(error);
            toast.error("Error al añadir ingredientes");
        } finally {
            setAddingToCart(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 p-4">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/apps/mi-hogar">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ChefHat className="h-8 w-8 text-orange-500" />
                        Chef Inteligente
                    </h1>
                    <p className="text-muted-foreground text-sm">Crea recetas con lo que tienes en la despensa</p>
                </div>
            </div>

            {!recipe && (
                <Card className="text-center py-10 bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-background border-dashed">
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-white dark:bg-black rounded-full shadow-lg">
                            <Sparkles className="h-10 w-10 text-orange-500 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-medium">¿Sin ideas para cocinar?</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                Tienes {pantryItems.length} productos en tu despensa. Deja que la IA te sugiera un plato delicioso.
                            </p>
                        </div>
                        <Button
                            size="lg"
                            onClick={handleGenerateRecipe}
                            disabled={loading || pantryItems.length === 0}
                            className="bg-orange-600 hover:bg-orange-700 text-white mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Cocinando idea...
                                </>
                            ) : (
                                <>
                                    <ChefHat className="mr-2 h-5 w-5" />
                                    Sugerir Receta
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {recipe && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="overflow-hidden border-orange-200 dark:border-orange-900">
                        <div className="h-2 bg-gradient-to-r from-orange-400 to-red-500" />
                        <CardHeader>
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <CardTitle className="text-2xl text-orange-700 dark:text-orange-400">{recipe.title}</CardTitle>
                                    <CardDescription className="mt-2 text-base">{recipe.description}</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleGenerateRecipe} disabled={loading}>
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    Otra opción
                                </Button>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <Badge variant="secondary" className="gap-1">
                                    <Clock className="h-3 w-3" /> {recipe.cooking_time}
                                </Badge>
                                <Badge variant="secondary" className="gap-1">
                                    <BarChart className="h-3 w-3" /> {recipe.difficulty}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 border-b pb-2">
                                    <ShoppingCart className="h-4 w-4" /> Ingredientes
                                </h4>
                                <ul className="space-y-2 text-sm">
                                    {recipe.ingredients.map((ing, idx) => (
                                        <li key={idx} className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {ing.has_it ? (
                                                    <Check className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                                                ) : (
                                                    <span className="h-3 w-3 rounded-full bg-red-200 dark:bg-red-900 mt-1 shrink-0" />
                                                )}
                                                <span className={ing.has_it ? "" : "font-medium"}>{ing.name} <span className="text-muted-foreground text-xs">({ing.quantity})</span></span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {recipe.ingredients.some(i => !i.has_it) && (
                                    <Button
                                        size="sm"
                                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                                        onClick={addMissingIngredients}
                                        disabled={addingToCart}
                                    >
                                        {addingToCart ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                                        Añadir faltantes
                                    </Button>
                                )}
                            </div>
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 border-b pb-2">
                                    <ChefHat className="h-4 w-4" /> Instrucciones
                                </h4>
                                <ol className="space-y-4 list-decimal list-inside text-sm md:text-base text-muted-foreground">
                                    {recipe.steps.map((step, idx) => (
                                        <li key={idx} className="pl-2 leading-relaxed">
                                            <span className="text-foreground">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
