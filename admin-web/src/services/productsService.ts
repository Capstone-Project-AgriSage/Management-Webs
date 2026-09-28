import { mockCategories, mockProducts, mockIngredients } from '../data/mockProducts'
import type { ProductCategory, ProductMaster, ActiveIngredient, CategoryStatus, ProductStatus, ToxicityClass, CategoryActionId, ProductActionId, IngredientActionId } from '../types'

// Mock state
let categories = [...mockCategories]
let products = [...mockProducts]
let ingredients = [...mockIngredients]

// --- Categories ---
export function listCategories(): ProductCategory[] {
  return categories
}

export function createCategory(data: Partial<ProductCategory>): ProductCategory {
  const newId = `CAT${String(categories.length + 1).padStart(3, '0')}`
  const newCat: ProductCategory = {
    id: newId,
    name: data.name || '',
    parentId: data.parentId || null,
    description: data.description || '',
    status: data.status || 'Hoạt động',
    createdAt: new Date().toISOString().split('T')[0],
    productCount: 0,
  }
  categories = [newCat, ...categories]
  return newCat
}

export function updateCategory(id: string, data: Partial<ProductCategory>): void {
  categories = categories.map(c => c.id === id ? { ...c, ...data } : c)
}

export function updateCategoryStatus(id: string, status: CategoryStatus): void {
  categories = categories.map(c => c.id === id ? { ...c, status } : c)
}

export function deleteCategory(id: string): void {
  categories = categories.filter(c => c.id !== id)
}

export function categoryActionsFor(status: CategoryStatus): { id: CategoryActionId; label: string; icon: string; danger?: boolean }[] {
  return [
    { id: 'edit', label: 'Chỉnh sửa', icon: 'edit' },
    { id: 'toggle-status', label: status === 'Hoạt động' ? 'Ẩn danh mục' : 'Hiện danh mục', icon: status === 'Hoạt động' ? 'visibility_off' : 'visibility' },
    { id: 'delete', label: 'Xóa danh mục', icon: 'delete', danger: true },
  ]
}

// --- Products ---
export function listProducts(): ProductMaster[] {
  return products
}

export function createProduct(data: Partial<ProductMaster>): ProductMaster {
  const newId = `PRD${String(products.length + 1).padStart(3, '0')}`
  const newProd: ProductMaster = {
    id: newId,
    sku: data.sku || `SP-${newId}`,
    name: data.name || '',
    imageUrl: data.imageUrl || '',
    categoryId: data.categoryId || '',
    activeIngredientId: data.activeIngredientId || '',
    manufacturer: data.manufacturer || '',
    unit: data.unit || '',
    status: data.status || 'Chờ duyệt',
    createdAt: new Date().toISOString().split('T')[0],
  }
  products = [newProd, ...products]
  return newProd
}

export function updateProduct(id: string, data: Partial<ProductMaster>): void {
  products = products.map(p => p.id === id ? { ...p, ...data } : p)
}

export function updateProductStatus(id: string, status: ProductStatus): void {
  products = products.map(p => p.id === id ? { ...p, status } : p)
}

export function deleteProduct(id: string): void {
  products = products.filter(p => p.id !== id)
}

export function productActionsFor(status: ProductStatus): { id: ProductActionId; label: string; icon: string; danger?: boolean }[] {
  const actions: { id: ProductActionId; label: string; icon: string; danger?: boolean }[] = [
    { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
    { id: 'edit', label: 'Chỉnh sửa', icon: 'edit' },
  ]
  if (status === 'Chờ duyệt') {
    actions.push({ id: 'approve', label: 'Duyệt sản phẩm', icon: 'check_circle' })
    actions.push({ id: 'reject', label: 'Từ chối', icon: 'cancel', danger: true })
  }
  actions.push({ id: 'delete', label: 'Xóa sản phẩm', icon: 'delete', danger: true })
  return actions
}

// --- Ingredients ---
export function listIngredients(): ActiveIngredient[] {
  return ingredients
}

export function createIngredient(data: Partial<ActiveIngredient>): ActiveIngredient {
  const newId = `ING${String(ingredients.length + 1).padStart(3, '0')}`
  const newIng: ActiveIngredient = {
    id: newId,
    name: data.name || '',
    chemicalName: data.chemicalName || '',
    type: data.type || '',
    toxicityClass: data.toxicityClass || 'Nhóm III',
    description: data.description || '',
    productCount: 0,
  }
  ingredients = [newIng, ...ingredients]
  return newIng
}

export function updateIngredient(id: string, data: Partial<ActiveIngredient>): void {
  ingredients = ingredients.map(i => i.id === id ? { ...i, ...data } : i)
}

export function deleteIngredient(id: string): void {
  ingredients = ingredients.filter(i => i.id !== id)
}

export function ingredientActionsFor(): { id: IngredientActionId; label: string; icon: string; danger?: boolean }[] {
  return [
    { id: 'view-products', label: 'Xem sản phẩm chứa chất này', icon: 'medication' },
    { id: 'edit', label: 'Chỉnh sửa', icon: 'edit' },
    { id: 'delete', label: 'Xóa hoạt chất', icon: 'delete', danger: true },
  ]
}
