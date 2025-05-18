import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { CelestialButton } from '@/components/ui/celestial-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Wallet, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StripeCheckout } from '@/components/payments/stripe-checkout';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function AddFundsPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState<number>(0);
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  
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
        title: 'Payment Successful',
        description: `Your account has been credited with ${formatCurrency(data.newBalance)}`,
      });
      setLocation('/dashboard');
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
  
  const handleProceedToPayment = () => {
    if (!amount || amount < 5) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount of $5 or more.',
        variant: 'destructive',
      });
      return;
    }
    
    createPaymentIntentMutation.mutate(amount);
  };
  
  const handlePaymentSuccess = (paymentIntentId: string) => {
    confirmFundsMutation.mutate(paymentIntentId);
  };
  
  const handleCancel = () => {
    setShowStripeCheckout(false);
  };
  
  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };
  
  return (
    <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
      <div className="flex items-center gap-2 mb-8">
        <Button variant="ghost" onClick={() => setLocation('/dashboard')} className="p-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-alex text-center">Add Funds to Your Account</h1>
      </div>
      
      <div className="max-w-md mx-auto">
        <Card className="cosmic-bg glow-card">
          <CardHeader>
            <CardTitle className="font-cinzel text-2xl flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Add Funds
            </CardTitle>
            <CardDescription className="font-playfair">
              Add money to your account to use for psychic readings
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {!showStripeCheckout ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="font-cinzel">Amount to Add (USD)</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      min="5"
                      step="1"
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value))}
                      className="pl-8"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Minimum deposit: $5.00</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[10, 20, 50].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      onClick={() => setAmount(preset)}
                      className={amount === preset ? 'border-primary' : ''}
                    >
                      ${preset}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <StripeCheckout 
                amount={Math.floor(amount * 100)}
                onSuccess={handlePaymentSuccess}
                onCancel={handleCancel}
              />
            )}
          </CardContent>
          
          {!showStripeCheckout && (
            <CardFooter>
              <CelestialButton 
                className="w-full"
                onClick={handleProceedToPayment} 
                disabled={createPaymentIntentMutation.isPending || !amount || amount < 5}
              >
                {createPaymentIntentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Continue to Payment
                  </>
                )}
              </CelestialButton>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}