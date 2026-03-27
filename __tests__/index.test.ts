/**
 * Unit tests for the action's entrypoint, src/index.ts
 */
import { describe, it, expect, jest } from 'bun:test'
import * as main from '../src/main'

// Mock the action's entrypoint
const runMock = jest.spyOn(main, 'run').mockImplementation(async () => {})

describe('index', () => {
  it('calls run when imported', async () => {
    await import('../src/index')
    expect(runMock).toHaveBeenCalled()
  })
})
