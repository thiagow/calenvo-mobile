
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { SaasAdminSidebar } from '@/components/saas-admin/saas-admin-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export default async function SaasAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)

    // Verificar autenticação
    if (!session) {
        redirect('/login')
    }

    // Verificar se é SAAS_ADMIN
    const userRole = (session.user as any)?.role
    if (userRole !== 'SAAS_ADMIN') {
        redirect('/dashboard')
    }

    const sessionData = {
        user: {
            name: session.user?.name,
            email: session.user?.email,
            planType: 'PREMIUM',
            clinicName: 'SaaS Admin'
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <SaasAdminSidebar />

            <div className="flex flex-1 flex-col overflow-hidden lg:ml-64">
                <DashboardHeader sessionData={sessionData} />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
