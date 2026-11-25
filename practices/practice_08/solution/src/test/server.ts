import { setupServer } from 'msw/node'
import { apiHandlers } from '@/test/handlers'

export const server = setupServer(...apiHandlers)
