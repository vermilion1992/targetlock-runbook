"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Icon } from "@iconify/react";
const SettingsCard = () => {
  const [switch1, setSwitch1] = useState(false);
  return (
    <>
      <Card>
        <h5 className="card-title">Settings</h5>
        <div className="flex  gap-3 mt-3 border-b border-ld pb-4">
          <div>
            <div className="h-12 w-12 rounded-md bg-primary flex justify-center items-center text-white">
              <Icon icon="solar:volume-loud-outline" height={20} />
            </div>
          </div>
          <div className="w-full">
            <div className="flex justify-between items-center pb-2">
              <h6 className="text-base">Sound</h6>
              <p className="text-sm text-darklink">45%</p>
            </div>
            <Progress
              color="primary"
              value={45}
            />
          </div>
        </div>
        <div className="flex  gap-3 mt-2 border-b border-ld items-center pb-4">
          <div>
            <div className="h-12 w-12 rounded-md bg-secondary flex justify-center items-center text-white">
              <Icon icon="tabler:message-2" height={20} />
            </div>
          </div>
          <div className="w-full">
            <div className="flex justify-between items-center">
              <div>
                <h6 className="text-base">Chat</h6>
                <p>Turn on chat during call%</p>
              </div>
              <Switch
                checked={switch1}
                onCheckedChange={setSwitch1}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant={'lighterror'}>Cancel</Button>
          <Button>Save</Button>
        </div>
      </Card>
    </>
  );
};

export default SettingsCard;
