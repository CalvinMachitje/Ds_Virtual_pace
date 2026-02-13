import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardHeaderProps {
  userName: string;
  userAvatar?: string;
}

const DashboardHeader = ({ userName, userAvatar }: DashboardHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-primary">
          <AvatarImage src={userAvatar} alt={userName} />
          <AvatarFallback className="bg-secondary text-foreground">
            {userName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="font-semibold text-foreground">{userName}</p>
        </div>
      </div>
      <button className="relative p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
        <Bell className="h-5 w-5 text-foreground" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      </button>
    </header>
  );
};

export default DashboardHeader;
