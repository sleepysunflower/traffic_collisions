import React from 'react'
import TopBar from './components/TopBar'
import Block1Trend from './components/Block1Trend'
import Block1Map from './components/Block1Map'
import Block2Heatmap from './components/Block2Heatmap'
import Block3Map from './components/Block3Map'
import Block4LISA from './components/Block4LISA'

export default function App(){
  return (
    <div className="app">
      <TopBar />
      <div className="grid">
        <Block1Trend />
        <Block1Map />
        <Block2Heatmap />
        <Block3Map />
        <Block4LISA />
      </div>
    </div>
  )
}
