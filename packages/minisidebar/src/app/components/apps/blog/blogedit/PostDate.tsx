"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState, useContext, useEffect } from "react";
import { BlogContext } from "@/app/context/blog-context";
// ShadCN UI Date Picker components
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

const PostDate = () => {
  const { posts } = useContext(BlogContext);

  const [publishDate, setPublishDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (posts.length > 0 && posts[0].createdAt) {
      setPublishDate(new Date(posts[0].createdAt));
    }
  }, [posts]);

  return (
    <Card>
      <h5 className="card-title mb-4">Publish Date</h5>
      <div>
        <div className="mb-2 block">
          <Label htmlFor="publishDate">Select publish date</Label>
          <span className="text-error ms-1">*</span>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !publishDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {publishDate ? (
                format(publishDate, "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={publishDate}
              onSelect={setPublishDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <small className="text-xs text-dark dark:text-darklink">
          Choose the date when this blog post should be published.
        </small>
      </div>
    </Card>
  );
};

export default PostDate;
