"use client";

import { useEftItemTile } from './context';

export function EftName() {
  const { item } = useEftItemTile();

  return (
    <h3
      className="mb-3 truncate font-blender-medium text-base uppercase leading-tight text-text-primary"
      title={item.name}
    >
      {item.name}
    </h3>
  );
}
