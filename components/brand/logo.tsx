interface LogoIconProps {
  size?: number
  gradientId?: string
}

export function LogoIcon({ size = 40, gradientId = 'calenvo_grad' }: LogoIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="52" height="52" rx="13" fill={`url(#${gradientId})`}></rect>
      <rect x="11" y="14" width="30" height="4" rx="2" fill="white" opacity="0.35"></rect>
      <circle cx="18" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
      <circle cx="26" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
      <circle cx="34" cy="27" r="2.5" fill="white" opacity="0.45"></circle>
      <circle cx="18" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
      <circle cx="26" cy="35" r="4" fill="white"></circle>
      <path d="M23.8 35l1.6 1.7 2.8-3" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <circle cx="34" cy="35" r="2.5" fill="white" opacity="0.45"></circle>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6"></stop>
          <stop offset="100%" stopColor="#5B21B6"></stop>
        </linearGradient>
      </defs>
    </svg>
  )
}

interface LogoProps {
  size?: number
  gradientId?: string
  textClassName?: string
}

export function Logo({ size = 40, gradientId = 'calenvo_grad', textClassName = 'text-xl font-bold text-gray-900' }: LogoProps) {
  return (
    <div className="flex items-center space-x-2">
      <LogoIcon size={size} gradientId={gradientId} />
      <span className={textClassName}>Calenvo</span>
    </div>
  )
}
