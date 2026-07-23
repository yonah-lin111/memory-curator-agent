import { MiniMap, MiniMapNodeProps } from "@xyflow/react"
import React from "react"

export const MyMap = () => {
  return (
    <MiniMap
      nodeComponent={(props: MiniMapNodeProps) => {
        let { x, y, width, height, color } = props
        return <rect x={x} y={y} width={width} height={height} fill={color} />
      }}
    />
  )
}
