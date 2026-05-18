"use client";

import { Sword, LogIn, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function GuestDebateAccess() {
    return (
        <div
            style={{
                position: 'fixed',
                top: 65,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
            }}
            className="bg-gradient-to-br from-background via-background to-red-500/5"
        >
            <Card className="max-w-md w-full p-8 text-center shadow-xl">
                <div className="bg-gradient-to-br from-red-500 to-orange-500 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-lg">
                    <Sword className="w-12 h-12 text-white" />
                </div>

                <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                    El Debate
                </h1>

                <p className="text-muted-foreground mb-6">
                    Participa en debates estructurados con puntuación y votación.
                    Defiende tu postura y convence al público.
                </p>

                <div className="space-y-3">
                    <Link href="/login?redirect=/apps/debate" className="block">
                        <Button className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold">
                            <LogIn className="w-4 h-4 mr-2" />
                            Iniciar Sesión
                        </Button>
                    </Link>

                    <Link href="/register?redirect=/apps/debate" className="block">
                        <Button variant="outline" className="w-full">
                            <Users className="w-4 h-4 mr-2" />
                            Crear Cuenta
                        </Button>
                    </Link>
                </div>

                <div className="mt-8 pt-6 border-t">
                    <h3 className="font-semibold mb-3">Características</h3>
                    <ul className="text-sm text-muted-foreground space-y-2 text-left">
                        <li>⚔️ Debates cara a cara con puntuación</li>
                        <li>🎯 Sistema de turnos y tiempo límite</li>
                        <li>🏆 Votación pública para elegir ganador</li>
                        <li>📊 Estadísticas y historial</li>
                    </ul>
                </div>
            </Card>
        </div>
    );
}
