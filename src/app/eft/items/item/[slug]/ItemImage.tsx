'use client';

import { itemIconUrl } from '@/lib/item-icon';

interface ItemImageProps {
  id: string;
  image512pxLink: string;
  name: string;
  className?: string;
}

 
export function ItemImage({ id, image512pxLink, name, className = '' }: ItemImageProps) {
  return (
     
    <img
      src={itemIconUrl(id)}
      alt={name}
      className={className}
      onError={(e) => {
        if (!e.currentTarget.dataset.triedApi) {
          e.currentTarget.dataset.triedApi = 'true';
          e.currentTarget.src = image512pxLink || '/images/placeholder.webp';
        } else if (!e.currentTarget.dataset.triedPlaceholder) {
          e.currentTarget.dataset.triedPlaceholder = 'true';
          e.currentTarget.src = '/images/placeholder.webp';
        }
      }}
    />
  );
}

interface VendorImageProps {
  normalizedName: string;
  name: string;
  className?: string;
}

export function VendorImage({ normalizedName, name, className = '' }: VendorImageProps) {
  return (
     
    <img
      src={`/images/traders/eft/${normalizedName}.webp`}
      alt={name}
      className={className}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
