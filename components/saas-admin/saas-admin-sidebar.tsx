'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Home,
    Users,
    CreditCard,
    FileText,
    Menu,
    X
} from 'lucide-react'

const navigation = [
    { name: 'Dashboard', href: '/saas-admin', icon: Home },
    { name: 'Clientes', href: '/saas-admin/tenants', icon: Users },
    { name: 'Pagamentos', href: '/saas-admin/payments', icon: CreditCard },
    { name: 'Logs', href: '/saas-admin/logs', icon: FileText },
]

export function SaasAdminSidebar() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

    return (
        <>
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile menu button */}
            <div className="lg:hidden">
                <Button
                    variant="ghost"
                    size="sm"
                    className="fixed top-4 left-4 z-50"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    {sidebarOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <Menu className="h-6 w-6" />
                    )}
                </Button>
            </div>

            {/* Sidebar */}
            <div className={cn(
                'fixed top-0 left-0 z-40 h-screen w-64 transform bg-card shadow-lg transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-border',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                <div className="flex h-full flex-col">
                    {/* Logo */}
                    <div className="flex h-16 items-center justify-center border-b border-border">
                        <Link href="/saas-admin" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                            <div className="relative h-10 w-10">
                                <Image
                                    src="/calenvo-logo.png"
                                    alt="Calenvo"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div>
                                <span className="text-xl calenvo-gradient">Calenvo</span>
                                <span className="block text-xs text-muted-foreground">SaaS Admin</span>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="mr-3 h-5 w-5" />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Bottom section */}
                    <div className="border-t border-border p-4">
                        <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
                            <h3 className="text-sm font-medium text-foreground">
                                Painel Administrativo
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Gerenciamento global do SaaS
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
