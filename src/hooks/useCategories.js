import { useContext } from 'react';
import { PortalContext } from '../context/PortalContext';

export function useCategories() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('useCategories must be used inside a PortalProvider');
  }
  return {
    categories: context.categories,
    addCategory: context.addCategory,
    removeCategory: context.removeCategory,
  };
}
