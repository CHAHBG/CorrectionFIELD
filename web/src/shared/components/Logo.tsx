import React from 'react';

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
    return (
        <div className={`relative flex items-center justify-center overflow-hidden rounded-lg ${className}`}>
            <img
                src="/logo.png"
                alt="FieldCorrect Logo"
                className="h-full w-full object-contain"
            />
        </div>
    );
}

export function LogoWithText({ className = "h-8" }: { className?: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <Logo className={className} />
            <span className="text-xl font-bold leading-none tracking-tight text-slate-900">
                FieldCorrect
            </span>
        </div>
    );
}
