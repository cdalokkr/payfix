'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Profile } from '@/types';
import { getDefaultAvatarUrl, isDefaultAvatar } from '@/lib/utils/avatar-helper';
import React, { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface UserAvatarProfileProps {
  user: Profile | null;
  showInfo?: boolean;
  className?: string;
  placeholderBlur?: number;
  placeholderScale?: number;
  fadeDurationMs?: number;
}

// Global set to track which images have finished loading in the current session
// to prevent skeleton flickers during component remounts or table refreshes.
const loadedImageUrls = new Set<string>();

function UserAvatarProfileComponent({
  user,
  showInfo = false,
  className,
  placeholderBlur = 8,
  placeholderScale = 1.05,
  fadeDurationMs = 250
}: UserAvatarProfileProps) {

  const initials = useMemo(() => {
    if (!user) return '?';
    return user.full_name
      ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
      : user.email[0].toUpperCase();
  }, [user]);

  const avatarUrl = useMemo(() => {
    if (!user) return '';
    return user.avatar_url || getDefaultAvatarUrl(user.sex);
  }, [user]);

  const [isLoaded, setIsLoaded] = useState(() => {
    if (avatarUrl && isDefaultAvatar(avatarUrl)) return true;
    return (avatarUrl && typeof window !== 'undefined') ? loadedImageUrls.has(avatarUrl) : false;
  });

  // Handle URL changes and caching
  useEffect(() => {
    if (avatarUrl) {
      if (isDefaultAvatar(avatarUrl) || loadedImageUrls.has(avatarUrl)) {
        setIsLoaded(true);
      } else {
        setIsLoaded(false);
      }
    }
  }, [avatarUrl]);

  // Mark as loaded in global cache once the image finishes loading
  const handleLoad = () => {
    if (avatarUrl) {
      loadedImageUrls.add(avatarUrl);
    }
    setIsLoaded(true);
  };

  if (!user) {
    return (
      <div className={cn('flex items-center gap-2', showInfo ? '' : 'justify-center')}>
        <Avatar className={className}>
          <Skeleton className="h-full w-full rounded-full" />
        </Avatar>
        {showInfo && (
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', showInfo ? '' : 'justify-center')}>
      <Avatar className={cn(className, "relative overflow-hidden bg-muted/30")}>
        {!isLoaded && (
          <Skeleton className="absolute inset-0 rounded-full z-10" />
        )}
        <AvatarImage
          src={avatarUrl}
          alt={user.full_name || user.email}
          loading="eager"
          fetchPriority="high"
          onLoad={handleLoad}
          style={{
            transition: `opacity ${fadeDurationMs}ms ease-out`,
            opacity: isLoaded ? 1 : 0
          }}
        />
        {!isLoaded && (
          <AvatarFallback className="text-[10px] font-bold opacity-50">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      {showInfo && (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.full_name || 'User'}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      )}
    </div>
  );
}

function areEqual(prev: UserAvatarProfileProps, next: UserAvatarProfileProps) {
  const prevUser = prev.user
  const nextUser = next.user
  return (
    prev.showInfo === next.showInfo &&
    prev.className === next.className &&
    (!!prevUser === !!nextUser) &&
    (!prevUser || !nextUser || (
      prevUser.avatar_url === nextUser.avatar_url &&
      prevUser.full_name === nextUser.full_name &&
      prevUser.email === nextUser.email
    ))
  )
}

export const UserAvatarProfile = React.memo(UserAvatarProfileComponent, areEqual)
