import React from "react";
import { imgUrl } from "@/lib/utils";

interface UserAvatarProps {
  user: any;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = "md", className = "" }) => {
  const [hasError, setHasError] = React.useState(false);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base"
  };

  const name = user?.name || "User";
  const avatar = user?.avatar;
  const src = avatar ? imgUrl(avatar) : null;

  if (process.env.NODE_ENV !== 'production' && avatar) {
    console.debug('UserAvatar:', { id: user?._id || user?.id, avatar, src, hasError });
  }

  if (!avatar || hasError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold ${className}`}>
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src || ''}
      alt={name}
      onError={() => setHasError(true)}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
    />
  );
};

export default UserAvatar;
