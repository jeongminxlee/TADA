import type { SVGProps } from "react";

/**
 * A single soft, hand-drawn leaf with a central vein.
 * Uses currentColor so callers can theme it via text-* utilities.
 */
export function Leaf({
  className,
  veinClassName = "text-background/50",
  ...props
}: SVGProps<SVGSVGElement> & { veinClassName?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      {...props}
    >
      {/* leaf body */}
      <path
        d="M20.5 3.5C20.5 3.5 8.2 2.5 4.8 9.2c-2.8 5.4.7 11 6.3 11.3 5.1.3 9.6-3.7 10.1-9.1.2-2.8-.7-7.9-.7-7.9Z"
        fill="currentColor"
      />
      {/* central vein */}
      <path
        d="M19.5 4.5C16.5 7.5 13.5 11 11 14.5c-1.5 2-2.7 4-3.7 6"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
        className={veinClassName}
      />
    </svg>
  );
}

/**
 * TADA logo mark — two crossed leaves forming a sprig,
 * warm leaf-green primary with a peachy accent leaf.
 */
export function LogoMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      {...props}
    >
      {/* stem */}
      <path
        d="M24 44C24 36 24 28 24 18"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-primary"
      />
      {/* right (accent) leaf */}
      <path
        d="M24 24c2-7 8-10 16-9 .8 5-1.5 11-6.5 13.4-4.8 2.3-9-.4-9.5-4.4Z"
        className="fill-accent"
      />
      <path
        d="M26 25c3-3 7-5 13-6"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="text-accent-foreground"
      />
      {/* left (primary) leaf — larger, in front */}
      <path
        d="M24 30C22 19 14 12 4 12c-1 7 2.5 14 9 16.4 5.7 2 10.4-1 11-4.4Z"
        className="fill-primary"
      />
      <path
        d="M22 28c-4-3-9-5-16-6"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.3"
        strokeLinecap="round"
        className="text-primary-foreground"
      />
      {/* berry / focal dot */}
      <circle cx="24" cy="20" r="2.4" className="fill-accent" />
      <circle cx="24" cy="20" r="0.9" className="fill-accent-foreground/60" />
    </svg>
  );
}