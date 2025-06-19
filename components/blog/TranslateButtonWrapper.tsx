"use client"

import dynamic from 'next/dynamic'

const TranslateButton = dynamic(() => import('./TranslateButton'), { ssr: false })

interface TranslateButtonWrapperProps {
  postId: string
  language: string
}

export default function TranslateButtonWrapper(props: TranslateButtonWrapperProps) {
  return <TranslateButton {...props} />
} 