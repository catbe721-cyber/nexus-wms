import React, { useState } from 'react';
import { getEmbedLink } from '../utils';

interface ImageThumbnailProps {
    src: string | undefined | null;
    alt: string;
    className?: string;
    allowZoom?: boolean;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ src, alt, className = "w-10 h-10", allowZoom = true }) => {
    const [hovered, setHovered] = useState<{ x: number, y: number } | null>(null);
    const [expanded, setExpanded] = useState(false);

    if (!src) return null;

    const embedSrc = getEmbedLink(src);

    return (
        <>
            <div
                className={`${className} rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center ${allowZoom ? 'cursor-zoom-in' : ''}`}
                onMouseEnter={(e) => {
                    if (!allowZoom) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHovered({ x: rect.right + 10, y: rect.top - 20 });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => allowZoom && setExpanded(true)}
            >
                <img src={embedSrc} alt={alt} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
            </div>

            {/* Hover Preview */}
            {hovered && (
                <div
                    className="fixed z-[9999] pointer-events-none bg-black p-2 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        left: hovered.x,
                        top: hovered.y,
                        transform: 'translateY(-50%)'
                    }}
                >
                    <div className="w-48 h-48 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={embedSrc} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                    </div>
                </div>
            )}

            {/* Expanded Lightbox */}
            {expanded && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(false);
                    }}
                >
                    <img
                        src={embedSrc}
                        alt="Enlarged"
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </>
    );
};

export default ImageThumbnail;
