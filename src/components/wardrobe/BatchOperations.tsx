'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trash2, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { apiFetch } from '@/lib/api';
import type { IClothingItem, DressCode } from '@/types';

const dressCodeOptions: DressCode[] = ['Casual', 'Business Casual', 'Formal', 'Athletic', 'Loungewear'];

interface BatchOperationsProps {
  selectedItems: IClothingItem[];
  onSelectionChange: (items: IClothingItem[]) => void;
  onItemsUpdated: () => void;
  wardrobeItems: IClothingItem[];
}

export default function BatchOperations({
  selectedItems,
  onSelectionChange,
  onItemsUpdated,
  wardrobeItems,
}: BatchOperationsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkDressCodeDialog, setShowBulkDressCodeDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [selectedDressCode, setSelectedDressCode] = useState<DressCode>('Casual');

  if (selectedItems.length === 0) {
    return null;
  }

  const handleSelectAll = () => {
    onSelectionChange(wardrobeItems);
  };

  const handleClearSelection = () => {
    onSelectionChange([]);
  };

  const handleDeleteSelected = async () => {
    setIsProcessing(true);
    try {
      const response = await apiFetch('/api/wardrobe/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItems.map(item => item.id),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete items');
      }

      toast.success(`Cleared ${selectedItems.length} ${selectedItems.length === 1 ? 'piece' : 'pieces'} from your closet.`);
      onSelectionChange([]);
      onItemsUpdated();
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete those pieces. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAddTag = async () => {
    if (!tagInput.trim()) {
      toast.error("Type in a tag name first.");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiFetch('/api/wardrobe/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItems.map(item => item.id),
          addTag: tagInput.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update items');
      }

      toast.success(`Tagged ${selectedItems.length} ${selectedItems.length === 1 ? 'piece' : 'pieces'} with #${tagInput.trim()}.`);
      setTagInput('');
      setShowBulkTagDialog(false);
      onItemsUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update those tags. Try once more.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkSetDressCode = async () => {
    setIsProcessing(true);
    try {
      const response = await apiFetch('/api/wardrobe/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItems.map(item => item.id),
          dressCode: selectedDressCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update items');
      }

      toast.success(`Updated dress code to ${selectedDressCode} for ${selectedItems.length} ${selectedItems.length === 1 ? 'piece' : 'pieces'}.`);
      setShowBulkDressCodeDialog(false);
      onItemsUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update dress code on those items.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Batch Operations Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-blue-50 via-white to-transparent border-t border-gray-200 p-2 sm:p-4">
        <Card className="bg-white shadow-lg border-2 border-black">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Info Section */}
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-semibold text-xs sm:text-sm">
                    {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600">
                    ({wardrobeItems.length - selectedItems.length} remaining)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Add Tag Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkTagDialog(true)}
                  disabled={isProcessing}
                  className="text-xs min-h-[36px]"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Add Tag
                </Button>

                {/* Set Dress Code Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDressCodeDialog(true)}
                  disabled={isProcessing}
                  className="text-xs min-h-[36px]"
                >
                  <Badge className="h-3 w-3 mr-1" />
                  Set Dress Code
                </Button>

                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isProcessing}
                  className="text-xs min-h-[36px]"
                >
                  {isProcessing ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Delete All
                </Button>

                {/* Select All Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedItems.length === wardrobeItems.length}
                  className="text-xs min-h-[36px]"
                >
                  Select All
                </Button>

                {/* Clear Selection Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-xs min-h-[36px]"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedItems.length} Items?</DialogTitle>
            <DialogDescription className="flex items-start gap-2 mt-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <span>
                This action cannot be undone. All selected items will be permanently deleted from your wardrobe.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Tag Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag to {selectedItems.length} Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tag-input">Tag Name</Label>
              <Input
                id="tag-input"
                placeholder="E.g., Summer, Favorite, Donate..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleBulkAddTag()}
              />
            </div>
            <p className="text-xs text-gray-600">
              This tag will be added to all {selectedItems.length} selected items.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddTag}
              disabled={!tagInput.trim() || isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Set Dress Code Dialog */}
      <Dialog open={showBulkDressCodeDialog} onOpenChange={setShowBulkDressCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Dress Code for {selectedItems.length} Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dress-code-select">Dress Code</Label>
              <select
                id="dress-code-select"
                value={selectedDressCode}
                onChange={(e) => setSelectedDressCode(e.target.value as DressCode)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {dressCodeOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-600">
              The dress code will be set to &quot;{selectedDressCode}&quot; for all {selectedItems.length} selected items.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDressCodeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkSetDressCode} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update {selectedItems.length} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
