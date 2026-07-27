import Image from "next/image";
import Link from "next/link";

interface TargetLockBrandProps {
  href: string;
  ariaLabel?: string;
}

export function TargetLockBrand({
  href,
  ariaLabel = "TargetLock home",
}: TargetLockBrandProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex min-w-11 shrink-0 items-center gap-2 rounded-lg text-[var(--tl-ink)] no-underline"
    >
      <Image
        src="/images/logos/targetlock-mark.svg"
        alt=""
        width={36}
        height={36}
        priority
        className="size-9 shrink-0"
      />
      <span className="hidden text-base font-bold tracking-[-0.02em] min-[1025px]:inline">
        Target<span className="text-[var(--tl-primary)]">Lock</span>
      </span>
    </Link>
  );
}
