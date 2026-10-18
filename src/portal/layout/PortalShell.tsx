import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

const PortalShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col bg-background">
    <header className="border-b border-border h-14 flex items-center px-4">
      <Link to="/portal" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-heading font-semibold text-sm">Blue Sky Parent Portal</span>
      </Link>
    </header>
    <main className="flex-1 p-6 max-w-3xl w-full mx-auto">{children}</main>
  </div>
);

export default PortalShell;
