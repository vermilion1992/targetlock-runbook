import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const RemoveModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Remove Integration</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove this integration?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="destructive" onClick={onClose}>
                        Yes, Remove
                    </Button>
                    <Button onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RemoveModal;