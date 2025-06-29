import Link from 'next/link';

export default function Navbar() {
  return (
    <header className = "fixed top-0 left-0 w-full bg-transparent z-50" >
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
        {/* App Name */}
        <Link
  href="/"
  className="
    text-4xl
    font-bold
    bg-gradient-to-r
    from-blue-400
    via-blue-500
    to-[#215198]
    bg-clip-text
    text-transparent
    hover:opacity-90
  "
>
  Fridger.ai
</Link>

        {/* Nav Links */}
        <nav>
          <Link
            href="/signin"
            className="mr-2 shadow-[inset_0_0_0_2px_#616467] text-black px-8 py-2 rounded-full tracking-widest uppercase font-bold bg-transparent hover:bg-[#616467] hover:text-white dark:text-neutral-200 transition duration-200"
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="shadow-[inset_0_0_0_2px_#616467] text-black px-8 py-2 rounded-full tracking-widest uppercase font-bold bg-transparent hover:bg-[#616467] hover:text-white dark:text-neutral-200 transition duration-200"
          >
            Sign Up
          </Link>
         
        </nav>
      </div>
    </header>
  );
}