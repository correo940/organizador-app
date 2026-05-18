import { Crown, Zap, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type RoleBadgeType = 'super_admin' | 'admin' | 'moderator';

interface RoleBadgeProps {
    role: RoleBadgeType;
    className?: string;
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
    const config = {
        super_admin: {
            icon: Crown,
            label: 'Super Admin',
            className: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-yellow-600',
        },
        admin: {
            icon: Zap,
            label: 'Admin',
            className: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-600',
        },
        moderator: {
            icon: Shield,
            label: 'Moderador',
            className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-600',
        },
    };

    const { icon: Icon, label, className: badgeClass } = config[role];

    return (
        <Badge className={`${badgeClass} ${className} font-bold shadow-md`}>
            <Icon className="w-3 h-3 mr-1" />
            {label}
        </Badge>
    );
}
