'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { Button } from '@/components/ui/button';
import { Profile } from '@/types';
import { LogoutModal } from '@/components/ui/logout-modal';

interface UserProfilePopoverProps {
  user: Profile | null;
}

export function UserProfilePopover({ user }: UserProfilePopoverProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const settingsHref = user?.role === 'admin' ? '/admin/settings' : '/user/settings';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center justify-center p-2 rounded-full hover:bg-sidebar-accent">
            <UserAvatarProfile
              user={user}
              showInfo={false}
              className="h-8 w-8"
              placeholderBlur={6}
              placeholderScale={1.03}
              fadeDurationMs={250}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end" side="bottom">
          <div className="space-y-4">
            <UserAvatarProfile
              user={user}
              showInfo={true}
              className="h-10 w-10"
              placeholderBlur={8}
              placeholderScale={1.05}
              fadeDurationMs={300}
            />
            <div className="border-t pt-4 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-sidebar-accent"
                asChild
              >
                <Link href={settingsHref}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
              <Button
                data-logout-trigger
                onClick={() => setIsLogoutModalOpen(true)}
                variant="outline"
                className="w-full justify-start hover:bg-sidebar-accent"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onOpenChange={setIsLogoutModalOpen}
      />
    </>
  );
}
