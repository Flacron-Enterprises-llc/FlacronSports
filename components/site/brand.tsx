import Image from "next/image"
import Link from "next/link"

export function Logo({ reversed = false, href = "/" }: { reversed?: boolean; href?: string }) {
  return (
    <Link href={href} aria-label="FlacronSport home" className="inline-flex items-center gap-2.5 rounded-md">
      {reversed ? (
        <Image src="/brand/fs-mark-reversed.png" alt="" width={50} height={28} priority className="h-7 w-auto" />
      ) : (
        <>
          <Image src="/brand/fs-mark.png" alt="" width={50} height={28} priority className="h-7 w-auto dark:hidden" />
          <Image src="/brand/fs-mark-reversed.png" alt="" width={50} height={28} priority className="hidden h-7 w-auto dark:block" />
        </>
      )}
      <span className={`hidden whitespace-nowrap font-display min-[440px]:inline text-[15px] font-semibold tracking-[0.08em] ${reversed ? "text-white" : "text-navy dark:text-white"}`}>
        FLACRON<span className="text-orange">SPORT</span>
      </span>
    </Link>
  )
}
