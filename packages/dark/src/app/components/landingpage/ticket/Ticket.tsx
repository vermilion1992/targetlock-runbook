import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const Ticket = () => {
  return (
    <>
      <div className="bg-white dark:bg-dark">
        <div className="container">
          <div
            className="lg:w-2/4 w-full mx-auto"
            data-aos="fade-up"
            data-aos-delay="1000"
            data-aos-duration="1000"
          >
            <Card className="bg-no-repeat bg-center bg-[url('/images/landingpage/shape/line-bg.svg')]">
              <div className="pb-4 text-center">
                <h3 className="text-2xl">
                  Haven't found an answer to your question?
                </h3>
                <div className="sm:flex justify-center gap-4 mt-8">
                  <Button
                    asChild
                  >
                    <Link href="https://tailwind-admin.com/support" target="_blank">
                      Submit Ticket
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Ticket;
