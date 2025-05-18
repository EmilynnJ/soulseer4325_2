import { DashboardLayout } from "./dashboard-layout";
import { ReadingHistory } from "./reading-history";
import { AccountBalance } from "./account-balance";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CalendarClock, MessageCircle, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientDashboard() {
  return (
    <DashboardLayout title="Client Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <Card className="glow-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/readings/new">
                  <Button className="w-full" variant="default">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat Reading
                  </Button>
                </Link>
                <Link href="/readings/new?type=voice">
                  <Button className="w-full" variant="default">
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Voice Reading
                  </Button>
                </Link>
                <Link href="/readings/new?type=video">
                  <Button className="w-full" variant="default">
                    <Video className="mr-2 h-4 w-4" />
                    Video Reading
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-1">
          <AccountBalance />
        </div>
      </div>
      
      <ReadingHistory />
    </DashboardLayout>
  );
}