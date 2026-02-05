import { cn } from '@/lib/utils';

interface UserAvatarProps {
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

export const UserAvatar = ({ name, size = "md", className }: UserAvatarProps) => {
    let dim = "w-8 h-8";
    let textSize = "text-xs";

    if (size === 'xs') { dim = "w-4 h-4"; textSize = "text-[9px]"; }
    else if (size === 'sm') { dim = "w-5 h-5"; textSize = "text-[10px]"; }
    else if (size === 'lg') { dim = "w-10 h-10"; textSize = "text-sm"; }

    return (
        <div className={cn(dim, "rounded-full bg-gradient-to-br from-blue-500/80 to-blue-600 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/20", className)}>
            <span className={cn(textSize, "font-medium text-white leading-none")}>
                {name ? name.charAt(0) : '?'}
            </span>
        </div>
    )
}
