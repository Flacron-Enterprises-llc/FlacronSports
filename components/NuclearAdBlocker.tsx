"use client"

import { useEffect } from 'react'
import { usePremium } from '@/lib/contexts/PremiumContext'

export default function NuclearAdBlocker() {
  const { isPremium, isLoading } = usePremium()

  useEffect(() => {
    if (!isPremium || isLoading) return

    console.log('🛡️ Nuclear Ad Blocker activated for premium user')

    // 1. Override global functions that Monetag uses for injection
    const originalFetch = window.fetch
    const originalXMLHttpRequest = window.XMLHttpRequest
    const originalCreateElement = document.createElement
    const originalAppendChild = Element.prototype.appendChild
    const originalInsertBefore = Element.prototype.insertBefore
    const originalSetAttribute = Element.prototype.setAttribute
    const originalWrite = document.write
    const originalWriteln = document.writeln

    // Block Monetag domains and known injection URLs
    const blockedDomains = [
      'monetag.com',
      'publishers.monetag.com', 
      'fpyf8.com',
      'grookilteepsou.net',
      'couphaith',
      'antiadblock'
    ]

    const blockedZones = ['165368', '9755031', '9754964']

    // 2. Override fetch to block Monetag requests
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      
      const isBlocked = blockedDomains.some(domain => url.includes(domain)) ||
                       blockedZones.some(zone => url.includes(zone))
      
      if (isBlocked) {
        console.log('🚫 NUCLEAR: Blocked fetch request:', url)
        return Promise.resolve(new Response('', { status: 200 }))
      }
      
      return originalFetch.call(this, input, init)
    }

    // 3. Override XMLHttpRequest for older injection methods
    window.XMLHttpRequest = function() {
      const xhr = new originalXMLHttpRequest()
      const originalOpen = xhr.open
      
      xhr.open = function(method: string, url: string | URL, ...args: any[]) {
        const urlStr = url.toString()
        const isBlocked = blockedDomains.some(domain => urlStr.includes(domain)) ||
                         blockedZones.some(zone => urlStr.includes(zone))
        
        if (isBlocked) {
          console.log('🚫 NUCLEAR: Blocked XMLHttpRequest:', urlStr)
          // Create a fake successful response
          setTimeout(() => {
            Object.defineProperty(xhr, 'readyState', { value: 4, writable: false })
            Object.defineProperty(xhr, 'status', { value: 200, writable: false })
            Object.defineProperty(xhr, 'responseText', { value: '', writable: false })
            if (xhr.onreadystatechange) xhr.onreadystatechange()
          }, 0)
          return
        }
        
        return originalOpen.call(this, method, url, ...args)
      }
      
      return xhr
    }

    // 4. Override createElement to block script creation
    document.createElement = function(tagName: string, options?: ElementCreationOptions): HTMLElement {
      const element = originalCreateElement.call(this, tagName, options)
      
      if (tagName.toLowerCase() === 'script') {
        const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')?.set
        if (originalSetSrc) {
          Object.defineProperty(element, 'src', {
            set: function(value: string) {
              const isBlocked = blockedDomains.some(domain => value.includes(domain)) ||
                               blockedZones.some(zone => value.includes(zone))
              
              if (isBlocked) {
                console.log('🚫 NUCLEAR: Blocked script src:', value)
                return // Don't set the src
              }
              
              originalSetSrc.call(this, value)
            },
            get: function() {
              return originalSetSrc ? originalSetSrc.call(this) : ''
            }
          })
        }
      }
      
      return element
    }

    // 5. Override appendChild to prevent injection
    Element.prototype.appendChild = function<T extends Node>(newChild: T): T {
      if (newChild.nodeType === Node.ELEMENT_NODE) {
        const element = newChild as Element
        
        // Block script elements with Monetag sources
        if (element.tagName === 'SCRIPT') {
          const src = element.getAttribute('src') || ''
          const content = element.textContent || ''
          
          const isBlocked = blockedDomains.some(domain => src.includes(domain) || content.includes(domain)) ||
                           blockedZones.some(zone => src.includes(zone) || content.includes(zone))
          
          if (isBlocked) {
            console.log('🚫 NUCLEAR: Blocked appendChild script:', src || 'inline')
            return newChild // Return but don't append
          }
        }
        
        // Block iframes with Monetag sources
        if (element.tagName === 'IFRAME') {
          const src = element.getAttribute('src') || ''
          const isBlocked = blockedDomains.some(domain => src.includes(domain))
          
          if (isBlocked) {
            console.log('🚫 NUCLEAR: Blocked appendChild iframe:', src)
            return newChild
          }
        }
      }
      
      return originalAppendChild.call(this, newChild)
    }

    // 6. Override insertBefore for injection prevention
    Element.prototype.insertBefore = function<T extends Node>(newChild: T, refChild: Node | null): T {
      if (newChild.nodeType === Node.ELEMENT_NODE) {
        const element = newChild as Element
        
        if (element.tagName === 'SCRIPT') {
          const src = element.getAttribute('src') || ''
          const content = element.textContent || ''
          
          const isBlocked = blockedDomains.some(domain => src.includes(domain) || content.includes(domain)) ||
                           blockedZones.some(zone => src.includes(zone) || content.includes(zone))
          
          if (isBlocked) {
            console.log('🚫 NUCLEAR: Blocked insertBefore script:', src || 'inline')
            return newChild
          }
        }
      }
      
      return originalInsertBefore.call(this, newChild, refChild)
    }

    // 7. Override setAttribute to block data-zone and other Monetag attributes
    Element.prototype.setAttribute = function(name: string, value: string): void {
      if (name === 'data-zone' && blockedZones.includes(value)) {
        console.log('🚫 NUCLEAR: Blocked data-zone attribute:', value)
        return
      }
      
      if (name === 'src' && blockedDomains.some(domain => value.includes(domain))) {
        console.log('🚫 NUCLEAR: Blocked src attribute:', value)
        return
      }
      
      return originalSetAttribute.call(this, name, value)
    }

    // 8. Override document.write methods (legacy injection)
    document.write = function(text: string): void {
      const isBlocked = blockedDomains.some(domain => text.includes(domain)) ||
                       blockedZones.some(zone => text.includes(zone))
      
      if (isBlocked) {
        console.log('🚫 NUCLEAR: Blocked document.write:', text.substring(0, 100))
        return
      }
      
      return originalWrite.call(this, text)
    }

    document.writeln = function(text: string): void {
      const isBlocked = blockedDomains.some(domain => text.includes(domain)) ||
                       blockedZones.some(zone => text.includes(zone))
      
      if (isBlocked) {
        console.log('🚫 NUCLEAR: Blocked document.writeln:', text.substring(0, 100))
        return
      }
      
      return originalWriteln.call(this, text)
    }

    // 9. Block eval and Function constructor (advanced injection)
    const originalEval = window.eval
    const originalFunction = window.Function

    window.eval = function(code: string): any {
      const isBlocked = blockedDomains.some(domain => code.includes(domain)) ||
                       blockedZones.some(zone => code.includes(zone)) ||
                       code.includes('antiadblock')
      
      if (isBlocked) {
        console.log('🚫 NUCLEAR: Blocked eval execution:', code.substring(0, 100))
        return undefined
      }
      
      return originalEval.call(this, code)
    }

    window.Function = function(...args: string[]): Function {
      const code = args.join(' ')
      const isBlocked = blockedDomains.some(domain => code.includes(domain)) ||
                       blockedZones.some(zone => code.includes(zone)) ||
                       code.includes('antiadblock')
      
      if (isBlocked) {
        console.log('🚫 NUCLEAR: Blocked Function constructor:', code.substring(0, 100))
        return function() { return undefined }
      }
      
      return originalFunction.apply(this, args)
    }

    console.log('🛡️ Nuclear Ad Blocker: All injection vectors secured')

    // Cleanup function
    return () => {
      window.fetch = originalFetch
      window.XMLHttpRequest = originalXMLHttpRequest
      document.createElement = originalCreateElement
      Element.prototype.appendChild = originalAppendChild
      Element.prototype.insertBefore = originalInsertBefore
      Element.prototype.setAttribute = originalSetAttribute
      document.write = originalWrite
      document.writeln = originalWriteln
      window.eval = originalEval
      window.Function = originalFunction
      
      console.log('🛡️ Nuclear Ad Blocker: Deactivated')
    }
  }, [isPremium, isLoading])

  return null
}
