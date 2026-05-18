'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Search } from 'lucide-react';
import HeaderAuth from './header-auth';

const PILLARS = [
    {
        href: '/?pillar=salud+f%C3%ADsica#articles',
        label: 'Cuerpo',
        logo: '/images/logo-cuerpo.png',
        color: '#1a5c2e',
        colorLight: '#e8f5ec',
    },
    {
        href: '/?pillar=salud+mental#articles',
        label: 'Mente',
        logo: '/images/logo-mente.png',
        color: '#1558a8',
        colorLight: '#e6f0fa',
    },
    {
        href: '/?pillar=finanzas+familiares#articles',
        label: 'Finanzas',
        logo: '/images/logo-finanzas.png',
        color: '#b87514',
        colorLight: '#fdf3e0',
    },
];



export default function Header() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/?search=${encodeURIComponent(searchQuery.trim())}#latest-articles`);
        } else {
            router.push('/');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center" suppressHydrationWarning>

                {/* ── Logo ── */}
                <div className="mr-6 hidden md:flex items-center flex-shrink-0">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <Image
                            src="/images/logo.png"
                            alt="Quioba"
                            width={32}
                            height={32}
                            className="object-contain group-hover:scale-105 transition-transform duration-200"
                        />
                        <span className="font-black text-lg tracking-tight whitespace-nowrap">Quioba</span>
                    </Link>
                </div>

                {/* ── Desktop Nav ── */}
                <nav className="hidden md:flex items-center gap-1 flex-1">
                    {/* Pillar buttons */}
                    {PILLARS.map((p) => (
                        <Link
                            key={p.label}
                            href={p.href}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
                            style={{ backgroundColor: p.color }}
                        >
                            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                                <Image
                                    src={p.logo}
                                    alt={p.label}
                                    width={14}
                                    height={14}
                                    className="object-contain"
                                />
                            </div>
                            {p.label}
                        </Link>
                    ))}
                </nav>

                {/* ── Mobile hamburger ── */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72">
                        <Link href="/" className="mb-8 flex items-center gap-2.5">
                            <Image src="/images/logo.png" alt="Quioba" width={32} height={32} className="object-contain" />
                            <span className="font-black text-lg">Quioba</span>
                        </Link>

                        <div className="flex flex-col gap-2">
                            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Los tres pilares</p>
                            {PILLARS.map((p) => (
                                <Link
                                    key={p.label}
                                    href={p.href}
                                    className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-accent"
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: p.colorLight }}
                                    >
                                        <Image src={p.logo} alt={p.label} width={22} height={22} className="object-contain" />
                                    </div>
                                    <span className="font-semibold text-sm" style={{ color: p.color }}>
                                        Quioba {p.label}
                                    </span>
                                </Link>
                            ))}


                        </div>
                    </SheetContent>
                </Sheet>

                {/* ── Search + Auth ── */}
                <div className="flex flex-1 items-center justify-end gap-2 md:flex-none" suppressHydrationWarning>
                    <div className="relative w-full md:w-48 lg:w-64" suppressHydrationWarning>
                        <button
                            onClick={handleSearch}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <Input
                            type="search"
                            placeholder="Buscar artículos..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <HeaderAuth />
                </div>

            </div>
        </header>
    );
}
