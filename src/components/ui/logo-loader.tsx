'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogoLoaderProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export default function LogoLoader({ size = 'md', className }: LogoLoaderProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 p-1',
        md: 'w-12 h-12 p-1.5',
        lg: 'w-20 h-20 p-2.5',
        xl: 'w-32 h-32 p-4',
    };

    return (
        <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
            <div className="relative">
                {/* Glow effect background */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className={cn(
                        "absolute inset-0 bg-green-800/20 blur-xl rounded-full",
                        sizeClasses[size]
                    )}
                />

                {/* The Spinning Logo */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    className={cn(
                        "relative bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 flex items-center justify-center overflow-hidden",
                        sizeClasses[size]
                    )}
                >
                    <img
                        src="/images/logo.png"
                        alt="Quioba Loading"
                        className="w-full h-full object-contain"
                    />
                </motion.div>
            </div>
        </div>
    );
}
