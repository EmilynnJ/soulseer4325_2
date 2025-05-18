import { useQuery } from "@tanstack/react-query";
import { Reading } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistance } from "date-fns";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const statusColors = {
  scheduled: "bg-blue-500",
  waiting_payment: "bg-yellow-500",
  payment_completed: "bg-green-500",
  in_progress: "bg-purple-500",
  completed: "bg-green-700",
  cancelled: "bg-red-500",
};

export function ReadingHistory() {
  const { data: readings, isLoading } = useQuery<Reading[]>({
    queryKey: ["/api/readings/client"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <Card className="glow-card">
        <CardContent className="pt-6 text-center">
          <p>You haven't had any readings yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Group readings by status
  const upcomingReadings = readings.filter(
    (r) => r.status === "scheduled" || r.status === "payment_completed"
  );
  
  const activeReadings = readings.filter(
    (r) => r.status === "in_progress"
  );
  
  const pastReadings = readings.filter(
    (r) => r.status === "completed" || r.status === "cancelled"
  );

  return (
    <div className="space-y-8">
      {activeReadings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Active Readings</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {activeReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        </div>
      )}

      {upcomingReadings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Upcoming Readings</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {upcomingReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        </div>
      )}

      {pastReadings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Past Readings</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {pastReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadingCard({ reading }: { reading: Reading }) {
  const sessionDate = reading.scheduledFor 
    ? new Date(reading.scheduledFor)
    : reading.createdAt 
      ? new Date(reading.createdAt) 
      : new Date();

  return (
    <Card className="glow-card h-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <CardTitle className="text-lg break-words">{reading.notes || "General Reading"}</CardTitle>
          <Badge className={`${statusColors[reading.status]} whitespace-nowrap`}>
            {reading.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Type:</span>
            <span className="capitalize text-sm text-right">{reading.type}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Date:</span>
            <span className="text-sm text-right">{sessionDate.toLocaleDateString()}</span>
          </div>
          {reading.scheduledFor && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground text-sm">Time:</span>
              <span className="text-sm text-right">{new Date(reading.scheduledFor).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Duration:</span>
            <span className="text-sm text-right">{reading.duration || "-"} min</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Price:</span>
            <span className="text-sm text-right">{reading.totalPrice ? formatCurrency(reading.totalPrice / 100) : "-"}</span>
          </div>
          {reading.status === "completed" && reading.completedAt && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground text-sm">Completed:</span>
              <span className="text-sm text-right">{formatDistance(new Date(reading.completedAt), new Date(), { addSuffix: true })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}