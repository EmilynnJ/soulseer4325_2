import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { Product } from "@shared/schema";

type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  
  // Load cart from localStorage on initial load
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart data', error);
        localStorage.removeItem('cart');
      }
    }
  }, []);
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);
  
  const addToCart = (product: Product) => {
    setItems(currentItems => {
      // Check if product already exists in cart
      const existingItemIndex = currentItems.findIndex(
        item => item.product.id === product.id
      );
      
      if (existingItemIndex > -1) {
        // Product exists, update quantity
        const updatedItems = [...currentItems];
        updatedItems[existingItemIndex].quantity += 1;
        return updatedItems;
      } else {
        // Product doesn't exist, add new item
        return [...currentItems, { product, quantity: 1 }];
      }
    });
  };
  
  const removeFromCart = (productId: number) => {
    setItems(currentItems => 
      currentItems.filter(item => item.product.id !== productId)
    );
  };
  
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setItems(currentItems => 
      currentItems.map(item => 
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };
  
  const clearCart = () => {
    setItems([]);
  };
  
  // Calculate total item count
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  
  // Calculate total amount
  const totalAmount = items.reduce(
    (total, item) => total + (item.product.price * item.quantity), 
    0
  );
  
  return (
    <CartContext.Provider value={{
      items,
      itemCount,
      totalAmount,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}