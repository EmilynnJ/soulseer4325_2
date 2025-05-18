import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, X, Check, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
  currentBalance?: number;
}

const PRESET_AMOUNTS = [10, 20, 50, 100];

export default function AddFundsModal({
  isOpen,
  onClose,
  onSuccess,
  currentBalance = 0
}: AddFundsModalProps) {
  const [amount, setAmount] = useState<number>(20);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustomAmount, setIsCustomAmount] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [paymentStep, setPaymentStep] = useState<'amount' | 'payment' | 'success'>('amount');
  const [stripeClientSecret, setStripeClientSecret] = useState<string>('');
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount(20);
      setCustomAmount('');
      setIsCustomAmount(false);
      setError('');
      setPaymentStep('amount');
    }
  }, [isOpen]);

  // Handle preset amount selection
  const handleSelectAmount = (value: number) => {
    setAmount(value);
    setIsCustomAmount(false);
    setError('');
  };

  // Handle custom amount change
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and decimal points
    if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
      setCustomAmount(value);
      
      if (value !== '') {
        const parsedValue = parseFloat(value);
        if (!isNaN(parsedValue)) {
          setAmount(parsedValue);
        }
      }
    }
  };

  // Handle continue to payment
  const handleContinueToPayment = async () => {
    // Validate amount
    if (amount <= 0) {
      setError('Please enter a valid amount greater than $0.');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // Create a payment intent with Stripe
      const response = await axios.post('/api/webrtc/client/add-funds', {
        amount
      });
      
      setStripeClientSecret(response.data.clientSecret);
      setPaymentStep('payment');
    } catch (err) {
      console.error('Error creating payment intent:', err);
      setError('Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = () => {
    setPaymentStep('success');
    
    if (onSuccess) {
      onSuccess(amount);
    }
  };

  // Modal content based on payment step
  const renderContent = () => {
    switch (paymentStep) {
      case 'amount':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Add Funds to Your Account</h2>
              <p className="text-gray-300">
                Add money to your balance to pay for readings and premium messages.
              </p>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-900 text-white rounded-lg">
                {error}
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-gray-400 mb-2">Current Balance</label>
              <div className="bg-gray-700 p-3 rounded-lg">
                <p className="text-xl font-medium text-green-400 flex items-center">
                  <DollarSign size={24} className="mr-1" />
                  {currentBalance.toFixed(2)}
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-400 mb-2">Select Amount</label>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_AMOUNTS.map(value => (
                  <button
                    key={value}
                    onClick={() => handleSelectAmount(value)}
                    className={`p-3 rounded-lg font-medium ${
                      amount === value && !isCustomAmount
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    ${value.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="flex items-center text-gray-400 mb-2">
                <input
                  type="checkbox"
                  checked={isCustomAmount}
                  onChange={() => setIsCustomAmount(!isCustomAmount)}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 mr-2"
                />
                <span>Custom Amount</span>
              </label>
              
              {isCustomAmount && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <DollarSign size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    placeholder="0.00"
                    className="bg-gray-700 border border-gray-600 text-white rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueToPayment}
                disabled={isProcessing || amount <= 0}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  isProcessing || amount <= 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white transition-colors`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </>
        );
        
      case 'payment':
        return (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Payment Information</h2>
              <p className="text-gray-300">
                Complete your payment to add ${amount.toFixed(2)} to your account balance.
              </p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg mb-6">
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Card Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <CreditCard size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="bg-gray-600 border border-gray-600 text-white rounded-lg block w-full pl-10 p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Expiration Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="bg-gray-600 border border-gray-600 text-white rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="bg-gray-600 border border-gray-600 text-white rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Name on Card</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="bg-gray-600 border border-gray-600 text-white rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-300">Amount to Add:</span>
                <span className="text-white font-medium">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">New Balance:</span>
                <span className="text-green-400 font-medium">${(currentBalance + amount).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setPaymentStep('amount')}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePaymentSuccess}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center"
              >
                <DollarSign size={18} className="mr-2" />
                Pay ${amount.toFixed(2)}
              </button>
            </div>
          </>
        );
        
      case 'success':
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={30} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-300 mb-6">
              ${amount.toFixed(2)} has been added to your account balance.
            </p>
            <div className="bg-gray-700 p-3 rounded-lg mb-6 inline-block mx-auto">
              <div className="flex items-center justify-center">
                <span className="text-gray-300 mr-2">New Balance:</span>
                <span className="text-green-400 font-medium text-xl flex items-center">
                  <DollarSign size={20} className="mr-1" />
                  {(currentBalance + amount).toFixed(2)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
        
        {renderContent()}
      </div>
    </div>
  );
} 