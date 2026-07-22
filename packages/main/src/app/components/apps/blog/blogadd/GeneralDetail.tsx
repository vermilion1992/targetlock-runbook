
'use client'
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import TiptapEdit from "@/app/components/apps/ecommerce/editor/TiptapEdit";

const GeneralDetail = () => {
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Blog Details</h5>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="prednm">Blog Title</Label>
            <span className="text-error ms-1">*</span>
          </div>
          <Input
            id="prednm"
            type="text"
            placeholder="Blog Title"
          />
          <small className='text-xs text-black dark:text-darklink'>
            A blog title is required and recommended to be unique.
          </small>
        </div>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="desc" >Content</Label>
          </div>
          <TiptapEdit />
          <small className="text-xs text-black dark:text-darklink">
            Set a Content to the blog for better visibility.
          </small>
        </div>
      </Card>
    </>
  );
};

export default GeneralDetail;
