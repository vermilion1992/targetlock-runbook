import React from 'react'
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";

const DestrictiveToastCode = () => {
   const { toast } = useToast();
  return (
    <>
    <div className="mt-4">
      <Button
          variant="outline"
          onClick={() => {
            toast({
              variant: "destructive",
              title: "Uh oh! Something went wrong.",
              description: "There was a problem with your request.",
              action: <ToastAction altText="Try again">Try again</ToastAction>,
            });
          }}
        >
          Show Toast
        </Button>
    </div>
    </>
  )
}

export default DestrictiveToastCode