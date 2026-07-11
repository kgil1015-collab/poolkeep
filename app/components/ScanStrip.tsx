'use client'

import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

type Step = 'intro' | 'preview'

export default function ScanStrip({
  onConfirm,
  onClose,
}: {
  onConfirm: (photoDataUrl: string) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleTakePhoto() {
    setError('')
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        // In a plain mobile browser (no native app installed yet), CameraSource.Prompt's
        // "choose Camera or Photos" sheet requires the separate @ionic/pwa-elements
        // package, which isn't installed — without it the picker silently hangs forever.
        // webUseInput routes to a plain <input type="file" capture> instead, which needs
        // no extra dependency and works the same on native once that's built too.
        webUseInput: true,
        quality: 85,
        promptLabelHeader: 'Photograph Test Strip',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      })
      if (photo.dataUrl) {
        setPhotoDataUrl(photo.dataUrl)
        setStep('preview')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/cancel/i.test(message)) {
        setError('Could not open the camera. Check that PoolKeep has camera/photo permission in Settings.')
      }
    }
  }

  function retake() {
    setPhotoDataUrl(null)
    setStep('intro')
  }

  function useThisPhoto() {
    if (!photoDataUrl) return
    onConfirm(photoDataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full flex flex-col" style={{ maxWidth: 480, maxHeight: '90vh' }}>
        <div className="bg-pool-deep px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Oswald',sans-serif" }}>Photograph Test Strip</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Dip your strip, wait the usual 15 seconds, then lay it flat in good light and take a photo. It'll stay on screen next to the form below so you can read the colors and type in your numbers — nothing gets read or calculated automatically.
              </p>
              <button
                onClick={handleTakePhoto}
                className="w-full text-white font-bold py-4 rounded-xl text-sm"
                style={{ background: '#0078B8' }}
              >
                Open Camera →
              </button>
            </div>
          )}

          {step === 'preview' && photoDataUrl && (
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoDataUrl}
                alt="Captured test strip"
                className="w-full rounded-xl object-contain bg-black"
                style={{ maxHeight: '55vh' }}
              />
              <div className="flex gap-3">
                <button onClick={retake} className="flex-1 text-sm font-semibold py-3 rounded-xl text-text-muted border border-gray-200">
                  Retake
                </button>
                <button
                  onClick={useThisPhoto}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm"
                  style={{ background: '#0078B8' }}
                >
                  Use This Photo →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
