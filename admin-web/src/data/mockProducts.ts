import type { ProductCategory, ProductMaster, ActiveIngredient, CategoryStatus, ProductStatus, ToxicityClass } from '../types'

export const mockCategories: ProductCategory[] = [
  { id: 'CAT001', name: 'Thuốc trừ nấm', parentId: null, description: 'Các loại thuốc trị nấm bệnh', status: 'Hoạt động', createdAt: '2024-01-15', productCount: 45 },
  { id: 'CAT002', name: 'Thuốc trừ sâu', parentId: null, description: 'Phòng trừ sâu hại', status: 'Hoạt động', createdAt: '2024-01-16', productCount: 82 },
  { id: 'CAT003', name: 'Phân bón lá', parentId: null, description: 'Phân bón qua lá', status: 'Hoạt động', createdAt: '2024-01-20', productCount: 30 },
  { id: 'CAT004', name: 'Thuốc trừ cỏ', parentId: null, description: 'Diệt trừ cỏ dại', status: 'Hoạt động', createdAt: '2024-02-05', productCount: 25 },
  { id: 'CAT005', name: 'Kích thích sinh trưởng', parentId: null, description: 'Giúp cây phát triển mạnh', status: 'Đang ẩn', createdAt: '2024-02-15', productCount: 12 },
]

export const mockIngredients: ActiveIngredient[] = [
  { id: 'ING001', name: 'Abamectin', chemicalName: 'Avermectin B1a and B1b', type: 'Thuốc trừ sâu', toxicityClass: 'Nhóm II', description: 'Trị nhện đỏ, sâu cuốn lá', productCount: 15 },
  { id: 'ING002', name: 'Mancozeb', chemicalName: 'Manganese ethylenebis', type: 'Thuốc trừ nấm', toxicityClass: 'Nhóm III', description: 'Trị thán thư, sương mai', productCount: 22 },
  { id: 'ING003', name: 'Glyphosate', chemicalName: 'N-(phosphonomethyl)glycine', type: 'Thuốc trừ cỏ', toxicityClass: 'Nhóm III', description: 'Lưu dẫn diệt cỏ tận gốc', productCount: 10 },
  { id: 'ING004', name: 'Difenoconazole', chemicalName: 'Difenoconazole', type: 'Thuốc trừ nấm', toxicityClass: 'Nhóm III', description: 'Đặc trị đốm vằn', productCount: 8 },
]

export const mockProducts: ProductMaster[] = [
  {
    id: 'PRD001',
    sku: 'SP-ABA-500',
    name: 'AbaKill 3.6EC',
    imageUrl: '',
    categoryId: 'CAT002',
    activeIngredientId: 'ING001',
    manufacturer: 'Nông Dược Xanh',
    unit: 'Chai 500ml',
    status: 'Đang lưu hành',
    createdAt: '2024-03-01'
  },
  {
    id: 'PRD002',
    sku: 'SP-MAN-1KG',
    name: 'MancoXanh 80WP',
    imageUrl: '',
    categoryId: 'CAT001',
    activeIngredientId: 'ING002',
    manufacturer: 'Vật Tư Nông Nghiệp VN',
    unit: 'Gói 1kg',
    status: 'Đang lưu hành',
    createdAt: '2024-03-05'
  },
  {
    id: 'PRD003',
    sku: 'SP-GLY-900',
    name: 'Cỏ Cháy Nhanh',
    imageUrl: '',
    categoryId: 'CAT004',
    activeIngredientId: 'ING003',
    manufacturer: 'Công ty Hóa Nông',
    unit: 'Chai 900ml',
    status: 'Chờ duyệt',
    createdAt: '2024-03-10'
  },
  {
    id: 'PRD004',
    sku: 'SP-DIF-250',
    name: 'Sạch Bệnh 250EC',
    imageUrl: '',
    categoryId: 'CAT001',
    activeIngredientId: 'ING004',
    manufacturer: 'Nông Dược Xanh',
    unit: 'Chai 250ml',
    status: 'Ngừng kinh doanh',
    createdAt: '2024-01-10'
  }
]
