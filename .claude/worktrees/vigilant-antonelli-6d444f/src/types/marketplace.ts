export type AppCategory = 'productivity' | 'utility' | 'lifestyle' | 'finance' | 'social';

export interface MarketplaceApp {
    id: string;
    key: string;
    name: string;
    description: string | null;
    icon_key: string;
    route: string;
    price: number;
    category: AppCategory;
    is_active: boolean;
}

export interface UserAppPurchase {
    id: string;
    user_id: string;
    app_id: string;
    amount_paid: number;
    purchased_at: string;
    status: 'active' | 'refunded' | 'expired';
}

export interface AppWithStatus extends MarketplaceApp {
    isOwned: boolean;
    isLocked: boolean;
}
