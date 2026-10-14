import { SimplePage } from "@/components/simple-page";
import { PrimaryLink } from "@/components/ui";

export default function NotFound() {
  return (
    <SimplePage title="Page not found" intro="The page you're looking for doesn't exist or has moved.">
      <PrimaryLink href="/explore" className="self-start">Explore companions</PrimaryLink>
    </SimplePage>
  );
}
