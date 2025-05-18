import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiRequest } from '@/lib/queryClient';
import { Wallet, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StripeCheckout } from '@/components/payments/stripe-checkout';

export function AccountBalance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState<number>(0);
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  
  // Fetch the current account balance
  const { data: balance, isLoading } = useQuery<{
    balance: number;
    formatted: string;
  }>({
    queryKey: ['/api/user/balance'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Handle confirming funds added via Stripe
  const confirmFundsMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await apiRequest('POST', '/api/user/confirm-funds', {
        paymentIntentId
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
      toast({
        title: 'Funds Added',
        description: `Your account has been credited. New balance: ${data.formatted}`,
      });
      setAddFundsOpen(false);
      setShowStripeCheckout(false);
      setFundAmount(0);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add funds to your account.',
        variant: 'destructive',
      });
    }
  });
  
  // Create payment intent to add funds
  const createPaymentIntentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const amountInCents = Math.floor(amount * 100);
      const response = await apiRequest('POST', '/api/user/add-funds', {
        amount: amountInCents
      });
      return response.json();
    },
    onSuccess: () => {
      setShowStripeCheckout(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create payment.',
        variant: 'destructive',
      });
    }
  });
  
  const handleAddFunds = () => {
    if (!fundAmount || fundAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }
    
    createPaymentIntentMutation.mutate(fundAmount);
  };
  
  const handlePaymentSuccess = (paymentIntentId: string) => {
    confirmFundsMutation.mutate(paymentIntentId);
  };
  
  const handleCloseDialog = () => {
    setAddFundsOpen(false);
    setShowStripeCheckout(false);
    setFundAmount(0);
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-20">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Account Balance
        </CardTitle>
        <CardDescription>
          Your current account balance for psychic readings
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="text-3xl font-bold text-primary">
          {balance?.formatted || '$0.00'}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Used for pay-per-minute readings and premium services
        </p>
      </CardContent>
      
      <CardFooter>
        <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Funds
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Funds to Your Account</DialogTitle>
              <DialogDescription>
                Add money to your account balance to use for readings and premium features.
              </DialogDescription>
            </DialogHeader>
            
            {!showStripeCheckout ? (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount to Add (USD)</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <span className="text-gray-500">$</span>
                      </div>
                      <Input
                        id="amount"
                        type="number"
                        min="5"
                        step="5"
                        value={fundAmount || ''}
                        onChange={(e) => setFundAmount(parseFloat(e.target.value))}
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 20, 50].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        onClick={() => setFundAmount(amount)}
                        className={fundAmount === amount ? 'border-primary' : ''}
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddFunds} 
                    disabled={createPaymentIntentMutation.isPending || !fundAmount || fundAmount <= 0}
                  >
                    {createPaymentIntentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Continue to Payment'
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="py-4">
                <StripeCheckout 
                  amount={Math.floor(fundAmount * 100)}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleCloseDialog}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}