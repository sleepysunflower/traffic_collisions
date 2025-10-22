import React from 'react'

export function useVisible<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = React.useRef<T>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return [ref, visible]
}
