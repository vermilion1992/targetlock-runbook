import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React, { useContext } from "react";
import { Icon } from "@iconify/react";
import { ProductContext } from "@/app/context/ecommerce-context/index";
import PlaceholdersInput from "@/app/components/animated-components/AnimatedInputPlaceholder";

type Props = {
  onClickFilter: (event: React.MouseEvent<HTMLElement>) => void;
};
const ProductSearch = ({ onClickFilter }: Props) => {
  const { searchProduct, searchProducts } = useContext(ProductContext);

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <h5 className="card-title lg:flex hidden">Products</h5>
          <Button
            variant={"lightprimary"}
            className="btn-circle p-0 lg:!hidden flex"
            onClick={onClickFilter}
          >
            <Icon icon="tabler:menu-2" height={18} />
          </Button>
        </div>
        <div className="relative">
          <PlaceholdersInput
            value={searchProduct}
            onChange={searchProducts}
            placeholders={[
              "Search Product...",
              "Find What you want...",
              "Look up Products...",
            ]}
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Icon icon="solar:magnifer-line-duotone" height={18} />
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductSearch;
