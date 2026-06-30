

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { AppointmentsList } from '@/components/dashboard/appointments-list'

export default async function AppointmentsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-600 mt-1">
            Gerencie todos os seus agendamentos
          </p>
        </div>
      </div>
      
      <AppointmentsList />
    </div>
  )
}
