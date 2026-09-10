'use client'

import {useEffect, useState} from 'react'

/**
 * Opacity that eases from 1 to 0 over the first `distance` px of vertical
 * scroll, and back to 1 on the way back up. Used to fade the nav out once
 * the page starts moving, on both the hero (absolute) and sticky headers.
 */
export function useScrollFade(distance = 120) {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      setOpacity(Math.max(0, 1 - window.scrollY / distance))
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, {passive: true})
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [distance])

  return opacity
}
