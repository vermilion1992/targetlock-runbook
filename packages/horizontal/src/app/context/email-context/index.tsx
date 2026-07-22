"use client";

import React, {
  createContext,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { EmailType } from "@/app/(DashboardLayout)/types/apps/email";
import useSWR from "swr";
import { deleteFetcher, getFetcher } from "@/app/api/global-fetcher";

interface EmailContextType {
  emails: EmailType[];
  selectedEmail: EmailType | null;
  setSelectedEmailId: Dispatch<SetStateAction<number | null>>;
  deleteEmail: (emailId: number) => void;
  toggleStar: (emailId: number) => void;
  toggleImportant: (emailId: number) => void;
  setFilter: Dispatch<SetStateAction<string>>;
  filter: string;
  searchQuery: string;
  loading: boolean;
  error: string | null | Error;
  setSearchQuery: Dispatch<SetStateAction<string>>;
}

const initialEmailContext: EmailContextType = {
  emails: [],
  selectedEmail: null,
  filter: "inbox",
  searchQuery: "",
  loading: true,
  error: null,
  setSelectedEmailId: () => {},
  deleteEmail: () => {},
  toggleStar: () => {},
  toggleImportant: () => {},
  setFilter: () => {},
  setSearchQuery: () => {},
};

export const EmailContext =
  createContext<EmailContextType>(initialEmailContext);

export const EmailContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [emails, setEmails] = useState<EmailType[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("inbox");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null | Error>(null);

  const {
    data: emailData,
    isLoading: isEmailLoading,
    error: emailError,
    mutate,
  } = useSWR("/api/email", getFetcher);

  // Derive selectedEmail from emails[] to avoid desync
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  useEffect(() => {
    if (emailData) {
      setEmails(emailData.data);

      // Set default selected email ON FIRST LOAD ONLY
      if (!selectedEmailId && emailData.data.length > 0) {
        setSelectedEmailId(emailData.data[0].id);
      }

      setLoading(isEmailLoading);
    } else if (emailError) {
      setError(emailError);
      setLoading(isEmailLoading);
    } else {
      setLoading(isEmailLoading);
    }
  }, [emailData, emailError]);

  const deleteEmail = async (emailId: number) => {
    try {
      await mutate(deleteFetcher("/api/email", { emailId }));

      // Remove from local state
      setEmails((prev) => prev.filter((e) => e.id !== emailId));

      // Clear selection if the deleted email was selected
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
      }
    } catch (err: unknown) {
      console.error("Error deleting email:", err);
    }
  };

  const toggleStar = (emailId: number) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId ? { ...email, starred: !email.starred } : email
      )
    );
  };

  const toggleImportant = (emailId: number) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId ? { ...email, important: !email.important } : email
      )
    );
  };

  return (
    <EmailContext.Provider
      value={{
        emails,
        selectedEmail,
        setSelectedEmailId,
        deleteEmail,
        toggleStar,
        toggleImportant,
        setFilter,
        filter,
        error,
        loading,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </EmailContext.Provider>
  );
};
