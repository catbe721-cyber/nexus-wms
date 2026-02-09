import React from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
    to: string;
    icon: LucideIcon;
    label: string;
    alert?: boolean;
    onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon: Icon, label, alert, onClick }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all mb-3 relative ${isActive
                ? 'bg-primary/20 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                : 'bg-transparent text-slate-100 hover:bg-white/5'
                }`}
        >
            {({ isActive }) => (
                <>
                    <Icon className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className={`font-bold tracking-wide text-lg ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{label}</span>
                    {alert && (
                        <span className="absolute right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>
                    )}
                </>
            )}
        </NavLink>
    );
};

export default SidebarItem;
