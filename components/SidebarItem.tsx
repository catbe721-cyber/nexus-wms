import React from 'react';
import { ViewState } from '../types';

interface SidebarItemProps {
    id: ViewState;
    icon: any;
    label: string;
    alert?: boolean;
    active: boolean;
    onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ id, icon: Icon, label, alert, active, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all mb-3 relative ${active
                ? 'bg-primary/20 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                : 'bg-transparent text-slate-100 hover:bg-white/5'
                }`}
        >
            <Icon className={`w-6 h-6 ${active ? 'text-primary' : 'text-slate-400 group-hover:text-white'}`} />
            <span className={`font-bold tracking-wide text-lg ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{label}</span>
            {alert && (
                <span className="absolute right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>
            )}
        </button>
    );
};

export default SidebarItem;
