import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { GlowCard } from "@/components/ui/glow-card";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart } from "lucide-react";

export function ShopSection() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/featured"],
  });
  
  const { toast } = useToast();
  
  const handleAddToCart = (product: Product) => {
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`
    });
  };
  
  return (
    <div className="mb-14">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl md:text-3xl font-alex-brush text-secondary">Featured Products</h2>
        <Link href={PATHS.SHOP} className="text-accent hover:text-accent-dark transition duration-300 flex items-center font-playfair text-sm">
          Visit Shop
          <svg
            className="ml-1 h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </Link>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, index) => (
            <GlowCard key={index} className="p-0 rounded-lg overflow-hidden">
              <Skeleton className="h-28 w-full" />
              <div className="p-2">
                <Skeleton className="h-3 w-3/4 mb-1" />
                <Skeleton className="h-3 w-1/4 mb-2" />
                <Skeleton className="h-7 w-full rounded-full" />
              </div>
            </GlowCard>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {products.slice(0, 6).map((product) => (
            <GlowCard key={product.id} className="rounded-lg overflow-hidden p-0">
              <div className="h-28 overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover hover:scale-105 transition duration-500"
                />
              </div>
              
              <div className="p-2">
                <h3 className="text-sm font-cinzel text-secondary truncate">{product.name}</h3>
                <p className="text-accent font-semibold mb-2 text-xs font-playfair">${(product.price / 100).toFixed(2)}</p>
                
                <CelestialButton
                  variant="gold"
                  size="sm"
                  className="w-full text-primary-dark text-xs py-1"
                  onClick={() => handleAddToCart(product)}
                >
                  <ShoppingCart className="mr-1 h-3 w-3" />
                  Add to Cart
                </CelestialButton>
              </div>
            </GlowCard>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-light/70 font-playfair">No featured products available right now.</p>
          
          <Link href={PATHS.SHOP} className="mt-4 inline-block">
            <CelestialButton variant="secondary">
              Browse All Products
            </CelestialButton>
          </Link>
        </div>
      )}
    </div>
  );
}
