'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotificationManager } from '@/lib/notifications';
import { differenceInDays, parseISO, addMonths } from 'date-fns';

export default function VehicleNotificationManager() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Init Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        const checkVehicles = async () => {
            // Request permissions
            const granted = await NotificationManager.requestPermissions();
            if (!granted) return;

            const { data: vehicles } = await supabase
                .from('vehicles')
                .select('*')
                .eq('user_id', user.id);

            if (!vehicles) return;

            const now = new Date();

            vehicles.forEach(vehicle => {
                const notifyKm = vehicle.notify_km_before || 1000;
                const notifyDays = vehicle.notify_days_before || 30;

                // 1. Check Oil Change (Km OR Date)
                if (vehicle.current_kilometers && vehicle.last_oil_change_km && vehicle.oil_change_interval_km) {
                    const kmDriven = vehicle.current_kilometers - vehicle.last_oil_change_km;
                    const kmRemaining = vehicle.oil_change_interval_km - kmDriven;
                    if (kmRemaining <= notifyKm) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`oil_km_${vehicle.id}`),
                            title: `🛢️ Cambio de Aceite (Km)`,
                            body: `${vehicle.name || vehicle.brand}: Te quedan ${kmRemaining > 0 ? kmRemaining : 0} km para el cambio de aceite.`,
                            schedule: { at: new Date(now.getTime() + 1000 * 5) }
                        });
                    }
                }
                // Oil Date Check
                if (vehicle.last_oil_change_date) {
                    const dueDate = addMonths(parseISO(vehicle.last_oil_change_date), vehicle.oil_change_interval_months || 12);
                    const daysRemaining = differenceInDays(dueDate, now);
                    if (daysRemaining <= notifyDays && daysRemaining >= 0) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`oil_date_${vehicle.id}`),
                            title: `🛢️ Cambio de Aceite (Fecha)`,
                            body: `${vehicle.name || vehicle.brand}: Toca cambio de aceite en ${daysRemaining} días.`,
                            schedule: { at: new Date(now.getTime() + 1000 * 6) }
                        });
                    }
                }

                // 2. Check Tires (Km OR Date)
                if (vehicle.current_kilometers && vehicle.last_tire_change_km && vehicle.tire_change_interval_km) {
                    const kmDriven = vehicle.current_kilometers - vehicle.last_tire_change_km;
                    const kmRemaining = vehicle.tire_change_interval_km - kmDriven;
                    if (kmRemaining <= notifyKm) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`tires_km_${vehicle.id}`),
                            title: `🛞 Cambio de Ruedas (Km)`,
                            body: `${vehicle.name || vehicle.brand}: Te quedan ${kmRemaining > 0 ? kmRemaining : 0} km para el cambio de ruedas.`,
                            schedule: { at: new Date(now.getTime() + 1000 * 7) }
                        });
                    }
                }
                // Tires Date Check
                if (vehicle.last_tire_change_date) {
                    const dueDate = addMonths(parseISO(vehicle.last_tire_change_date), vehicle.tire_change_interval_months || 48);
                    const daysRemaining = differenceInDays(dueDate, now);
                    if (daysRemaining <= notifyDays && daysRemaining >= 0) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`tires_date_${vehicle.id}`),
                            title: `🛞 Cambio de Ruedas (Fecha)`,
                            body: `${vehicle.name || vehicle.brand}: Toca cambio de ruedas en ${daysRemaining} días.`,
                            schedule: { at: new Date(now.getTime() + 1000 * 8) }
                        });
                    }
                }

                // 3. Check ITV
                if (vehicle.next_itv_date) {
                    const daysUntil = differenceInDays(parseISO(vehicle.next_itv_date), now);
                    if (daysUntil <= notifyDays && daysUntil >= 0) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`itv_${vehicle.id}`),
                            title: `📋 ITV Próxima`,
                            body: `${vehicle.name || vehicle.brand}: La ITV caduca en ${daysUntil} días (${vehicle.next_itv_date}).`,
                            schedule: { at: new Date(now.getTime() + 1000 * 10) }
                        });
                    }
                }

                // 4. Check Insurance
                if (vehicle.insurance_expiry_date) {
                    const daysUntil = differenceInDays(parseISO(vehicle.insurance_expiry_date), now);
                    if (daysUntil <= notifyDays && daysUntil >= 0) {
                        NotificationManager.schedule({
                            id: NotificationManager.generateId(`ins_${vehicle.id}`),
                            title: `📄 Seguro Próximo a Vencer`,
                            body: `${vehicle.name || vehicle.brand}: El seguro vence en ${daysUntil} días.`,
                            schedule: { at: new Date(now.getTime() + 1000 * 12) }
                        });
                    }
                }
            });
        };

        checkVehicles();

        // Subscribe to changes in vehicles to re-check instantly when user updates data
        const channel = supabase
            .channel('vehicle_notifications_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, checkVehicles)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }

    }, [user]);

    return null;
}
