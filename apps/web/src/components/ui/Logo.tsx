export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      role="img"
      aria-label="Clinic Appointments"
    >
      <rect width="28" height="28" rx="7" fill="var(--color-brand)" />
      <rect x="6" y="7.5" width="16" height="14" rx="2.5" fill="white" fillOpacity="0.16" />
      <line x1="6" y1="11.5" x2="22" y2="11.5" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="10.5" y1="6" x2="10.5" y2="9" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="17.5" y1="6" x2="17.5" y2="9" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M14 13.75v5M11.5 16.25h5"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
