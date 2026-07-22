"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function EditCategoryModal({
  showModal,
  handleCloseModal,
  handleUpdateCategory,
  initialCategoryName,
}: any) {
  const [newCategoryName, setNewCategoryName] = useState(initialCategoryName);

  // Reset input when modal opens
  useEffect(() => {
    if (showModal) {
      setNewCategoryName(initialCategoryName);
    }
  }, [showModal, initialCategoryName]);

  const handleSave = () => {
    handleUpdateCategory(newCategoryName);
    handleCloseModal();
  };

  return (
    <Dialog open={showModal} onOpenChange={handleCloseModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button onClick={handleCloseModal} variant="destructive">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="default">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditCategoryModal;
