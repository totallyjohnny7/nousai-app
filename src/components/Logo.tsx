export default function NousLogo({
  size = 32,
  showText = false,
  className = '',
}: {
  size?: number
  showText?: boolean
  className?: string
}) {
  const id = `nous-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <span
      className={`nousai-logo-mark ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Pulse glow filter */}
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Rounded square background */}
        <rect x="2" y="2" width="60" height="60" rx="16" fill="var(--text-primary)" />

        {/* Connections — drawn with dash animation */}
        {/* Main spokes to center */}
        <line x1="24" y1="21" x2="28" y2="27" stroke="var(--bg-primary)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1.2s" begin="0.1s" fill="freeze" />
        </line>
        <line x1="40" y1="21" x2="36" y2="27" stroke="var(--bg-primary)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1.2s" begin="0.2s" fill="freeze" />
        </line>
        <line x1="22" y1="38" x2="28" y2="33" stroke="var(--bg-primary)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="12" strokeDashoffset="12">
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1.2s" begin="0.3s" fill="freeze" />
        </line>
        <line x1="42" y1="38" x2="36" y2="33" stroke="var(--bg-primary)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="12" strokeDashoffset="12">
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1.2s" begin="0.4s" fill="freeze" />
        </line>
        <line x1="32" y1="44" x2="32" y2="35" stroke="var(--bg-primary)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1.2s" begin="0.5s" fill="freeze" />
        </line>

        {/* Secondary cross connections */}
        <line x1="20" y1="23" x2="18" y2="36" stroke="var(--bg-primary)" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" strokeDasharray="14" strokeDashoffset="14">
          <animate attributeName="opacity" from="0" to="0.4" dur="0.6s" begin="0.8s" fill="freeze" />
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="1s" begin="0.8s" fill="freeze" />
        </line>
        <line x1="44" y1="23" x2="46" y2="36" stroke="var(--bg-primary)" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" strokeDasharray="14" strokeDashoffset="14">
          <animate attributeName="opacity" from="0" to="0.4" dur="0.6s" begin="0.9s" fill="freeze" />
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="1s" begin="0.9s" fill="freeze" />
        </line>
        <line x1="22" y1="43" x2="28" y2="48" stroke="var(--bg-primary)" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="opacity" from="0" to="0.4" dur="0.6s" begin="1s" fill="freeze" />
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" begin="1s" fill="freeze" />
        </line>
        <line x1="42" y1="43" x2="36" y2="48" stroke="var(--bg-primary)" strokeWidth="1.5" strokeLinecap="round"
          opacity="0" strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="opacity" from="0" to="0.4" dur="0.6s" begin="1.1s" fill="freeze" />
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" begin="1.1s" fill="freeze" />
        </line>

        {/* Central node — fades in + pulse */}
        <circle cx="32" cy="30" r="5" fill="var(--bg-primary)" filter={`url(#${id}-glow)`} opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0s" fill="freeze" />
          <animate attributeName="r" values="5;6;5" dur="3s" begin="1.5s" repeatCount="indefinite" />
        </circle>

        {/* Outer nodes — staggered fade-in + ongoing subtle pulse */}
        <circle cx="20" cy="19" r="3.5" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.2s" fill="freeze" />
          <animate attributeName="r" values="3.5;4.2;3.5" dur="3s" begin="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="44" cy="19" r="3.5" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.35s" fill="freeze" />
          <animate attributeName="r" values="3.5;4.2;3.5" dur="3s" begin="2.1s" repeatCount="indefinite" />
        </circle>
        <circle cx="18" cy="40" r="3.5" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.5s" fill="freeze" />
          <animate attributeName="r" values="3.5;4.2;3.5" dur="3s" begin="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="46" cy="40" r="3.5" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.65s" fill="freeze" />
          <animate attributeName="r" values="3.5;4.2;3.5" dur="3s" begin="2.7s" repeatCount="indefinite" />
        </circle>
        <circle cx="32" cy="48" r="3.5" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.8s" fill="freeze" />
          <animate attributeName="r" values="3.5;4.2;3.5" dur="3s" begin="3s" repeatCount="indefinite" />
        </circle>

        {/* Spark at top — pulses */}
        <path d="M32 10l2 3-2 3-2-3z" fill="var(--bg-primary)" opacity="0">
          <animate attributeName="opacity" values="0;0.6;0" dur="2.5s" begin="1.5s" repeatCount="indefinite" />
        </path>
      </svg>

      {showText && (
        <span
          style={{
            fontSize: size * 0.44,
            fontWeight: 800,
            letterSpacing: size * 0.08,
            textTransform: 'uppercase' as const,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          NOUSAI
        </span>
      )}
    </span>
  )
}
