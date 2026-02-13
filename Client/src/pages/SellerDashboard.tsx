import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Bell, Settings, Star, DollarSign, Users, Briefcase,
  TrendingUp, Calendar, MessageSquare, Plus, Clock, CheckCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const stats = [
  { icon: DollarSign, label: "Earnings", value: "$2,450", change: "+12%" },
  { icon: Users, label: "Clients", value: "48", change: "+5" },
  { icon: Briefcase, label: "Active Jobs", value: "7", change: "" },
  { icon: Star, label: "Rating", value: "4.9", change: "" },
];

const recentOrders = [
  { id: "1", client: "Mark T.", service: "Email Management", status: "in-progress", amount: "$75", dueDate: "Oct 25" },
  { id: "2", client: "Jessica L.", service: "Calendar Scheduling", status: "pending", amount: "$50", dueDate: "Oct 26" },
  { id: "3", client: "Robert K.", service: "Travel Booking", status: "completed", amount: "$120", dueDate: "Oct 23" },
];

const statusColors = {
  "in-progress": "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]",
  "pending": "bg-primary/20 text-primary",
  "completed": "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
};

const SellerDashboard = () => {
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary">
            <AvatarImage 
              src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop" 
              alt="Sarah Jenkins" 
            />
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Good morning,</p>
            <p className="font-semibold text-foreground">Sarah Jenkins</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="relative p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </button>
          <Link to="/settings" className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <Settings className="h-5 w-5 text-foreground" />
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                {stat.change && (
                  <span className="text-xs text-[hsl(var(--success))] flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="px-4 py-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <Button className="flex-1 gap-2" variant="default">
            <Plus className="h-4 w-4" />
            Create Gig
          </Button>
          <Button className="flex-1 gap-2" variant="secondary">
            <Calendar className="h-4 w-4" />
            Availability
          </Button>
          <Button className="flex-1 gap-2" variant="secondary">
            <MessageSquare className="h-4 w-4" />
            Messages
          </Button>
        </div>
      </section>

      {/* Recent Orders */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
          <Link to="/orders" className="text-sm text-primary hover:underline">
            View All
          </Link>
        </div>
        
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <Link 
              key={order.id}
              to={`/order/${order.id}`}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-card/80 transition-colors block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-sm font-semibold text-foreground">
                    {order.client.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{order.client}</p>
                  <p className="text-sm text-muted-foreground">{order.service}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{order.amount}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusColors[order.status as keyof typeof statusColors]}`}>
                  {order.status === "completed" ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('-', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Earnings Chart Placeholder */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Earnings Overview</h2>
          <select className="bg-secondary text-foreground text-sm rounded-lg px-3 py-1 border-none">
            <option>This Week</option>
            <option>This Month</option>
            <option>This Year</option>
          </select>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-end justify-between h-40">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-2">
                <div 
                  className="w-8 bg-primary/30 rounded-t transition-all hover:bg-primary"
                  style={{ height: `${[60, 80, 45, 100, 70, 40, 55][i]}%` }}
                />
                <span className="text-xs text-muted-foreground">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Deliveries */}
      <section className="px-4 py-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Deliveries</h2>
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Email Management - Mark T.</p>
              <p className="text-sm text-muted-foreground">Due in 2 hours</p>
            </div>
            <Button size="sm" variant="secondary">
              View
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellerDashboard;
