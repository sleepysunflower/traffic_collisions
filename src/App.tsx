// src/App.tsx
import React from 'react'
import TopBar from './components/TopBar'
import Block1Trend from './components/Block1Trend'
import Block2Heatmap from './components/Block2Heatmap'
import Block3Map from './components/Block3Map'
import './styles.css' // ensure this import exists (in main.tsx is fine too)
import DebugPanel from './components/DebugPanel'
import BackButton from './components/BackButton'


export default function App(){
  return (
    <div className="top-card">
      <BackButton /> 
      <TopBar/>
      <div className="grid grid-areas">
        <div style={{gridArea:'trend'}}><Block1Trend /></div>
        <div style={{gridArea:'heat'}}><Block2Heatmap /></div>
        <div style={{gridArea:'map'}}><Block3Map /></div>
      </div>
    </div>
  )
}