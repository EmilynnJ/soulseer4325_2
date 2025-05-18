import { useWebSocketContext } from "@/hooks/websocket-provider";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, WifiOff, AlertCircle } from "lucide-react";

export function WebSocketStatus() {
  // Default state values
  const [wsContext, setWsContext] = useState<any>({
    status: 'closed',
    sendMessage: () => console.log('WebSocketProvider not available'),
    lastMessage: null,
    reconnect: () => console.log('WebSocketProvider not available')
  });
  
  // Try to use WebSocketContext if available
  useEffect(() => {
    try {
      const context = require('@/hooks/websocket-provider').useWebSocketContext();
      setWsContext(context);
    } catch (error) {
      console.log('WebSocketProvider not available, using fallback');
    }
  }, []);
  
  // Destructure the context values
  const { status, sendMessage, lastMessage, reconnect } = wsContext;
  const [pingTime, setPingTime] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handlePing = () => {
    if (status !== 'open') return;
    
    setIsPinging(true);
    const start = Date.now();
    setPingTime(null);
    
    sendMessage({ type: 'ping', timestamp: start });
    
    // Safety timeout in case we don't get a response
    setTimeout(() => {
      setIsPinging(false);
    }, 5000);
  };

  useEffect(() => {
    if (!lastMessage) return;
    
    if (lastMessage.type === 'pong') {
      const end = Date.now();
      const start = lastMessage.timestamp;
      setPingTime(end - start);
      setIsPinging(false);
    }
  }, [lastMessage]);

  return (
    <div className="fixed bottom-4 right-4 bg-dark/80 backdrop-blur-sm p-4 rounded-lg border border-accent/30 shadow-lg z-50">
      <div className="flex flex-col space-y-2 text-light">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-cinzel">Spirit Connection:</span>
          <StatusBadge status={status} />
        </div>
        
        {lastMessage && (
          <div className="text-xs font-playfair text-light/70 max-w-[200px] truncate">
            Last message: {lastMessage.type}
          </div>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handlePing}
            disabled={status !== 'open' || isPinging}
            className="text-accent border-accent/50 hover:bg-accent/20 font-playfair text-xs"
          >
            {isPinging ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                <span>Sensing...</span>
              </>
            ) : (
              <span>Test Energy</span>
            )}
          </Button>
          
          {status !== 'open' && status !== 'connecting' && (
            <Button
              size="sm"
              variant="outline"
              onClick={reconnect}
              className="text-secondary border-secondary/50 hover:bg-secondary/20 font-playfair text-xs"
            >
              Reconnect
            </Button>
          )}
          
          {pingTime !== null && (
            <span className="text-xs font-playfair text-accent">{pingTime}ms</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connecting':
      return (
        <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/50 font-playfair">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          <span>Connecting</span>
        </Badge>
      );
    case 'open':
      return (
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/50 font-playfair">
          <Radio className="h-3 w-3 mr-1 animate-pulse" />
          <span>Connected</span>
        </Badge>
      );
    case 'closed':
      return (
        <Badge variant="outline" className="bg-light/10 text-light/70 border-light/30 font-playfair">
          <WifiOff className="h-3 w-3 mr-1" />
          <span>Disconnected</span>
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/50 font-playfair">
          <AlertCircle className="h-3 w-3 mr-1" />
          <span>Error</span>
        </Badge>
      );
    default:
      return null;
  }
}