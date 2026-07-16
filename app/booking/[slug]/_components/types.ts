export interface BookingService {
  id: string
  name: string
  description: string | null
  duration: number
  price: number | null
  category: string | null
}

export interface BookingProfessional {
  id: string
  name: string | null
  image: string | null
}

export interface BookingTimeSlot {
  time: string
  available: boolean
}
