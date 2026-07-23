import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App"
import "./styles.css"

// 全局拦截 Markdown 预览/编辑器内的超链接点击，阻止页面跳转。
document.addEventListener(
  "click",
  (e) => {
    const anchor = (e.target as HTMLElement).closest?.<HTMLAnchorElement>(
      ".md-editor-preview a[href]",
    )
    if (anchor) {
      e.preventDefault()
    }
  },
  true,
)

// React 挂载节点。
const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("缺少 React 挂载节点")
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
