'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationTab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NOTIFICATION_TABS: NotificationTab[] = [
  {
    label: 'E-mail', // Changed label to E-mail
    href: '/dashboard/notifications/email', // Changed href to email
    icon: <Mail className="h-4 w-4" />, // Changed icon to Mail
  },
];

export function NotificationTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {NOTIFICATION_TABS.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
