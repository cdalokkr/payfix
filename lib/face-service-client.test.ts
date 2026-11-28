/** @jest-environment node */

import { FaceServiceClient } from './face-service-client'

describe('FaceServiceClient batch extraction & fallback', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.DEV_FACE_API_URL = 'https://face.example.com'
    process.env.DEV_FACE_API_TOKEN = 'test-token'
    process.env.VERCEL_GIT_COMMIT_REF = 'develop'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('uses /extract-batch when supported by the biometric service', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { success: true, face_detected: true, face_count: 1, dimensions: 512, quality_score: 0.9, is_live: true, liveness_score: 0.9, canonical_portrait_base64: 'p0', canonical_portrait_aspect_ratio: '3:4', embedding_512: null, embedding_128: null, embedding: null },
          { success: true, face_detected: true, face_count: 1, dimensions: 512, quality_score: 0.9, is_live: true, liveness_score: 0.9, canonical_portrait_base64: null, embedding_512: null, embedding_128: null, embedding: null },
        ],
      }),
    })
    global.fetch = fetchMock as any

    const results = await FaceServiceClient.extractBatch([
      'data:image/jpeg;base64,frame0',
      'data:image/jpeg;base64,frame1',
    ])

    expect(results).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://face.example.com/extract-batch')
  })

  it('falls back transparently to parallel /extract calls if /extract-batch returns 404', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          face_detected: true,
          face_count: 1,
          dimensions: 512,
          quality_score: 0.9,
          is_live: true,
          liveness_score: 0.9,
          embedding_512: null,
          embedding_128: null,
          embedding: null,
        }),
      })
    global.fetch = fetchMock as any

    const results = await FaceServiceClient.extractBatch([
      'data:image/jpeg;base64,f0',
      'data:image/jpeg;base64,f1',
    ])

    expect(results).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toBe('https://face.example.com/extract-batch')
    expect(fetchMock.mock.calls[1][0]).toBe('https://face.example.com/extract')
    expect(fetchMock.mock.calls[2][0]).toBe('https://face.example.com/extract')
  })
})
