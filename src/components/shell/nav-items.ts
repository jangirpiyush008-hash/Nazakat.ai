import { Compass, Gem, Home, MessageCircle, Settings, Wand2, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; premium?: boolean };

/** /app routes need an account; middleware sends signed-out visitors to log in first. */
export const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Discover", href: "/explore", icon: Compass },
  { label: "Chats", href: "/app/chat", icon: MessageCircle },
  { label: "Create companion", href: "/create", icon: Wand2 },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Plus", href: "/pricing", icon: Gem, premium: true },
];
