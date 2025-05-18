import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";

export function AccountBalance() {
  const { user } = useAuth();
  
  const balance = user?.accountBalance || 0;
  
  return (
    <Card className="glow-card">
      <CardHeader>
        <CardTitle>Your Balance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold mb-4 gold-gradient">{formatCurrency(balance)}</div>
          <Link href="/add-funds">
            <Button variant="default" className="w-full">Add Funds</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}