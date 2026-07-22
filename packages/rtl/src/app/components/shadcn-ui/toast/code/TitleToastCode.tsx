import React from 'react'
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const TitleToastCode = () => {
  const { toast } = useToast();
  return (
    <>
    <div className='mt-4'>
      <Button
          variant="outline"
          onClick={() => {
            toast({
              title: "Uh oh! Something went wrong.",
              description: "There was a problem with your request.",
            });
          }}
        >
          Show Toast
        </Button>
    </div>
    </>
  )
}

export default TitleToastCode