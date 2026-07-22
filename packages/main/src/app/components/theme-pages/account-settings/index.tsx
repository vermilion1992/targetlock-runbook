"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Icon } from "@iconify/react";
import AccountTab from "@/app/components/theme-pages/account-settings/AccountTab";
import NotificationTab from "@/app/components/theme-pages/account-settings/NotificationTab";
import BillsTabs from "@/app/components/theme-pages/account-settings/BillsTab";
import SecurityTab from "@/app/components/theme-pages/account-settings/SecurityTab";

const AccountSettingIndex = () => {
  return (
    <Card className="px-0 py-0">
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="w-full justify-start pl-4">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Icon icon="tabler:user-circle" height={20} />
            Account
          </TabsTrigger>
          <TabsTrigger value="notification" className="flex items-center gap-2">
            <Icon icon="tabler:bell" height={20} />
            Notification
          </TabsTrigger>
          <TabsTrigger value="bills" className="flex items-center gap-2">
            <Icon icon="tabler:article" height={20} />
            Bills
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Icon icon="tabler:lock" height={20} />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="p-6">
          <AccountTab />
        </TabsContent>
        <TabsContent value="notification" className="p-6">
          <NotificationTab />
        </TabsContent>
        <TabsContent value="bills" className="p-6">
          <BillsTabs />
        </TabsContent>
        <TabsContent value="security" className="p-6">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AccountSettingIndex;
