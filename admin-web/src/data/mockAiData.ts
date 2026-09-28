import type { AiModel, AiPolicy } from '../types'

export const mockAiModels: AiModel[] = [
  {
    id: 'MOD-CV-001',
    name: 'Plant Disease Recognition',
    version: 'v2.1.0',
    type: 'Computer Vision',
    accuracy: 94.5,
    status: 'Đang chạy',
    lastUpdated: '2024-03-10',
    description: 'Nhận diện các bệnh phổ biến trên lá lúa, sầu riêng, cà phê.'
  },
  {
    id: 'MOD-NLP-001',
    name: 'Agrisage Advisory Chatbot',
    version: 'v1.5.2',
    type: 'NLP/Chatbot',
    accuracy: 89.0,
    status: 'Đang chạy',
    lastUpdated: '2024-03-12',
    description: 'Tư vấn kỹ thuật canh tác và sử dụng thuốc BVTV.'
  },
  {
    id: 'MOD-PRD-001',
    name: 'Weather & Pest Prediction',
    version: 'v1.0.0-beta',
    type: 'Dự báo (Prediction)',
    accuracy: 78.5,
    status: 'Đang huấn luyện',
    lastUpdated: '2024-03-15',
    description: 'Dự báo khả năng bùng phát dịch bệnh dựa trên thời tiết.'
  },
]

export const mockAiPolicies: AiPolicy[] = [
  {
    id: 'POL-001',
    name: 'Chặn thuốc cấm',
    type: 'Danh sách đen (Blocklist)',
    priority: 'Cao',
    content: 'Tuyệt đối KHÔNG khuyên dùng: Paraquat, Chlorpyrifos, Fipronil. Nếu người dùng hỏi, cảnh báo về độ độc hại và tính bất hợp pháp.',
    isActive: true,
    lastUpdated: '2024-01-05'
  },
  {
    id: 'POL-002',
    name: 'Tone of voice (Giọng điệu)',
    type: 'System Prompt',
    priority: 'Trung bình',
    content: 'Bạn là chuyên gia nông nghiệp AgriSage. Hãy trả lời thân thiện, dễ hiểu, dùng ngôn ngữ phù hợp với nông dân. Luôn nhắc nhở an toàn lao động.',
    isActive: true,
    lastUpdated: '2024-02-20'
  },
  {
    id: 'POL-003',
    name: 'Ngoài phạm vi chuyên môn',
    type: 'Luật Fallback',
    priority: 'Cao',
    content: 'Nếu câu hỏi không liên quan đến nông nghiệp (ví dụ: code, y tế, chính trị), từ chối trả lời một cách lịch sự.',
    isActive: true,
    lastUpdated: '2024-01-10'
  }
]
