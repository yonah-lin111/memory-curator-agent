import type React from 'react'

/**
 * 应用根组件。
 */
export const App = (): React.JSX.Element => {
  return (
    <main className="min-h-screen bg-black px-8 py-8 text-white">
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center rounded-[6px] border border-white/10 bg-[#212121]">
        <h1 className="text-4xl font-semibold tracking-normal">Hello World</h1>
      </section>
    </main>
  )
}
