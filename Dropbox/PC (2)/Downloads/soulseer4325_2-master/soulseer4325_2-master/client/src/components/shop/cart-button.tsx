import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { CartDrawer } from "./cart-drawer";
import { Button } from "@/components/ui/button";

export function CartButton() {
  const { itemCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsCartOpen(true)}
        className="relative text-light/80 hover:text-accent hover:bg-transparent"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-primary-dark text-xs flex items-center justify-center rounded-full h-4 w-4 font-bold">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </Button>
      
      <CartDrawer 
        open={isCartOpen} 
        onOpenChange={setIsCartOpen} 
      />
    </>
  );
}