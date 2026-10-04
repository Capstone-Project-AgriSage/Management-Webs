import { api } from './client'
import type { CounterSaleRequest, CounterSalePreviewResponse, CounterSaleResponse } from './types'

export const counterSalesApi = {
  preview: (data: CounterSaleRequest) => {
    return api<CounterSalePreviewResponse>('/api/counter-sales/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  sell: (data: CounterSaleRequest) => {
    return api<CounterSaleResponse>('/api/counter-sales', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}
