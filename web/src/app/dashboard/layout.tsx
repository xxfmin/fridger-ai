"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody } from "@/components/dashboard/sidebar";
import {
  IconMessageCircleSearch,
  IconBookmark,
  IconFridge,
  IconUser,
  IconArrowLeft,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    {
      label: "Recipe Agent",
      href: "/dashboard",
      icon: (
        <IconMessageCircleSearch className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "My Recipes",
      href: "/dashboard/my-recipes",
      icon: (
        <IconBookmark className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];

  const handleLogout = async () => {
    await signOut({
      callbackUrl: "/signin",
      redirect: true,
    });
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden md:flex-row flex-col">
      <Sidebar open={open} setOpen={setOpen} animate={false}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo onLogoClick={() => handleNavigation("/dashboard")} />
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  onClick={() => handleNavigation(link.href)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800",
                    pathname === link.href &&
                      "bg-neutral-300 dark:bg-neutral-700"
                  )}
                >
                  {link.icon}
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {link.label}
                  </span>
                </div>
              ))}

              {/* Logout button */}
              <div
                onClick={handleLogout}
                className="flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
              >
                <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Logout
                </span>
              </div>
            </div>
          </div>

          <div
            onClick={() => handleNavigation("/dashboard/account")}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
              pathname === "/dashboard/account" &&
                "bg-neutral-200 dark:bg-neutral-700"
            )}
          >
            <IconUser className="h-7 w-7 shrink-0 rounded-full text-neutral-700 dark:text-neutral-200" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              User Account
            </span>
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex-1 w-full min-w-0">{children}</div>
    </div>
  );
}

const Logo = ({ onLogoClick }: { onLogoClick: () => void }) => {
  return (
    <div
      onClick={onLogoClick}
      className="relative z-20 flex items-center space-x-1 py-1 text-sm font-normal text-black cursor-pointer"
    >
      <IconFridge className="h-10 w-10 shrink-0 text-neutral-700 dark:text-neutral-200" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold whitespace-pre text-black text-xl dark:text-white"
      >
        Fridger.ai
      </motion.span>
    </div>
  );
};
