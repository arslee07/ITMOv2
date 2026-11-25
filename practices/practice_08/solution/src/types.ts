export type TicketType = 'bug' | 'task' | 'feature' | 'unknown'
export type TicketStatus = 'triaged' | 'needs-triage' | 'in-progress' | 'closed'
export type TicketClassifier = 'llm' | 'heuristic' | 'heuristic-fallback'
export type MutableTicketStatus = 'in-progress' | 'closed'

export interface Ticket {
  id: string
  title: string
  description: string
  author: string
  type: TicketType
  confidence: number
  classifier: TicketClassifier
  label: string
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

export interface CreateTicketInput {
  title: string
  description: string
  author: string
}

export interface ValidationErrors {
  title?: string
  description?: string
  author?: string
}

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    fields?: ValidationErrors
  }
}
